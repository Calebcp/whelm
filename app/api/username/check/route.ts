import { NextRequest, NextResponse } from "next/server";

import { isLeaderboardUsernameAvailable } from "@/lib/leaderboard-store";
import { requireAnalyticsAuthHeader } from "@/lib/analytics-aggregation";
import { validateUsername } from "@/lib/username";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = requireAnalyticsAuthHeader(request);
    const username = request.nextUrl.searchParams.get("username") ?? "";
    const excludeUserId = request.nextUrl.searchParams.get("excludeUserId");
    const validation = validateUsername(username);

    if (!validation.ok) {
      return NextResponse.json({
        ok: false,
        available: false,
        message: validation.message,
      });
    }

    const available = await isLeaderboardUsernameAvailable(
      authHeader,
      validation.username,
      excludeUserId,
    );

    return NextResponse.json({
      ok: true,
      available,
      message: available ? "" : "That username is already taken.",
      username: validation.username,
    });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to validate username.", 400);
  }
}
