import { NextRequest, NextResponse } from "next/server";

import { getFirestoreAdminAuthHeader } from "@/lib/google-service-auth";
import { rebuildLeaderboardSnapshots } from "@/lib/leaderboard-store";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function requireJobAuth(request: NextRequest) {
  const secret = process.env.LEADERBOARD_JOB_SECRET?.trim();
  const providedSecret = request.headers.get("x-leaderboard-job-secret")?.trim();

  if (!secret) {
    throw new Error("Missing LEADERBOARD_JOB_SECRET environment variable.");
  }

  if (providedSecret !== secret) {
    throw new Error("Invalid leaderboard job secret.");
  }
}

export async function POST(request: NextRequest) {
  try {
    requireJobAuth(request);
    const authHeader = await getFirestoreAdminAuthHeader();
    const body = (await request.json().catch(() => ({}))) as { snapshotDate?: string };
    const snapshotDate =
      typeof body.snapshotDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.snapshotDate)
        ? body.snapshotDate
        : new Date().toISOString().slice(0, 10);

    const result = await rebuildLeaderboardSnapshots(authHeader, snapshotDate);

    return NextResponse.json(result);
  } catch (error: unknown) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to rebuild leaderboard snapshot.",
      400,
    );
  }
}
