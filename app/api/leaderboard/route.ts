import { NextRequest, NextResponse } from "next/server";

import { getLeaderboardPage } from "@/lib/leaderboard-store";
import type { LeaderboardMetric } from "@/lib/leaderboard";
import { requireAnalyticsAuthHeader } from "@/lib/analytics-aggregation";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = requireAnalyticsAuthHeader(request);
    const metric = request.nextUrl.searchParams.get("metric");
    const cursor = request.nextUrl.searchParams.get("cursor");
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "20");
    const userId = request.nextUrl.searchParams.get("userId");
    const aroundWindow = Number(request.nextUrl.searchParams.get("aroundWindow") ?? "2");

    if (metric !== "xp" && metric !== "streak") {
      return jsonError('Metric must be "xp" or "streak".', 400);
    }

    const payload = await getLeaderboardPage(authHeader, {
      metric: metric as LeaderboardMetric,
      limit: Math.min(50, Math.max(1, Number.isFinite(limit) ? limit : 20)),
      cursor,
      userId,
      aroundWindow: Math.min(5, Math.max(1, Number.isFinite(aroundWindow) ? aroundWindow : 2)),
    });

    return NextResponse.json(payload);
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to load leaderboard.", 400);
  }
}
