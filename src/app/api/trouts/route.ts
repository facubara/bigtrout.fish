import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/db/redis";
import type { TroutsResponse } from "@/types";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "500") || 500, 1),
    1000
  );
  const cursor = searchParams.get("cursor");
  const offset = cursor ? parseInt(atob(cursor)) || 0 : 0;

  const redis = getRedis();

  // Get total count
  const total = await redis.zcard("trout:all");

  // Get addresses by rank (descending score)
  const addresses: string[] = await redis.zrange(
    "trout:all",
    offset,
    offset + limit - 1,
    { rev: true }
  );

  if (addresses.length === 0) {
    return NextResponse.json(
      { trouts: [], nextCursor: null, total } satisfies TroutsResponse,
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  }

  // Fetch data for each address
  const pipeline = redis.pipeline();
  for (const addr of addresses) {
    pipeline.hgetall(`trout:data:${addr}`);
  }
  const results = await pipeline.exec();

  const trouts = addresses
    .map((address, i) => {
      const data = results[i] as Record<string, string> | null;
      if (!data || Object.keys(data).length === 0) return null;
      return {
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
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  const nextOffset = offset + limit;
  const nextCursor =
    nextOffset < total ? btoa(nextOffset.toString()) : null;

  return NextResponse.json(
    { trouts, nextCursor, total } satisfies TroutsResponse,
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
