import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/db/redis";
import type { TroutDetailResponse } from "@/types";

export const runtime = "edge";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  // Validate Solana base58 address format (prevents Redis key injection)
  if (
    !address ||
    address.length < 32 ||
    address.length > 44 ||
    !/^[1-9A-HJ-NP-Za-km-z]+$/.test(address)
  ) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const redis = getRedis();
  const data = (await redis.hgetall(
    `trout:data:${address}`
  )) as Record<string, string> | null;

  if (!data || Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Trout not found" }, { status: 404 });
  }

  const trout: TroutDetailResponse = {
    address,
    displayName: data.displayName || null,
    balance: parseInt(data.balance),
    firstSeen: data.firstSeen,
    daysHeld: parseInt(data.daysHeld),
    score: parseFloat(data.score),
    tier: parseInt(data.tier) as 1 | 2 | 3 | 4 | 5 | 6,
    rank: parseInt(data.rank),
    x: parseFloat(data.x),
    y: parseFloat(data.y),
  };

  return NextResponse.json(trout, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
