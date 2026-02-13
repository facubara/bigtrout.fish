import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getDb } from "@/lib/db/postgres";
import { getRedis } from "@/lib/db/redis";
import { customNames } from "@/lib/db/schema";
import { validateDisplayName } from "@/lib/trout/naming";
import { eq, sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  // Verify JWT
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing authorization token" },
      { status: 401 }
    );
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  let address: string;
  try {
    const { payload } = await jwtVerify(
      authHeader.slice(7),
      new TextEncoder().encode(jwtSecret),
      { issuer: "bigtrout.fish" }
    );
    if (!payload.sub || typeof payload.sub !== "string") {
      return NextResponse.json(
        { error: "Invalid token: missing subject" },
        { status: 401 }
      );
    }
    address = payload.sub;
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }

  // Parse body
  let body: { displayName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  const { displayName } = body;

  if (!displayName || typeof displayName !== "string") {
    return NextResponse.json(
      { error: "displayName is required" },
      { status: 400 }
    );
  }

  // Validate name format
  const validation = validateDisplayName(displayName);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Check uniqueness
  const redis = getRedis();
  const existingOwner = await redis.hget("trout:names", displayName.toLowerCase()) as string | null;
  if (existingOwner && existingOwner !== address) {
    return NextResponse.json(
      { error: "Name already taken" },
      { status: 409 }
    );
  }

  // Double-check against PostgreSQL (source of truth)
  const db = getDb();
  const existing = await db
    .select()
    .from(customNames)
    .where(
      sql`lower(${customNames.displayName}) = ${displayName.toLowerCase()} AND ${customNames.address} != ${address}`
    )
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      { error: "Name already taken" },
      { status: 409 }
    );
  }

  // Get the old name (if any) to clean up Redis
  const oldRecord = await db
    .select()
    .from(customNames)
    .where(eq(customNames.address, address))
    .limit(1);

  const oldName = oldRecord[0]?.displayName;

  // Upsert — wrapped in try-catch to handle race condition on unique name index
  try {
    await db
      .insert(customNames)
      .values({
        address,
        displayName,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: customNames.address,
        set: { displayName, updatedAt: new Date() },
      });
  } catch (err: unknown) {
    // Unique constraint violation from concurrent requests
    const message = err instanceof Error ? err.message : "";
    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.json(
        { error: "Name already taken" },
        { status: 409 }
      );
    }
    throw err;
  }

  // Update Redis
  const pipeline = redis.pipeline();
  pipeline.hset(`trout:data:${address}`, { displayName });
  pipeline.hset("trout:names", { [displayName.toLowerCase()]: address });
  if (oldName && oldName.toLowerCase() !== displayName.toLowerCase()) {
    pipeline.hdel("trout:names", oldName.toLowerCase());
  }
  await pipeline.exec();

  return NextResponse.json({ displayName, address });
}
