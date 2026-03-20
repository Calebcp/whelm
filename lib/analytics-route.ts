import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireAnalyticsAuthHeader } from "@/lib/analytics-aggregation";

type RouteHandler<T> = (context: { request: NextRequest; authHeader: string }) => Promise<T>;

function statusForAnalyticsError(message: string) {
  return message === "Missing Firebase auth token." ? 401 : 400;
}

export function analyticsJsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function runAnalyticsGetRoute<T>(
  request: NextRequest,
  handler: RouteHandler<T>,
  fallbackMessage: string,
) {
  try {
    const authHeader = requireAnalyticsAuthHeader(request);
    const payload = await handler({ request, authHeader });
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : fallbackMessage;
    return analyticsJsonError(message, statusForAnalyticsError(message));
  }
}
