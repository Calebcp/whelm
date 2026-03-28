import { NextRequest, NextResponse } from "next/server";

import { searchLeaderboardProfiles } from "@/lib/leaderboard-store";
import { requireAnalyticsAuthHeader } from "@/lib/analytics-aggregation";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = requireAnalyticsAuthHeader(request);
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "10");

    if (!q.trim()) {
      return NextResponse.json({ items: [] });
    }

    const items = await searchLeaderboardProfiles(
      authHeader,
      q,
      Math.min(25, Math.max(1, Number.isFinite(limit) ? limit : 10)),
    );

    return NextResponse.json({ items });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to search users.", 400);
  }
}
