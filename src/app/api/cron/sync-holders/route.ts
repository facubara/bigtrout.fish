import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/postgres";
import { getRedis, populateCache } from "@/lib/db/redis";
import { holders, customNames } from "@/lib/db/schema";
import { fetchAllHolders } from "@/lib/solana/holders";
import { computeWorldSize } from "@/lib/trout/sizing";
import { eq, inArray } from "drizzle-orm";

const LOCK_KEY = "trout:sync:lock";
const LOCK_TTL = 300; // 5 minutes
const TOKEN_DECIMALS = 9; // adjust per actual token

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const redis = getRedis();

  // Acquire lock
  const locked = await redis.set(LOCK_KEY, "1", { nx: true, ex: LOCK_TTL });
  if (!locked) {
    return NextResponse.json(
      { error: "Sync already in progress" },
      { status: 409 }
    );
  }

  try {
    const db = getDb();

    // 1. Fetch current holders from Helius
    const onChainHolders = await fetchAllHolders();

    // 2. Fetch current DB state
    const dbHolders = await db.select().from(holders);
    const dbMap = new Map(dbHolders.map((h) => [h.address, h]));

    // 3. Compute diff
    let added = 0;
    let updated = 0;
    let removed = 0;

    const toInsert: { address: string; balance: number }[] = [];
    const toUpdate: { address: string; balance: number }[] = [];
    const toDelete: string[] = [];

    for (const [address, balance] of onChainHolders) {
      const existing = dbMap.get(address);
      if (!existing) {
        toInsert.push({ address, balance });
        added++;
      } else if (existing.balance !== balance) {
        toUpdate.push({ address, balance });
        updated++;
      }
      dbMap.delete(address);
    }

    // Remaining in dbMap = holders who sold everything
    for (const address of dbMap.keys()) {
      toDelete.push(address);
      removed++;
    }

    // 4. Apply changes in batches
    const BATCH_SIZE = 500;
    const now = new Date();

    // Batch inserts
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      await db.insert(holders).values(
        batch.map((h) => ({
          address: h.address,
          balance: h.balance,
          firstSeen: now,
          lastUpdated: now,
        }))
      );
    }

    // Batch updates (individual queries but batched in groups to limit concurrency)
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((item) =>
          db
            .update(holders)
            .set({ balance: item.balance, lastUpdated: now })
            .where(eq(holders.address, item.address))
        )
      );
    }

    // Batch deletes using inArray
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
      const batch = toDelete.slice(i, i + BATCH_SIZE);
      await db.delete(holders).where(inArray(holders.address, batch));
    }

    // 5. Fetch fresh data for cache
    const allHolders = await db.select().from(holders);
    const allNames = await db
      .select({
        address: customNames.address,
        displayName: customNames.displayName,
      })
      .from(customNames);

    // 6. Compute world size and populate Redis
    const world = computeWorldSize(allHolders.length);
    await populateCache(
      allHolders.map((h) => ({
        address: h.address,
        balance: h.balance,
        firstSeen: h.firstSeen,
      })),
      allNames,
      TOKEN_DECIMALS,
      world.width,
      world.height
    );

    // 7. Record last sync time
    await redis.set("trout:sync:last", new Date().toISOString());

    const duration = Date.now() - startTime;

    return NextResponse.json({
      synced: allHolders.length,
      added,
      removed,
      updated,
      duration,
    });
  } finally {
    await redis.del(LOCK_KEY);
  }
}
