import { Redis } from "@upstash/redis";
import type { TroutData, TierThresholds } from "@/types";
import { computeTroutScore, computeThresholds, assignTier } from "../trout/sizing";

const CACHE_TTL = 720; // 12 minutes in seconds

function createRedis() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL environment variable is not set");
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

  const pipeline = redis.pipeline();

  pipeline.set("trout:thresholds", JSON.stringify(thresholds), {
    ex: CACHE_TTL,
  });

  // Populate sorted set and individual hashes
  for (let i = 0; i < scored.length; i++) {
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

  pipeline.expire("trout:all", CACHE_TTL);

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
    oldestTrout: scored.reduce<(typeof scored)[0] | null>(
      (oldest, s) =>
        !oldest || s.daysHeld > oldest.daysHeld ? s : oldest,
      null
    ),
    lastUpdated: new Date().toISOString(),
  };

  pipeline.set("trout:stats", JSON.stringify(stats), { ex: CACHE_TTL });

  // Name uniqueness map
  for (const n of names) {
    pipeline.hset("trout:names", { [n.displayName.toLowerCase()]: n.address });
  }

  await pipeline.exec();
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
