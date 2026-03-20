import test from "node:test";
import assert from "node:assert/strict";

import { aggregateAnalyticsDailyMetrics } from "@/lib/analytics-aggregation";

import { createJsonResponse, installFetchMock } from "./helpers/mock-fetch";

function eventDocument({
  eventId,
  eventName,
  userId = "user-agg",
  occurredAt,
  occurredDateLocal,
  subjectMode = "work",
  properties,
}: {
  eventId: string;
  eventName: string;
  occurredAt: string;
  occurredDateLocal: string;
  userId?: string;
  subjectMode?: "work" | "school" | "language" | "general";
  properties: Record<string, string | number | boolean | null>;
}) {
  const propertyFields = Object.fromEntries(
    Object.entries(properties).map(([key, value]) => {
      if (value === null) return [key, { nullValue: null }];
      if (typeof value === "number") {
        return [key, Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }];
      }
      if (typeof value === "boolean") return [key, { booleanValue: value }];
      return [key, { stringValue: value }];
    }),
  );

  return {
    document: {
      fields: {
        eventId: { stringValue: eventId },
        eventName: { stringValue: eventName },
        userId: { stringValue: userId },
        occurredAt: { timestampValue: occurredAt },
        occurredDateLocal: { stringValue: occurredDateLocal },
        clientTimezone: { stringValue: "UTC" },
        clientPlatform: { stringValue: "ios" },
        deviceId: { nullValue: null },
        sessionId: { stringValue: `${eventId}-session` },
        taskId: { nullValue: null },
        subjectMode: { stringValue: subjectMode },
        payloadVersion: { integerValue: "1" },
        properties: { mapValue: { fields: propertyFields } },
      },
    },
  };
}

test("aggregateAnalyticsDailyMetrics handles low usage, abandoned sessions, and missing optional data", async () => {
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-project";
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
  process.env.FIREBASE_DATABASE_ID = "(default)";

  const persistedBodies: unknown[] = [];
  const restoreFetch = installFetchMock(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes(":runQuery")) {
      return createJsonResponse({
        json: [
          eventDocument({
            eventId: "start-low",
            eventName: "session_started",
            occurredAt: "2026-03-18T09:00:00.000Z",
            occurredDateLocal: "2026-03-18",
            properties: { sessionType: "focus", targetMinutes: 25 },
          }),
          eventDocument({
            eventId: "abandon-short-1",
            eventName: "session_abandoned",
            occurredAt: "2026-03-18T09:05:00.000Z",
            occurredDateLocal: "2026-03-18",
            properties: { sessionType: "focus", elapsedMinutes: 5, qualityScore: 20 },
          }),
          eventDocument({
            eventId: "start-high-1",
            eventName: "session_started",
            occurredAt: "2026-03-19T08:00:00.000Z",
            occurredDateLocal: "2026-03-19",
            subjectMode: "school",
            properties: { sessionType: "focus", targetMinutes: 60 },
          }),
          eventDocument({
            eventId: "complete-high-1",
            eventName: "session_completed",
            occurredAt: "2026-03-19T09:00:00.000Z",
            occurredDateLocal: "2026-03-19",
            subjectMode: "school",
            properties: { sessionType: "focus", durationMinutes: 60, qualityScore: 92 },
          }),
          eventDocument({
            eventId: "start-high-2",
            eventName: "session_started",
            occurredAt: "2026-03-19T10:00:00.000Z",
            occurredDateLocal: "2026-03-19",
            subjectMode: "work",
            properties: { sessionType: "focus", targetMinutes: 90 },
          }),
          eventDocument({
            eventId: "complete-high-2",
            eventName: "session_completed",
            occurredAt: "2026-03-19T11:30:00.000Z",
            occurredDateLocal: "2026-03-19",
            subjectMode: "work",
            properties: { sessionType: "focus", durationMinutes: 90, qualityScore: 88 },
          }),
          eventDocument({
            eventId: "task-high",
            eventName: "task_completed",
            occurredAt: "2026-03-19T11:40:00.000Z",
            occurredDateLocal: "2026-03-19",
            subjectMode: "work",
            properties: { scheduledDate: "2026-03-19", durationMinutes: 45, linkedSessionId: null },
          }),
          eventDocument({
            eventId: "task-high-2",
            eventName: "task_completed",
            occurredAt: "2026-03-19T11:50:00.000Z",
            occurredDateLocal: "2026-03-19",
            subjectMode: "school",
            properties: { scheduledDate: "2026-03-19", durationMinutes: 30, linkedSessionId: null },
          }),
          eventDocument({
            eventId: "task-high-3",
            eventName: "task_completed",
            occurredAt: "2026-03-19T12:00:00.000Z",
            occurredDateLocal: "2026-03-19",
            subjectMode: "school",
            properties: { scheduledDate: "2026-03-19", durationMinutes: 15, linkedSessionId: null },
          }),
          eventDocument({
            eventId: "streak-high",
            eventName: "streak_updated",
            occurredAt: "2026-03-19T12:05:00.000Z",
            occurredDateLocal: "2026-03-19",
            properties: {
              streakDate: "2026-03-19",
              previousLength: 4,
              newLength: 5,
              updateSource: "session_completed",
              linkedSessionId: null,
            },
          }),
        ],
      });
    }

    if (url.includes("/analyticsDailyMetrics/")) {
      persistedBodies.push(JSON.parse(String(init?.body)));
      return createJsonResponse({ json: { name: "persisted" } });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  try {
    const metrics = await aggregateAnalyticsDailyMetrics("Bearer token-agg", "user-agg", [
      "2026-03-18",
      "2026-03-19",
    ]);

    assert.equal(metrics.length, 2);

    const lowUsageDay = metrics[0];
    assert.equal(lowUsageDay.focusMinutes, 0);
    assert.equal(lowUsageDay.sessionsStarted, 1);
    assert.equal(lowUsageDay.sessionsAbandoned, 1);
    assert.equal(lowUsageDay.averageSessionQualityScore, 20);
    assert.equal(lowUsageDay.dailyPerformanceBand, "recovery");
    assert.ok(lowUsageDay.dailyPerformanceScore < 20);

    const highUsageDay = metrics[1];
    assert.equal(highUsageDay.focusMinutes, 150);
    assert.equal(highUsageDay.sessionsCompleted, 2);
    assert.equal(highUsageDay.taskCompletedCount, 3);
    assert.equal(highUsageDay.averageCompletedSessionLength, 75);
    assert.equal(highUsageDay.streakLengthEndOfDay, 5);
    assert.equal(highUsageDay.subjectBreakdown.school.focusMinutes, 60);
    assert.equal(highUsageDay.subjectBreakdown.work.focusMinutes, 90);
    assert.equal(highUsageDay.dailyPerformanceBand, "high");
    assert.ok(highUsageDay.dailyPerformanceScore >= 80);

    assert.equal(persistedBodies.length, 2);
    const firstMetricBody = persistedBodies[0] as {
      fields: { updatedAtISO: { stringValue: string } };
    };
    assert.equal(typeof firstMetricBody.fields.updatedAtISO.stringValue, "string");
  } finally {
    restoreFetch();
  }
});

test("aggregateAnalyticsDailyMetrics keeps very high usage days within the scoring cap", async () => {
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-project";
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
  process.env.FIREBASE_DATABASE_ID = "(default)";

  const restoreFetch = installFetchMock(async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes(":runQuery")) {
      return createJsonResponse({
        json: [
          eventDocument({
            eventId: "start-1",
            eventName: "session_started",
            occurredAt: "2026-03-20T08:00:00.000Z",
            occurredDateLocal: "2026-03-20",
            properties: { sessionType: "focus", targetMinutes: 120 },
          }),
          eventDocument({
            eventId: "complete-1",
            eventName: "session_completed",
            occurredAt: "2026-03-20T10:00:00.000Z",
            occurredDateLocal: "2026-03-20",
            properties: { sessionType: "focus", durationMinutes: 120, qualityScore: 98 },
          }),
          eventDocument({
            eventId: "start-2",
            eventName: "session_started",
            occurredAt: "2026-03-20T11:00:00.000Z",
            occurredDateLocal: "2026-03-20",
            properties: { sessionType: "focus", targetMinutes: 120 },
          }),
          eventDocument({
            eventId: "complete-2",
            eventName: "session_completed",
            occurredAt: "2026-03-20T13:00:00.000Z",
            occurredDateLocal: "2026-03-20",
            properties: { sessionType: "focus", durationMinutes: 120, qualityScore: 97 },
          }),
          eventDocument({
            eventId: "task-1",
            eventName: "task_completed",
            occurredAt: "2026-03-20T13:10:00.000Z",
            occurredDateLocal: "2026-03-20",
            properties: { scheduledDate: "2026-03-20", durationMinutes: 60, linkedSessionId: null },
          }),
          eventDocument({
            eventId: "task-2",
            eventName: "task_completed",
            occurredAt: "2026-03-20T13:20:00.000Z",
            occurredDateLocal: "2026-03-20",
            properties: { scheduledDate: "2026-03-20", durationMinutes: 60, linkedSessionId: null },
          }),
          eventDocument({
            eventId: "task-3",
            eventName: "task_completed",
            occurredAt: "2026-03-20T13:30:00.000Z",
            occurredDateLocal: "2026-03-20",
            properties: { scheduledDate: "2026-03-20", durationMinutes: 60, linkedSessionId: null },
          }),
        ],
      });
    }

    if (url.includes("/analyticsDailyMetrics/")) {
      return createJsonResponse({ json: { name: "persisted" } });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  try {
    const [metric] = await aggregateAnalyticsDailyMetrics("Bearer token-agg", "user-agg", ["2026-03-20"]);
    assert.equal(metric.focusMinutes, 240);
    assert.equal(metric.sessionsCompleted, 2);
    assert.equal(metric.taskCompletedCount, 3);
    assert.equal(metric.dailyPerformanceScore, 95);
    assert.equal(metric.dailyPerformanceBand, "high");
  } finally {
    restoreFetch();
  }
});
