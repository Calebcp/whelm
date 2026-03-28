import { NextRequest, NextResponse } from "next/server";

import { buildLeaderboardProfile } from "@/lib/leaderboard";
import { isLeaderboardUsernameAvailable, saveLeaderboardProfile } from "@/lib/leaderboard-store";
import { requireAnalyticsAuthHeader } from "@/lib/analytics-aggregation";
import { validateUsername } from "@/lib/username";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = requireAnalyticsAuthHeader(request);
    const body = (await request.json()) as {
      userId?: string;
      username?: string;
      totalXp?: number;
      currentStreak?: number;
      level?: number;
      createdAtISO?: string;
      bestStreak?: number;
      totalFocusHours?: number;
      weeklyXp?: number;
    };

    if (!body.userId || typeof body.userId !== "string") {
      return jsonError("Missing userId.", 400);
    }

    if (!body.username || typeof body.username !== "string") {
      return jsonError("Missing username.", 400);
    }

    const validation = validateUsername(body.username);
    if (!validation.ok) {
      return jsonError(validation.message, 400);
    }

    const available = await isLeaderboardUsernameAvailable(
      authHeader,
      validation.username,
      body.userId,
    );
    if (!available) {
      return jsonError("That username is already taken.", 409);
    }

    const profile = buildLeaderboardProfile({
      userId: body.userId,
      username: validation.username,
      totalXp: typeof body.totalXp === "number" ? body.totalXp : 0,
      currentStreak: typeof body.currentStreak === "number" ? body.currentStreak : 0,
      level: typeof body.level === "number" ? body.level : 1,
      createdAtISO:
        typeof body.createdAtISO === "string" && body.createdAtISO.length > 0
          ? body.createdAtISO
          : new Date().toISOString(),
      bestStreak: typeof body.bestStreak === "number" ? body.bestStreak : 0,
      totalFocusHours: typeof body.totalFocusHours === "number" ? body.totalFocusHours : 0,
      weeklyXp: typeof body.weeklyXp === "number" ? body.weeklyXp : 0,
    });

    await saveLeaderboardProfile(authHeader, profile);

    return NextResponse.json({ ok: true, profile });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to sync leaderboard profile.", 400);
  }
}
