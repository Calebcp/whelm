import { NextRequest } from "next/server";

import { getFocusTrends, getUserIdParam, normalizeDateRange } from "@/lib/analytics-dashboard";
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
      const groupByParam = request.nextUrl.searchParams.get("groupBy");
      const groupBy = groupByParam === "week" ? "week" : "day";

      return getFocusTrends(authHeader, userId, range, groupBy);
    },
    "Failed to load focus trends.",
  );
}
