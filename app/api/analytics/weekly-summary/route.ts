import { NextRequest } from "next/server";

import { getWeeklySummary, normalizeWeekStart } from "@/lib/analytics-dashboard";
import { analyticsJsonError, runAnalyticsGetRoute } from "@/lib/analytics-route";

export async function GET(request: NextRequest) {
  return runAnalyticsGetRoute(
    request,
    async ({ request, authHeader }) => {
      const userId = request.nextUrl.searchParams.get("userId") ?? request.nextUrl.searchParams.get("uid");

      if (!userId) return analyticsJsonError("Missing userId.", 400);

      const weekStart = normalizeWeekStart(request.nextUrl.searchParams.get("weekStart"));
      return getWeeklySummary(authHeader, userId, weekStart);
    },
    "Failed to load weekly summary.",
  );
}
