import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

const MESSAGE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

export function buildVerifyMessage(address: string): {
  message: string;
  nonce: string;
} {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const timestamp = Date.now();
  const message = `Sign this message to verify your Big Trout: ${address}\nTimestamp: ${timestamp}\nNonce: ${nonce}`;
  return { message, nonce };
}

export function verifySignature(
  address: string,
  message: string,
  signatureBase58: string
): { valid: boolean; error?: string } {
  // Parse timestamp from message
  const timestampMatch = message.match(/Timestamp: (\d+)/);
  if (!timestampMatch) {
    return { valid: false, error: "Invalid message format" };
  }

  const timestamp = parseInt(timestampMatch[1], 10);
  if (Date.now() - timestamp > MESSAGE_MAX_AGE_MS) {
    return { valid: false, error: "Message has expired" };
  }

  // Verify the address in the message matches
  const addressMatch = message.match(/Big Trout: ([A-Za-z0-9]+)/);
  if (!addressMatch || addressMatch[1] !== address) {
    return { valid: false, error: "Address mismatch in message" };
  }

  try {
    const publicKey = new PublicKey(address);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = decodeBase58(signatureBase58);

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );

    if (!isValid) {
      return { valid: false, error: "Invalid signature" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid signature or address" };
  }
}

// Base58 decoder (Solana uses base58 for signatures)
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function decodeBase58(str: string): Uint8Array {
  const bytes: number[] = [0];
  for (const char of str) {
    const value = BASE58_ALPHABET.indexOf(char);
    if (value === -1) throw new Error("Invalid base58 character");
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = bytes[i] * 58 + value;
      if (bytes[i] > 255) {
        if (i + 1 >= bytes.length) bytes.push(0);
        bytes[i + 1] += bytes[i] >> 8;
        bytes[i] &= 0xff;
      }
    }
  }
  // Handle leading '1's
  let leadingZeros = 0;
  for (const char of str) {
    if (char === "1") leadingZeros++;
    else break;
  }
  const result = new Uint8Array(leadingZeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    result[result.length - 1 - i] = bytes[i];
  }
  return result;
}
