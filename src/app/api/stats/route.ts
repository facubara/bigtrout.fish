import { NextResponse } from "next/server";
import { getRedis } from "@/lib/db/redis";

export const runtime = "edge";

export async function GET() {
  const redis = getRedis();
  const stats = await redis.get("trout:stats");

  if (!stats) {
    return NextResponse.json(
      { error: "Stats not available yet" },
      { status: 503 }
    );
  }

  return NextResponse.json(
    typeof stats === "string" ? JSON.parse(stats) : stats,
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    }
  );
}
