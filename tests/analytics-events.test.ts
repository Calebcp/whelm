import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import {
  normalizeAnalyticsEvent,
  parseTrackAnalyticsRequest,
  validateAnalyticsEventInput,
} from "@/lib/analytics-events";
import { createJsonResponse, installFetchMock } from "./helpers/mock-fetch";

test("validateAnalyticsEventInput rejects invalid session payloads", () => {
  assert.throws(
    () =>
      validateAnalyticsEventInput({
        eventName: "session_completed",
        sessionId: "s1",
        sessionType: "focus",
        subjectMode: "work",
        durationMinutes: 0,
      }),
    /durationMinutes/,
  );

  assert.throws(
    () =>
      validateAnalyticsEventInput({
        eventName: "session_abandoned",
        sessionId: "s2",
        sessionType: "focus",
        subjectMode: "unknown-mode",
        elapsedMinutes: 5,
      }),
    /subjectMode/,
  );
});

test("parseTrackAnalyticsRequest fills defaults and preserves optional analytics fields", () => {
  const parsed = parseTrackAnalyticsRequest({
    userId: "user-1",
    event: {
      eventName: "session_completed",
      sessionId: "session-1",
      sessionType: "focus",
      subjectMode: "school",
      durationMinutes: 45,
      clientTimezone: "Asia/Shanghai",
      occurredAt: "2026-03-21T12:00:00.000Z",
    },
  });

  assert.equal(parsed.userId, "user-1");
  assert.equal(parsed.event.eventName, "session_completed");
  assert.equal(parsed.event.properties.completionStatus, "completed");
  assert.equal(parsed.event.properties.qualityScore, null);
  assert.equal(parsed.event.occurredDateLocal, "2026-03-21");
});

test("normalizeAnalyticsEvent keeps missing task linkage null", () => {
  const normalized = normalizeAnalyticsEvent("user-2", {
    eventName: "session_completed",
    sessionId: "session-2",
    sessionType: "focus",
    subjectMode: "work",
    durationMinutes: 30,
    occurredAt: "2026-03-21T14:00:00.000Z",
    clientTimezone: "UTC",
  });

  assert.equal(normalized.taskId, null);
  assert.equal(normalized.properties.completedFromTaskId, null);
  assert.equal(normalized.properties.noteAttached, null);
});

test("analytics event route stores the event and triggers daily aggregation", async () => {
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-project";
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
  process.env.FIREBASE_DATABASE_ID = "(default)";
  const { POST: trackAnalyticsEvent } = await import("@/app/api/analytics/events/route");

  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const restoreFetch = installFetchMock(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });

    if (url.includes("/analyticsEvents/")) {
      return createJsonResponse({ json: { name: "stored-event" } });
    }

    if (url.includes(":runQuery")) {
      return createJsonResponse({
        json: [
          {
            document: {
              fields: {
                eventId: { stringValue: "evt-1" },
                eventName: { stringValue: "session_completed" },
                userId: { stringValue: "user-3" },
                occurredAt: { timestampValue: "2026-03-21T12:00:00.000Z" },
                occurredDateLocal: { stringValue: "2026-03-21" },
                clientTimezone: { stringValue: "UTC" },
                clientPlatform: { stringValue: "ios" },
                deviceId: { nullValue: null },
                sessionId: { stringValue: "session-3" },
                taskId: { nullValue: null },
                subjectMode: { stringValue: "work" },
                payloadVersion: { integerValue: "1" },
                properties: {
                  mapValue: {
                    fields: {
                      durationMinutes: { integerValue: "25" },
                      sessionType: { stringValue: "focus" },
                      completionStatus: { stringValue: "completed" },
                    },
                  },
                },
              },
            },
          },
        ],
      });
    }

    if (url.includes("/analyticsDailyMetrics/")) {
      return createJsonResponse({ json: { name: "metric-doc" } });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  try {
    const request = new NextRequest("http://localhost/api/analytics/events", {
      method: "POST",
      headers: {
        authorization: "Bearer token-1",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        userId: "user-3",
        event: {
          eventId: "evt-1",
          eventName: "session_completed",
          occurredAt: "2026-03-21T12:00:00.000Z",
          clientTimezone: "UTC",
          clientPlatform: "ios",
          sessionId: "session-3",
          sessionType: "focus",
          subjectMode: "work",
          durationMinutes: 25,
        },
      }),
    });

    const response = await trackAnalyticsEvent(request);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { ok: true, eventId: "evt-1" });
    assert.equal(calls.length, 3);
    assert.match(calls[0].url, /analyticsEvents/);
    assert.match(calls[1].url, /:runQuery/);
    assert.match(calls[2].url, /analyticsDailyMetrics/);

    const storedBody = JSON.parse(String(calls[0].init?.body));
    assert.equal(storedBody.fields.userId.stringValue, "user-3");
    assert.equal(storedBody.fields.properties.mapValue.fields.durationMinutes.integerValue, "25");
  } finally {
    restoreFetch();
  }
});
