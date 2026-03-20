import { NextRequest } from "next/server";

import { getBestFocusHours, getUserIdParam, normalizeDateRange } from "@/lib/analytics-dashboard";
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

      return getBestFocusHours(authHeader, userId, range);
    },
    "Failed to load best focus hours.",
  );
}
