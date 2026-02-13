'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTroutStore } from '@/lib/store';
import type { VerifyResponse } from '@/types';

export default function WalletConnect() {
  const walletAddress = useTroutStore((s) => s.walletAddress);
  const isVerified = useTroutStore((s) => s.isVerified);
  const setWallet = useTroutStore((s) => s.setWallet);
  const setVerified = useTroutStore((s) => s.setVerified);
  const setSelectedTrout = useTroutStore((s) => s.setSelectedTrout);
  const setCamera = useTroutStore((s) => s.setCamera);
  const troutMap = useTroutStore((s) => s.troutMap);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNaming, setShowNaming] = useState(false);

  const connectAndVerify = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      // Check for Phantom wallet
      const phantom = (window as unknown as { solana?: PhantomProvider }).solana;
      if (!phantom?.isPhantom) {
        setError('Phantom wallet not found. Please install it.');
        setLoading(false);
        return;
      }

      // Connect
      const resp = await phantom.connect();
      const address = resp.publicKey.toString();
      setWallet(address);

      // Build verification message matching the format expected by the server
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const timestamp = Date.now();
      const message = `Sign this message to verify your Big Trout: ${address}\nTimestamp: ${timestamp}\nNonce: ${nonce}`;
      const encodedMessage = new TextEncoder().encode(message);

      // Request signature
      const { signature } = await phantom.signMessage(encodedMessage, 'utf8');
      // Encode as base58 (the server's verifySignature expects base58)
      const signatureBase58 = encodeBase58(new Uint8Array(signature));

      // POST to /api/verify
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          message,
          signature: signatureBase58,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? 'Verification failed');
        setLoading(false);
        return;
      }

      const data: VerifyResponse = await res.json();
      setVerified(true, data.token);

      // Store JWT
      localStorage.setItem('bigtrout:jwt', data.token);

      // Pan to the user's trout
      setSelectedTrout(address);
      const trout = troutMap.get(address);
      if (trout) {
        setCamera({ targetX: trout.x, targetY: trout.y, targetZoom: 2 });
      }
    } catch (err) {
      if (err instanceof Error) {
        // User rejected or wallet error
        if (err.message.includes('User rejected')) {
          setError('Signature rejected');
        } else {
          setError(err.message);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [setWallet, setVerified, setSelectedTrout, setCamera, troutMap]);

  const disconnect = useCallback(() => {
    setWallet(null);
    setVerified(false);
    localStorage.removeItem('bigtrout:jwt');
    setShowNaming(false);
  }, [setWallet, setVerified]);

  // Verified state: show wallet info + rename option
  if (isVerified && walletAddress) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowNaming(true)}
          className="bg-emerald-600/80 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-md font-mono hover:bg-emerald-500/80 transition"
          title="Rename your trout"
        >
          {shortenAddress(walletAddress)}
        </button>
        <button
          onClick={disconnect}
          className="bg-black/40 backdrop-blur-sm text-white/60 text-sm px-2 py-1.5 rounded-md font-mono hover:bg-black/60 hover:text-white/80 transition"
          title="Disconnect"
        >
          x
        </button>
        {showNaming && <NamingTrigger onClose={() => setShowNaming(false)} />}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={connectAndVerify}
        disabled={loading}
        className="bg-emerald-600/80 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-md font-mono hover:bg-emerald-500/80 transition disabled:opacity-50 disabled:cursor-wait"
      >
        {loading ? 'Connecting...' : 'Find My Trout'}
      </button>
      {error && (
        <div className="absolute top-full mt-1 right-0 bg-red-900/80 backdrop-blur-sm text-white text-xs px-2 py-1 rounded font-mono max-w-48 whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * Small trigger that opens the NamingModal via a custom event.
 * Uses useEffect to avoid side effects during render.
 */
function NamingTrigger({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('bigtrout:open-naming'));
    onClose();
  }, [onClose]);

  return null;
}

function shortenAddress(addr: string): string {
  return addr.slice(0, 4) + '...' + addr.slice(-4);
}

interface PhantomProvider {
  isPhantom: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signMessage: (
    message: Uint8Array,
    display: string
  ) => Promise<{ signature: Uint8Array }>;
  disconnect: () => Promise<void>;
}

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function encodeBase58(bytes: Uint8Array): string {
  // Count leading zeros
  let zeros = 0;
  for (const b of bytes) {
    if (b === 0) zeros++;
    else break;
  }

  // Convert to base58
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] * 256;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  return (
    '1'.repeat(zeros) +
    digits
      .reverse()
      .map((d) => BASE58_ALPHABET[d])
      .join('')
  );
}
