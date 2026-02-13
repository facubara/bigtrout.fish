"use client";

import { useCallback, useState } from "react";
import { useTroutStore } from "@/lib/store";
import type { VerifyResponse, ApiError } from "@/types";

const JWT_STORAGE_KEY = "bigtrout:jwt";
const WALLET_STORAGE_KEY = "bigtrout:wallet";

interface PhantomProvider {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  signMessage: (
    message: Uint8Array,
    encoding: string
  ) => Promise<{ signature: Uint8Array }>;
}

function getPhantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const solana = (window as unknown as { solana?: PhantomProvider }).solana;
  if (solana?.isPhantom) return solana;
  return null;
}

/**
 * Hook that wraps Phantom wallet connection and verification flow.
 *
 * Flow:
 * 1. connectWallet() - connects to Phantom, gets publicKey
 * 2. verifyWallet() - signs a message, sends to /api/verify, stores JWT
 * 3. JWT is stored in localStorage for 24h persistence
 */
export function useWallet() {
  const setWallet = useTroutStore((s) => s.setWallet);
  const setVerified = useTroutStore((s) => s.setVerified);
  const setSelectedTrout = useTroutStore((s) => s.setSelectedTrout);
  const walletAddress = useTroutStore((s) => s.walletAddress);
  const isVerified = useTroutStore((s) => s.isVerified);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Restore session from localStorage on mount
  const restoreSession = useCallback(() => {
    try {
      const storedJwt = localStorage.getItem(JWT_STORAGE_KEY);
      const storedWallet = localStorage.getItem(WALLET_STORAGE_KEY);
      if (storedJwt && storedWallet) {
        // Check if JWT is expired (decode payload without verification)
        const payload = JSON.parse(atob(storedJwt.split(".")[1]));
        if (payload.exp * 1000 > Date.now()) {
          setWallet(storedWallet);
          setVerified(true, storedJwt);
          return true;
        }
        // Expired -- clear
        localStorage.removeItem(JWT_STORAGE_KEY);
        localStorage.removeItem(WALLET_STORAGE_KEY);
      }
    } catch {
      // Ignore parse errors
    }
    return false;
  }, [setWallet, setVerified]);

  const connectWallet = useCallback(async () => {
    setError(null);
    const phantom = getPhantom();
    if (!phantom) {
      setError("Phantom wallet not found. Please install it from phantom.app");
      return null;
    }

    setIsConnecting(true);
    try {
      const resp = await phantom.connect();
      const address = resp.publicKey.toString();
      setWallet(address);
      return address;
    } catch {
      setError("Connection cancelled. Try again when ready.");
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [setWallet]);

  const verifyWallet = useCallback(async () => {
    setError(null);
    const address = useTroutStore.getState().walletAddress;
    if (!address) {
      setError("Connect wallet first");
      return false;
    }

    const phantom = getPhantom();
    if (!phantom) {
      setError("Phantom wallet not found");
      return false;
    }

    setIsVerifying(true);
    try {
      // Build message
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const timestamp = Date.now();
      const message = `Sign this message to verify your Big Trout: ${address}\nTimestamp: ${timestamp}\nNonce: ${nonce}`;

      // Request signature from Phantom
      const encoded = new TextEncoder().encode(message);
      const { signature } = await phantom.signMessage(encoded, "utf8");

      // Encode signature as base58
      const signatureBase58 = encodeBase58(signature);

      // Send to API
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, message, signature: signatureBase58 }),
      });

      if (!res.ok) {
        const err: ApiError = await res.json();
        setError(err.error);
        return false;
      }

      const data: VerifyResponse = await res.json();
      setVerified(true, data.token);
      setSelectedTrout(address);

      // Persist to localStorage
      localStorage.setItem(JWT_STORAGE_KEY, data.token);
      localStorage.setItem(WALLET_STORAGE_KEY, address);

      return true;
    } catch {
      setError("Verification cancelled.");
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [setVerified, setSelectedTrout]);

  const disconnectWallet = useCallback(() => {
    setWallet(null);
    setVerified(false);
    setSelectedTrout(null);
    localStorage.removeItem(JWT_STORAGE_KEY);
    localStorage.removeItem(WALLET_STORAGE_KEY);
    const phantom = getPhantom();
    phantom?.disconnect().catch(() => {});
  }, [setWallet, setVerified, setSelectedTrout]);

  return {
    walletAddress,
    isVerified,
    error,
    isConnecting,
    isVerifying,
    connectWallet,
    verifyWallet,
    disconnectWallet,
    restoreSession,
  };
}

// Base58 encoder for Solana signatures
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(bytes: Uint8Array): string {
  // Count leading zeros
  let leadingZeros = 0;
  for (const b of bytes) {
    if (b !== 0) break;
    leadingZeros++;
  }

  // Convert to base58
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] * 256;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let result = "1".repeat(leadingZeros);
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}
