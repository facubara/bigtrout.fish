import { NextRequest, NextResponse } from "next/server";
import { verifySignature } from "@/lib/solana/verify";
import { getRedis } from "@/lib/db/redis";
import { SignJWT } from "jose";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { address, message, signature } = body;

  if (!address || !message || !signature) {
    return NextResponse.json(
      { error: "Missing required fields: address, message, signature" },
      { status: 400 }
    );
  }

  // Verify signature
  const result = verifySignature(address, message, signature);
  if (!result.valid) {
    return NextResponse.json(
      { error: result.error ?? "Invalid signature" },
      { status: 401 }
    );
  }

  // Verify address is a holder
  const redis = getRedis();
  const troutData = await redis.hgetall(`trout:data:${address}`) as Record<string, string> | null;

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

  return NextResponse.json({
    verified: true,
    token,
    trout: {
      address,
      displayName: troutData.displayName || null,
      tier: parseInt(troutData.tier),
      rank: parseInt(troutData.rank),
    },
  });
}
