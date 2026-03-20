import { NextRequest, NextResponse } from "next/server";

import { getDailySummary } from "@/lib/analytics-dashboard";
import { analyticsJsonError, runAnalyticsGetRoute } from "@/lib/analytics-route";

export async function GET(request: NextRequest) {
  return runAnalyticsGetRoute(
    request,
    async ({ request, authHeader }) => {
    const userId = request.nextUrl.searchParams.get("userId") ?? request.nextUrl.searchParams.get("uid");
    const date = request.nextUrl.searchParams.get("date");

      if (!userId) return analyticsJsonError("Missing userId.", 400);
      if (!date) return analyticsJsonError("Missing date.", 400);

      return getDailySummary(authHeader, userId, date);
    },
    "Failed to load daily summary.",
  );
}
