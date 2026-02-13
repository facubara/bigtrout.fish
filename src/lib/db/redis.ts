import { Redis } from "@upstash/redis";
import type { TroutData, TierThresholds } from "@/types";
import { computeTroutScore, computeThresholds, assignTier } from "../trout/sizing";

const CACHE_TTL = 720; // 12 minutes in seconds

function createRedis() {
  // Upstash Redis.fromEnv() reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables are required");
  }
  return Redis.fromEnv();
}

let _redis: Redis | null = null;

export function getRedis() {
  if (!_redis) {
    _redis = createRedis();
  }
  return _redis;
}

// ─── Cache Population (called by cron sync) ─────────────────

interface HolderRow {
  address: string;
  balance: number;
  firstSeen: Date;
}

interface NameRow {
  address: string;
  displayName: string;
}

function daysSince(date: Date): number {
  return Math.max(
    1,
    Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  );
}

export async function populateCache(
  holders: HolderRow[],
  names: NameRow[],
  tokenDecimals: number,
  worldWidth: number,
  worldHeight: number
): Promise<void> {
  const redis = getRedis();
  const nameMap = new Map(names.map((n) => [n.address, n.displayName]));

  // Compute all scores and sort for ranking
  const scored = holders
    .map((h) => {
      const daysHeld = daysSince(h.firstSeen);
      const humanBalance = h.balance / Math.pow(10, tokenDecimals);
      const score = computeTroutScore(humanBalance, daysHeld);
      return { ...h, daysHeld, score, humanBalance };
    })
    .sort((a, b) => b.score - a.score);

  // Compute tier thresholds
  const scores = scored.map((s) => s.score);
  const thresholds = computeThresholds(scores);

  // Delete old sorted set to remove stale entries from previous syncs
  await redis.del("trout:all");

  // Process in batches to stay within Upstash pipeline limits (~1000 commands)
  const PIPELINE_BATCH = 300; // 3 commands per holder -> ~300 holders per batch

  // First pipeline: thresholds
  const initPipeline = redis.pipeline();
  initPipeline.set("trout:thresholds", JSON.stringify(thresholds), {
    ex: CACHE_TTL,
  });
  await initPipeline.exec();

  // Populate sorted set and individual hashes in batches
  for (let batch = 0; batch < scored.length; batch += PIPELINE_BATCH) {
    const pipeline = redis.pipeline();
    const end = Math.min(batch + PIPELINE_BATCH, scored.length);

    for (let i = batch; i < end; i++) {
      const s = scored[i];
      const tier = assignTier(s.score, thresholds);
      const { x, y } = seedPosition(s.address, worldWidth, worldHeight);

      pipeline.zadd("trout:all", { score: s.score, member: s.address });
      pipeline.hset(`trout:data:${s.address}`, {
        balance: s.balance.toString(),
        firstSeen: s.firstSeen.toISOString(),
        score: s.score.toFixed(2),
        tier: tier.toString(),
        rank: (i + 1).toString(),
        displayName: nameMap.get(s.address) ?? "",
        x: x.toFixed(1),
        y: y.toFixed(1),
        daysHeld: s.daysHeld.toString(),
      });
      pipeline.expire(`trout:data:${s.address}`, CACHE_TTL);
    }

    await pipeline.exec();
  }

  // Set TTL on sorted set
  await redis.expire("trout:all", CACHE_TTL);

  // Stats
  const totalSupply = scored.reduce((sum, s) => sum + s.humanBalance, 0);
  const avgDays =
    scored.length > 0
      ? scored.reduce((sum, s) => sum + s.daysHeld, 0) / scored.length
      : 0;

  const stats = {
    totalHolders: scored.length,
    totalSupplyHeld: totalSupply,
    avgDaysHeld: Math.round(avgDays * 10) / 10,
    largestTrout: scored[0]
      ? {
          address: scored[0].address,
          displayName: nameMap.get(scored[0].address) ?? null,
          score: scored[0].score,
        }
      : null,
    oldestTrout: scored.reduce<{ address: string; displayName: string | null; daysHeld: number } | null>(
      (oldest, s) => {
        if (!oldest || s.daysHeld > oldest.daysHeld) {
          return {
            address: s.address,
            displayName: nameMap.get(s.address) ?? null,
            daysHeld: s.daysHeld,
          };
        }
        return oldest;
      },
      null
    ),
    lastUpdated: new Date().toISOString(),
  };

  // Final pipeline: stats + name uniqueness map
  const finalPipeline = redis.pipeline();
  finalPipeline.set("trout:stats", JSON.stringify(stats), { ex: CACHE_TTL });

  for (const n of names) {
    finalPipeline.hset("trout:names", { [n.displayName.toLowerCase()]: n.address });
  }

  await finalPipeline.exec();
}

// ─── Deterministic position from address ─────────────────────

function hashAddress(address: string): number {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) - hash + address.charCodeAt(i)) | 0;
  }
  return (hash >>> 0) / 0xffffffff;
}

function seedPosition(
  address: string,
  worldWidth: number,
  worldHeight: number
): { x: number; y: number } {
  const seed1 = hashAddress(address);
  const seed2 = hashAddress(address + "y");
  return {
    x: seed1 * worldWidth,
    y: seed2 * worldHeight,
  };
}
