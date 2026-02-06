import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/db/redis";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "500"), 1000);
  const cursor = searchParams.get("cursor");
  const offset = cursor ? parseInt(Buffer.from(cursor, "base64").toString()) : 0;

  const redis = getRedis();

  // Get total count
  const total = await redis.zcard("trout:all");

  // Get addresses by rank (descending score)
  const addresses: string[] = await redis.zrange("trout:all", offset, offset + limit - 1, {
    rev: true,
  });

  if (addresses.length === 0) {
    return NextResponse.json({ trouts: [], nextCursor: null, total });
  }

  // Fetch data for each address
  const pipeline = redis.pipeline();
  for (const addr of addresses) {
    pipeline.hgetall(`trout:data:${addr}`);
  }
  const results = await pipeline.exec();

  const trouts = addresses.map((address, i) => {
    const data = results[i] as Record<string, string> | null;
    if (!data || Object.keys(data).length === 0) return null;
    return {
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
    };
  }).filter(Boolean);

  const nextOffset = offset + limit;
  const nextCursor = nextOffset < total
    ? Buffer.from(nextOffset.toString()).toString("base64")
    : null;

  return NextResponse.json(
    { trouts, nextCursor, total },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
