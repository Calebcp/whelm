import { NextRequest, NextResponse } from "next/server";

import {
  aggregateAnalyticsDailyMetrics,
  requireAnalyticsAuthHeader,
} from "@/lib/analytics-aggregation";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = requireAnalyticsAuthHeader(request);
    const body = (await request.json()) as {
      userId?: string;
      dates?: string[];
    };

    if (!body.userId || typeof body.userId !== "string") {
      return jsonError("Missing userId.", 400);
    }

    const dates = Array.isArray(body.dates)
      ? body.dates.filter((value): value is string => typeof value === "string" && value.length > 0)
      : undefined;

    const metrics = await aggregateAnalyticsDailyMetrics(authHeader, body.userId, dates);

    return NextResponse.json({
      ok: true,
      metrics,
    });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to aggregate analytics.", 400);
  }
}
