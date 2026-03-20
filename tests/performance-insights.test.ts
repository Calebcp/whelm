import test from "node:test";
import assert from "node:assert/strict";

import type { AnalyticsDailyMetricRecord } from "@/lib/analytics-aggregation";
import { generatePerformanceInsights } from "@/lib/performance-insights";

function metric(overrides: Partial<AnalyticsDailyMetricRecord>): AnalyticsDailyMetricRecord {
  return {
    userId: "user-insights",
    dateLocal: "2026-03-01",
    timezone: "UTC",
    updatedAtISO: "2026-03-21T00:00:00.000Z",
    focusMinutes: 0,
    sessionsStarted: 0,
    sessionsCompleted: 0,
    sessionCompletionRate: 0,
    averageCompletedSessionLength: 0,
    sessionsAbandoned: 0,
    taskCompletedCount: 0,
    streakActive: false,
    streakLengthEndOfDay: 0,
    averageSessionQualityScore: null,
    dailyPerformanceScore: 0,
    dailyPerformanceBand: "recovery",
    subjectBreakdown: {
      language: { focusMinutes: 0, sessionsCompleted: 0, tasksCompleted: 0 },
      school: { focusMinutes: 0, sessionsCompleted: 0, tasksCompleted: 0 },
      work: { focusMinutes: 0, sessionsCompleted: 0, tasksCompleted: 0 },
      general: { focusMinutes: 0, sessionsCompleted: 0, tasksCompleted: 0 },
    },
    ...overrides,
  };
}

test("generatePerformanceInsights surfaces real weekly changes and abandoned-session warnings", () => {
  const dailyMetrics = [
    metric({
      dateLocal: "2026-02-24",
      focusMinutes: 40,
      sessionsStarted: 3,
      sessionsCompleted: 2,
      sessionsAbandoned: 0,
      sessionCompletionRate: 66.7,
      dailyPerformanceScore: 56,
      dailyPerformanceBand: "steady",
    }),
    metric({
      dateLocal: "2026-02-25",
      focusMinutes: 20,
      sessionsStarted: 2,
      sessionsCompleted: 1,
      sessionsAbandoned: 1,
      sessionCompletionRate: 50,
      dailyPerformanceScore: 38,
      dailyPerformanceBand: "recovery",
    }),
    metric({
      dateLocal: "2026-03-02",
      focusMinutes: 45,
      sessionsStarted: 3,
      sessionsCompleted: 2,
      sessionCompletionRate: 66.7,
      dailyPerformanceScore: 58,
      dailyPerformanceBand: "steady",
    }),
    metric({
      dateLocal: "2026-03-03",
      focusMinutes: 35,
      sessionsStarted: 2,
      sessionsCompleted: 1,
      sessionsAbandoned: 1,
      sessionCompletionRate: 50,
      dailyPerformanceScore: 44,
      dailyPerformanceBand: "recovery",
    }),
    metric({
      dateLocal: "2026-03-04",
      focusMinutes: 50,
      sessionsStarted: 3,
      sessionsCompleted: 2,
      sessionCompletionRate: 66.7,
      dailyPerformanceScore: 60,
      dailyPerformanceBand: "steady",
    }),
    metric({
      dateLocal: "2026-03-05",
      focusMinutes: 25,
      sessionsStarted: 2,
      sessionsCompleted: 1,
      sessionsAbandoned: 0,
      sessionCompletionRate: 50,
      dailyPerformanceScore: 40,
      dailyPerformanceBand: "recovery",
    }),
    metric({
      dateLocal: "2026-03-10",
      focusMinutes: 80,
      sessionsStarted: 3,
      sessionsCompleted: 2,
      sessionCompletionRate: 66.7,
      dailyPerformanceScore: 72,
      dailyPerformanceBand: "steady",
    }),
    metric({
      dateLocal: "2026-03-11",
      focusMinutes: 75,
      sessionsStarted: 3,
      sessionsCompleted: 1,
      sessionsAbandoned: 2,
      sessionCompletionRate: 33.3,
      dailyPerformanceScore: 52,
      dailyPerformanceBand: "recovery",
    }),
    metric({
      dateLocal: "2026-03-12",
      focusMinutes: 90,
      sessionsStarted: 4,
      sessionsCompleted: 3,
      sessionsAbandoned: 2,
      taskCompletedCount: 3,
      sessionCompletionRate: 75,
      dailyPerformanceScore: 76,
      dailyPerformanceBand: "steady",
    }),
    metric({
      dateLocal: "2026-03-18",
      focusMinutes: 60,
      sessionsStarted: 3,
      sessionsCompleted: 3,
      sessionsAbandoned: 3,
      sessionCompletionRate: 100,
      dailyPerformanceScore: 70,
      dailyPerformanceBand: "steady",
    }),
    metric({
      dateLocal: "2026-03-19",
      focusMinutes: 95,
      sessionsStarted: 4,
      sessionsCompleted: 4,
      sessionsAbandoned: 2,
      taskCompletedCount: 3,
      sessionCompletionRate: 100,
      dailyPerformanceScore: 90,
      dailyPerformanceBand: "high",
    }),
    metric({
      dateLocal: "2026-03-20",
      focusMinutes: 85,
      sessionsStarted: 4,
      sessionsCompleted: 4,
      sessionsAbandoned: 2,
      taskCompletedCount: 2,
      sessionCompletionRate: 100,
      dailyPerformanceScore: 82,
      dailyPerformanceBand: "high",
    }),
  ];

  const sessionRecords = [
    { eventName: "session_completed" as const, occurredAtISO: "2026-03-10T20:10:00.000Z", timezone: "UTC", durationMinutes: 50, qualityScore: 62 },
    { eventName: "session_completed" as const, occurredAtISO: "2026-03-10T21:00:00.000Z", timezone: "UTC", durationMinutes: 45, qualityScore: 60 },
    { eventName: "session_completed" as const, occurredAtISO: "2026-03-12T20:30:00.000Z", timezone: "UTC", durationMinutes: 55, qualityScore: 59 },
    { eventName: "session_completed" as const, occurredAtISO: "2026-03-12T09:00:00.000Z", timezone: "UTC", durationMinutes: 25, qualityScore: 78 },
    { eventName: "session_completed" as const, occurredAtISO: "2026-03-18T08:30:00.000Z", timezone: "UTC", durationMinutes: 30, qualityScore: 80 },
    { eventName: "session_completed" as const, occurredAtISO: "2026-03-19T07:45:00.000Z", timezone: "UTC", durationMinutes: 35, qualityScore: 79 },
    { eventName: "session_completed" as const, occurredAtISO: "2026-03-12T10:00:00.000Z", timezone: "UTC", durationMinutes: 65, qualityScore: 58 },
    { eventName: "session_abandoned" as const, occurredAtISO: "2026-03-11T09:10:00.000Z", timezone: "UTC", durationMinutes: 5, qualityScore: 25 },
  ];

  const insights = generatePerformanceInsights({
    dailyMetrics,
    sessionRecords,
    limit: 10,
  });

  const types = insights.map((insight) => insight.type);
  assert.ok(types.includes("best_focus_window"));
  assert.ok(types.includes("completion_rate_improved"));
  assert.ok(types.includes("abandoned_sessions_up"));
  assert.ok(types.includes("focus_after_40_drop"));
});

test("generatePerformanceInsights stays quiet when usage is too sparse", () => {
  const insights = generatePerformanceInsights({
    dailyMetrics: [
      metric({
        dateLocal: "2026-03-20",
        focusMinutes: 10,
        sessionsStarted: 1,
        sessionsCompleted: 1,
        sessionCompletionRate: 100,
        dailyPerformanceScore: 28,
        dailyPerformanceBand: "recovery",
      }),
    ],
    sessionRecords: [],
    limit: 10,
  });

  assert.deepEqual(insights, []);
});
