import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/db/redis";

export const runtime = "edge";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const redis = getRedis();
  const data = await redis.hgetall(`trout:data:${address}`) as Record<string, string> | null;

  if (!data || Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Trout not found" }, { status: 404 });
  }

  return NextResponse.json({
    address,
    displayName: data.displayName || null,
    balance: parseInt(data.balance),
    firstSeen: data.firstSeen,
    daysHeld: parseInt(data.daysHeld),
    score: parseFloat(data.score),
    tier: parseInt(data.tier),
    rank: parseInt(data.rank),
    x: parseFloat(data.x),
    y: parseFloat(data.y),
  });
}
