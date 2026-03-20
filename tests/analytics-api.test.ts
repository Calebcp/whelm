import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import { GET as getDailySummary } from "@/app/api/analytics/daily-summary/route";
import { GET as getInsightsFeed } from "@/app/api/analytics/insights/route";

import { createJsonResponse, installFetchMock } from "./helpers/mock-fetch";

function analyticsMetricDocument(fields: {
  userId: string;
  dateLocal: string;
  focusMinutes: number;
  sessionsStarted: number;
  sessionsCompleted: number;
  sessionCompletionRate: number;
  averageCompletedSessionLength: number;
  sessionsAbandoned: number;
  taskCompletedCount: number;
  streakActive: boolean;
  streakLengthEndOfDay: number;
  averageSessionQualityScore: number | null;
  dailyPerformanceScore: number;
  dailyPerformanceBand: "high" | "steady" | "recovery";
}) {
  const nullableQuality =
    fields.averageSessionQualityScore === null
      ? { nullValue: null }
      : { doubleValue: fields.averageSessionQualityScore };

  return {
    document: {
      fields: {
        userId: { stringValue: fields.userId },
        dateLocal: { stringValue: fields.dateLocal },
        timezone: { stringValue: "UTC" },
        updatedAtISO: { timestampValue: "2026-03-21T00:00:00.000Z" },
        focusMinutes: { integerValue: String(fields.focusMinutes) },
        sessionsStarted: { integerValue: String(fields.sessionsStarted) },
        sessionsCompleted: { integerValue: String(fields.sessionsCompleted) },
        sessionCompletionRate: { doubleValue: fields.sessionCompletionRate },
        averageCompletedSessionLength: { doubleValue: fields.averageCompletedSessionLength },
        sessionsAbandoned: { integerValue: String(fields.sessionsAbandoned) },
        taskCompletedCount: { integerValue: String(fields.taskCompletedCount) },
        streakActive: { booleanValue: fields.streakActive },
        streakLengthEndOfDay: { integerValue: String(fields.streakLengthEndOfDay) },
        averageSessionQualityScore: nullableQuality,
        dailyPerformanceScore: { integerValue: String(fields.dailyPerformanceScore) },
        dailyPerformanceBand: { stringValue: fields.dailyPerformanceBand },
        subjectBreakdown: {
          mapValue: {
            fields: {
              language: { mapValue: { fields: { focusMinutes: { integerValue: "0" }, sessionsCompleted: { integerValue: "0" }, tasksCompleted: { integerValue: "0" } } } },
              school: { mapValue: { fields: { focusMinutes: { integerValue: "0" }, sessionsCompleted: { integerValue: "0" }, tasksCompleted: { integerValue: "0" } } } },
              work: { mapValue: { fields: { focusMinutes: { integerValue: String(fields.focusMinutes) }, sessionsCompleted: { integerValue: String(fields.sessionsCompleted) }, tasksCompleted: { integerValue: String(fields.taskCompletedCount) } } } },
              general: { mapValue: { fields: { focusMinutes: { integerValue: "0" }, sessionsCompleted: { integerValue: "0" }, tasksCompleted: { integerValue: "0" } } } }
            },
          },
        },
      },
    },
  };
}

function analyticsEventDocument(fields: {
  eventName: "session_completed" | "session_abandoned";
  occurredAt: string;
  occurredDateLocal: string;
  durationMinutes?: number;
  elapsedMinutes?: number;
  qualityScore?: number | null;
}) {
  const propertyFields: Record<string, unknown> = {
    qualityScore:
      fields.qualityScore === undefined || fields.qualityScore === null
        ? { nullValue: null }
        : { doubleValue: fields.qualityScore },
  };

  if (fields.durationMinutes !== undefined) {
    propertyFields.durationMinutes = { integerValue: String(fields.durationMinutes) };
  }

  if (fields.elapsedMinutes !== undefined) {
    propertyFields.elapsedMinutes = { integerValue: String(fields.elapsedMinutes) };
  }

  return {
    document: {
      fields: {
        eventId: { stringValue: `${fields.eventName}-${fields.occurredAt}` },
        eventName: { stringValue: fields.eventName },
        userId: { stringValue: "user-api" },
        occurredAt: { timestampValue: fields.occurredAt },
        occurredDateLocal: { stringValue: fields.occurredDateLocal },
        clientTimezone: { stringValue: "UTC" },
        clientPlatform: { stringValue: "ios" },
        deviceId: { nullValue: null },
        sessionId: { stringValue: "session-api" },
        taskId: { nullValue: null },
        subjectMode: { stringValue: "work" },
        payloadVersion: { integerValue: "1" },
        properties: { mapValue: { fields: propertyFields as Record<string, never> } },
      },
    },
  };
}

test("daily summary endpoint returns dashboard-ready JSON", async () => {
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-project";
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
  process.env.FIREBASE_DATABASE_ID = "(default)";

  const restoreFetch = installFetchMock(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    assert.match(url, /:runQuery/);
    const query = JSON.parse(String(init?.body));
    assert.equal(query.structuredQuery.from[0].collectionId, "analyticsDailyMetrics");

    return createJsonResponse({
      json: [
        analyticsMetricDocument({
          userId: "user-api",
          dateLocal: "2026-03-21",
          focusMinutes: 95,
          sessionsStarted: 4,
          sessionsCompleted: 3,
          sessionCompletionRate: 75,
          averageCompletedSessionLength: 31.7,
          sessionsAbandoned: 1,
          taskCompletedCount: 2,
          streakActive: true,
          streakLengthEndOfDay: 6,
          averageSessionQualityScore: 81,
          dailyPerformanceScore: 82,
          dailyPerformanceBand: "high",
        }),
      ],
    });
  });

  try {
    const request = new NextRequest(
      "http://localhost/api/analytics/daily-summary?userId=user-api&date=2026-03-21",
      {
        headers: { authorization: "Bearer token-api" },
      },
    );

    const response = await getDailySummary(request);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.userId, "user-api");
    assert.equal(payload.summary.dailyPerformanceScore, 82);
    assert.equal(payload.summary.sessionCompletionRate, 75);
  } finally {
    restoreFetch();
  }
});

test("insights endpoint returns generated insights from metrics and session records", async () => {
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-project";
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
  process.env.FIREBASE_DATABASE_ID = "(default)";

  const restoreFetch = installFetchMock(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    assert.match(url, /:runQuery/);
    const query = JSON.parse(String(init?.body));
    const collectionId = query.structuredQuery.from[0].collectionId;

    if (collectionId === "analyticsDailyMetrics") {
      return createJsonResponse({
        json: [
          analyticsMetricDocument({
            userId: "user-api",
            dateLocal: "2026-03-10",
            focusMinutes: 70,
            sessionsStarted: 3,
            sessionsCompleted: 2,
            sessionCompletionRate: 66.7,
            averageCompletedSessionLength: 35,
            sessionsAbandoned: 1,
            taskCompletedCount: 1,
            streakActive: true,
            streakLengthEndOfDay: 4,
            averageSessionQualityScore: 74,
            dailyPerformanceScore: 60,
            dailyPerformanceBand: "steady",
          }),
          analyticsMetricDocument({
            userId: "user-api",
            dateLocal: "2026-03-17",
            focusMinutes: 120,
            sessionsStarted: 3,
            sessionsCompleted: 3,
            sessionCompletionRate: 100,
            averageCompletedSessionLength: 40,
            sessionsAbandoned: 0,
            taskCompletedCount: 3,
            streakActive: true,
            streakLengthEndOfDay: 7,
            averageSessionQualityScore: 87,
            dailyPerformanceScore: 88,
            dailyPerformanceBand: "high",
          }),
        ],
      });
    }

    if (collectionId === "analyticsEvents") {
      return createJsonResponse({
        json: [
          analyticsEventDocument({
            eventName: "session_completed",
            occurredAt: "2026-03-17T20:00:00.000Z",
            occurredDateLocal: "2026-03-17",
            durationMinutes: 50,
            qualityScore: 85,
          }),
          analyticsEventDocument({
            eventName: "session_completed",
            occurredAt: "2026-03-17T21:00:00.000Z",
            occurredDateLocal: "2026-03-17",
            durationMinutes: 45,
            qualityScore: 81,
          }),
          analyticsEventDocument({
            eventName: "session_completed",
            occurredAt: "2026-03-17T09:00:00.000Z",
            occurredDateLocal: "2026-03-17",
            durationMinutes: 25,
            qualityScore: 75,
          }),
          analyticsEventDocument({
            eventName: "session_completed",
            occurredAt: "2026-03-10T20:30:00.000Z",
            occurredDateLocal: "2026-03-10",
            durationMinutes: 45,
            qualityScore: 79,
          }),
        ],
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  try {
    const request = new NextRequest(
      "http://localhost/api/analytics/insights?userId=user-api&startDate=2026-03-10&endDate=2026-03-17&limit=6",
      {
        headers: { authorization: "Bearer token-api" },
      },
    );

    const response = await getInsightsFeed(request);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.userId, "user-api");
    assert.equal(payload.templateCount >= 10, true);
    assert.ok(Array.isArray(payload.insights));
  } finally {
    restoreFetch();
  }
});
