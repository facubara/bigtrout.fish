import { NextRequest, NextResponse } from "next/server";
import { verifySignature } from "@/lib/solana/verify";
import { getRedis } from "@/lib/db/redis";
import { SignJWT } from "jose";
import type { VerifyRequest, VerifyResponse } from "@/types";

export async function POST(request: NextRequest) {
  let body: VerifyRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { address, message, signature } = body;

  if (!address || !message || !signature) {
    return NextResponse.json(
      { error: "Missing required fields: address, message, signature" },
      { status: 400 }
    );
  }

  // Basic address format validation (Solana base58, 32-44 chars)
  if (
    typeof address !== "string" ||
    address.length < 32 ||
    address.length > 44
  ) {
    return NextResponse.json(
      { error: "Invalid address format" },
      { status: 400 }
    );
  }

  // Verify signature (includes timestamp and address checks)
  const result = verifySignature(address, message, signature);
  if (!result.valid) {
    return NextResponse.json(
      { error: result.error ?? "Invalid signature" },
      { status: 401 }
    );
  }

  // Verify address is a holder
  const redis = getRedis();
  const troutData = (await redis.hgetall(
    `trout:data:${address}`
  )) as Record<string, string> | null;

  if (!troutData || Object.keys(troutData).length === 0) {
    return NextResponse.json(
      { error: "Address is not a token holder" },
      { status: 404 }
    );
  }

  // Issue JWT
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const token = await new SignJWT({ sub: address })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .setIssuer("bigtrout.fish")
    .sign(new TextEncoder().encode(secret));

  const response: VerifyResponse = {
    verified: true,
    token,
    trout: {
      address,
      displayName: troutData.displayName || null,
      tier: parseInt(troutData.tier) as 1 | 2 | 3 | 4 | 5 | 6,
      rank: parseInt(troutData.rank),
    },
  };

  return NextResponse.json(response);
}
