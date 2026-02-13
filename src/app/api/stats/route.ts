import { NextResponse } from "next/server";
import { getRedis } from "@/lib/db/redis";
import type { StatsResponse } from "@/types";

export const runtime = "edge";

export async function GET() {
  const redis = getRedis();
  const raw = await redis.get("trout:stats");

  if (!raw) {
    return NextResponse.json(
      { error: "Stats not available yet" },
      { status: 503, headers: { "Retry-After": "60" } }
    );
  }

  const stats: StatsResponse =
    typeof raw === "string" ? JSON.parse(raw) : raw;

  return NextResponse.json(stats, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    },
  });
}
