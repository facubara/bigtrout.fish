import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/db/redis";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(parseInt(searchParams.get("page") ?? "1"), 1);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const search = searchParams.get("search")?.trim();

  const redis = getRedis();
  const totalEntries = await redis.zcard("trout:all");
  const totalPages = Math.ceil(totalEntries / limit);
  const offset = (page - 1) * limit;

  // If searching, we need to scan — not ideal but functional for now
  if (search) {
    return await handleSearch(redis, search, page, limit);
  }

  const addresses: string[] = await redis.zrange("trout:all", offset, offset + limit - 1, {
    rev: true,
  });

  const pipeline = redis.pipeline();
  for (const addr of addresses) {
    pipeline.hgetall(`trout:data:${addr}`);
  }
  const results = await pipeline.exec();

  const entries = addresses.map((address, i) => {
    const data = results[i] as Record<string, string> | null;
    if (!data || Object.keys(data).length === 0) return null;
    return {
      rank: parseInt(data.rank),
      address,
      displayName: data.displayName || null,
      balance: parseInt(data.balance),
      daysHeld: parseInt(data.daysHeld),
      score: parseFloat(data.score),
      tier: parseInt(data.tier),
    };
  }).filter(Boolean);

  return NextResponse.json({ entries, page, totalPages, totalEntries });
}

async function handleSearch(
  redis: ReturnType<typeof getRedis>,
  search: string,
  page: number,
  limit: number
) {
  const searchLower = search.toLowerCase();

  // Get all addresses (necessary for search — could be optimized with a secondary index)
  const allAddresses: string[] = await redis.zrange("trout:all", 0, -1, { rev: true });

  // Filter by address prefix or name
  const matching: { address: string; data: Record<string, string> }[] = [];

  // Process in batches to avoid huge pipeline
  const BATCH = 200;
  for (let i = 0; i < allAddresses.length && matching.length < page * limit; i += BATCH) {
    const batch = allAddresses.slice(i, i + BATCH);
    const pipeline = redis.pipeline();
    for (const addr of batch) {
      pipeline.hgetall(`trout:data:${addr}`);
    }
    const results = await pipeline.exec();

    for (let j = 0; j < batch.length; j++) {
      const addr = batch[j];
      const data = results[j] as Record<string, string> | null;
      if (!data || Object.keys(data).length === 0) continue;

      if (
        addr.toLowerCase().startsWith(searchLower) ||
        (data.displayName && data.displayName.toLowerCase().includes(searchLower))
      ) {
        matching.push({ address: addr, data });
      }
    }
  }

  const offset = (page - 1) * limit;
  const sliced = matching.slice(offset, offset + limit);

  const entries = sliced.map(({ address, data }) => ({
    rank: parseInt(data.rank),
    address,
    displayName: data.displayName || null,
    balance: parseInt(data.balance),
    daysHeld: parseInt(data.daysHeld),
    score: parseFloat(data.score),
    tier: parseInt(data.tier),
  }));

  return NextResponse.json({
    entries,
    page,
    totalPages: Math.ceil(matching.length / limit),
    totalEntries: matching.length,
  });
}
