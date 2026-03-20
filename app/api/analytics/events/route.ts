import { NextRequest, NextResponse } from "next/server";

import { aggregateAnalyticsDailyMetrics } from "@/lib/analytics-aggregation";
import { parseTrackAnalyticsRequest } from "@/lib/analytics-events";

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

function requireConfig() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) {
    throw new Error("Missing Firebase environment variables on the server.");
  }

  return {
    apiKey,
    projectId,
  };
}

function firestoreDocumentsBaseUrl(targetDatabaseId = process.env.FIREBASE_DATABASE_ID?.trim() || "(default)") {
  const { projectId } = requireConfig();
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${targetDatabaseId}/documents`;
}

function getAuthHeader(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader : null;
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function encodeFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (typeof value === "string") {
    if (!Number.isNaN(new Date(value).getTime()) && value.includes("T")) {
      return { timestampValue: value };
    }
    return { stringValue: value };
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, nestedValue]) => [key, encodeFirestoreValue(nestedValue)]),
        ),
      },
    };
  }

  throw new Error("Unsupported analytics field type.");
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = getAuthHeader(request);
    if (!authHeader) {
      return jsonError("Missing Firebase auth token.", 401);
    }

    const payload = parseTrackAnalyticsRequest(await request.json());
    const baseUrl = firestoreDocumentsBaseUrl();
    const { apiKey } = requireConfig();

    const response = await fetch(
      `${baseUrl}/analyticsEvents/${encodeURIComponent(payload.event.eventId)}?key=${apiKey}`,
      {
        method: "PATCH",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          fields: {
            eventId: encodeFirestoreValue(payload.event.eventId),
            eventName: encodeFirestoreValue(payload.event.eventName),
            userId: encodeFirestoreValue(payload.event.userId),
            occurredAt: encodeFirestoreValue(payload.event.occurredAt),
            occurredDateLocal: encodeFirestoreValue(payload.event.occurredDateLocal),
            clientTimezone: encodeFirestoreValue(payload.event.clientTimezone),
            clientPlatform: encodeFirestoreValue(payload.event.clientPlatform),
            deviceId: encodeFirestoreValue(payload.event.deviceId),
            sessionId: encodeFirestoreValue(payload.event.sessionId),
            taskId: encodeFirestoreValue(payload.event.taskId),
            subjectMode: encodeFirestoreValue(payload.event.subjectMode),
            payloadVersion: encodeFirestoreValue(payload.event.payloadVersion),
            properties: encodeFirestoreValue(payload.event.properties),
          },
        }),
      },
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string; status?: string } }
        | null;
      throw new Error(body?.error?.message || body?.error?.status || "Failed to write analytics event.");
    }

    const datesToRebuild = new Set<string>([payload.event.occurredDateLocal]);
    if (
      payload.event.eventName === "streak_updated" &&
      typeof payload.event.properties.streakDate === "string" &&
      payload.event.properties.streakDate.length > 0
    ) {
      datesToRebuild.add(payload.event.properties.streakDate);
    }

    await aggregateAnalyticsDailyMetrics(authHeader, payload.userId, [...datesToRebuild]);

    return NextResponse.json({
      ok: true,
      eventId: payload.event.eventId,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to capture analytics event.";
    return jsonError(message, 400);
  }
}
