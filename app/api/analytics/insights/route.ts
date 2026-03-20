import { NextRequest } from "next/server";

import {
  getUserIdParam,
  getUserInsightsFeed,
  normalizeDateRange,
  parsePositiveInt,
} from "@/lib/analytics-dashboard";
import { runAnalyticsGetRoute } from "@/lib/analytics-route";

export async function GET(request: NextRequest) {
  return runAnalyticsGetRoute(
    request,
    async ({ request, authHeader }) => {
      const userId = getUserIdParam(request.nextUrl.searchParams);
      const range = normalizeDateRange(
        request.nextUrl.searchParams.get("startDate"),
        request.nextUrl.searchParams.get("endDate"),
      );
      const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 6, 12);

      return getUserInsightsFeed(authHeader, userId, range, limit);
    },
    "Failed to load insights feed.",
  );
}
