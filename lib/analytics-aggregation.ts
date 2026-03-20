import type { NextRequest } from "next/server";

import type { AnalyticsSubjectMode } from "@/lib/analytics-events";

const SUBJECT_BREAKDOWN_KEYS = ["language", "school", "work", "general"] as const;

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
};

type RunQueryResponse = {
  document?: FirestoreDocument;
};

export type AnalyticsDailyMetricRecord = {
  userId: string;
  dateLocal: string;
  timezone: string;
  updatedAtISO: string;
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
  subjectBreakdown: Record<
    (typeof SUBJECT_BREAKDOWN_KEYS)[number],
    {
      focusMinutes: number;
      sessionsCompleted: number;
      tasksCompleted: number;
    }
  >;
};

type AnalyticsEventRecord = {
  eventId: string;
  eventName: string;
  userId: string;
  occurredAt: string;
  occurredDateLocal: string;
  clientTimezone: string;
  clientPlatform: string;
  deviceId: string | null;
  sessionId: string | null;
  taskId: string | null;
  subjectMode: AnalyticsSubjectMode | null;
  payloadVersion: number;
  properties: Record<string, string | number | boolean | null>;
};

type DailyMetricComputation = {
  userId: string;
  dateLocal: string;
  timezone: string;
  focusMinutes: number;
  sessionsStarted: number;
  sessionsCompleted: number;
  sessionsAbandoned: number;
  shortAbandonedSessions: number;
  averageCompletedSessionLength: number;
  taskCompletedCount: number;
  averageSessionQualityScore: number | null;
  streakActive: boolean;
  streakLengthEndOfDay: number;
  subjectBreakdown: AnalyticsDailyMetricRecord["subjectBreakdown"];
};

function requireConfig() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const databaseId = process.env.FIREBASE_DATABASE_ID?.trim() || "(default)";

  if (!projectId || !apiKey) {
    throw new Error("Missing Firebase environment variables on the server.");
  }

  return {
    apiKey,
    projectId,
    databaseId,
  };
}

function firestoreDocumentsBaseUrl() {
  const { projectId, databaseId } = requireConfig();
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
}

function getAuthHeader(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader : null;
}

function decodeFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("mapValue" in value) {
    const fields = value.mapValue.fields ?? {};
    return Object.fromEntries(
      Object.entries(fields).map(([key, nestedValue]) => [key, decodeFirestoreValue(nestedValue)]),
    );
  }

  return null;
}

function encodeFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (typeof value === "string") {
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

  throw new Error("Unsupported Firestore analytics value.");
}

function decodeAnalyticsEvent(document: FirestoreDocument): AnalyticsEventRecord | null {
  if (!document.fields) return null;

  const fields = document.fields;
  const properties = decodeFirestoreValue(fields.properties);

  return {
    eventId: String(decodeFirestoreValue(fields.eventId) ?? ""),
    eventName: String(decodeFirestoreValue(fields.eventName) ?? ""),
    userId: String(decodeFirestoreValue(fields.userId) ?? ""),
    occurredAt: String(decodeFirestoreValue(fields.occurredAt) ?? ""),
    occurredDateLocal: String(decodeFirestoreValue(fields.occurredDateLocal) ?? ""),
    clientTimezone: String(decodeFirestoreValue(fields.clientTimezone) ?? "UTC"),
    clientPlatform: String(decodeFirestoreValue(fields.clientPlatform) ?? "web"),
    deviceId: (decodeFirestoreValue(fields.deviceId) as string | null) ?? null,
    sessionId: (decodeFirestoreValue(fields.sessionId) as string | null) ?? null,
    taskId: (decodeFirestoreValue(fields.taskId) as string | null) ?? null,
    subjectMode: (decodeFirestoreValue(fields.subjectMode) as AnalyticsSubjectMode | null) ?? null,
    payloadVersion: Number(decodeFirestoreValue(fields.payloadVersion) ?? 1),
    properties:
      properties && typeof properties === "object" && !Array.isArray(properties)
        ? (properties as Record<string, string | number | boolean | null>)
        : {},
  };
}

async function runUserEventsQuery(authHeader: string, userId: string) {
  const { apiKey } = requireConfig();
  const baseUrl = firestoreDocumentsBaseUrl();

  const response = await fetch(`${baseUrl}:runQuery?key=${apiKey}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "analyticsEvents" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "userId" },
            op: "EQUAL",
            value: { stringValue: userId },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to query analytics events.");
  }

  const rows = (await response.json()) as RunQueryResponse[];
  return rows
    .map((row) => (row.document ? decodeAnalyticsEvent(row.document) : null))
    .filter((event): event is AnalyticsEventRecord => Boolean(event));
}

function emptySubjectBreakdown() {
  return {
    language: { focusMinutes: 0, sessionsCompleted: 0, tasksCompleted: 0 },
    school: { focusMinutes: 0, sessionsCompleted: 0, tasksCompleted: 0 },
    work: { focusMinutes: 0, sessionsCompleted: 0, tasksCompleted: 0 },
    general: { focusMinutes: 0, sessionsCompleted: 0, tasksCompleted: 0 },
  };
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function roundToWhole(value: number) {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hasActivity(metric: Pick<DailyMetricComputation, "focusMinutes" | "sessionsStarted" | "taskCompletedCount">) {
  return metric.focusMinutes > 0 || metric.sessionsStarted > 0 || metric.taskCompletedCount > 0;
}

function calculateDailyPerformanceScore(
  metric: DailyMetricComputation,
  recentMetrics: DailyMetricComputation[],
) {
  // Keep this score simple enough to explain in the product:
  // completion (30) + focus (25) + tasks (20) + quality (15) + consistency (10)
  // - abandoned session penalties, then clamp to 0..100.
  const completionPoints =
    metric.sessionsStarted > 0
      ? roundToWhole((metric.sessionsCompleted / metric.sessionsStarted) * 30)
      : 0;

  let focusPoints = 0;
  if (metric.focusMinutes >= 90) {
    focusPoints = 25;
  } else if (metric.focusMinutes >= 45) {
    focusPoints = 18;
  } else if (metric.focusMinutes >= 20) {
    focusPoints = 10;
  }

  let taskPoints = 0;
  if (metric.taskCompletedCount >= 3) {
    taskPoints = 20;
  } else if (metric.taskCompletedCount === 2) {
    taskPoints = 16;
  } else if (metric.taskCompletedCount === 1) {
    taskPoints = 10;
  }

  let qualityPoints = 0;
  if (metric.averageSessionQualityScore !== null) {
    if (metric.averageSessionQualityScore >= 85) {
      qualityPoints = 15;
    } else if (metric.averageSessionQualityScore >= 70) {
      qualityPoints = 11;
    } else if (metric.averageSessionQualityScore >= 55) {
      qualityPoints = 7;
    } else if (metric.averageSessionQualityScore > 0) {
      qualityPoints = 3;
    }
  }

  const activeRecentMetrics = recentMetrics.filter((entry) => hasActivity(entry));
  let consistencyPoints = 0;

  if (activeRecentMetrics.length === 0) {
    consistencyPoints = hasActivity(metric) ? 5 : 0;
  } else {
    const recentAverageFocusMinutes =
      activeRecentMetrics.reduce((sum, entry) => sum + entry.focusMinutes, 0) /
      activeRecentMetrics.length;

    if (recentAverageFocusMinutes <= 0) {
      consistencyPoints = hasActivity(metric) ? 5 : 0;
    } else {
      const focusRatio = metric.focusMinutes / recentAverageFocusMinutes;
      if (focusRatio >= 0.75 && focusRatio <= 1.25) {
        consistencyPoints = 10;
      } else if (focusRatio >= 0.5 && focusRatio <= 1.5) {
        consistencyPoints = 6;
      } else if (metric.focusMinutes > 0) {
        consistencyPoints = 3;
      }
    }
  }

  const abandonedPenalty = Math.min(metric.sessionsAbandoned * 6, 18);
  const shortFailedPenalty = Math.min(Math.max(metric.shortAbandonedSessions - 1, 0) * 3, 9);

  const rawScore =
    completionPoints +
    focusPoints +
    taskPoints +
    qualityPoints +
    consistencyPoints -
    abandonedPenalty -
    shortFailedPenalty;

  return clamp(roundToWhole(rawScore), 0, 100);
}

function performanceBandForScore(score: number): AnalyticsDailyMetricRecord["dailyPerformanceBand"] {
  if (score >= 80) return "high";
  if (score >= 55) return "steady";
  return "recovery";
}

function buildDailyMetricComputation(
  userId: string,
  dateLocal: string,
  events: AnalyticsEventRecord[],
): DailyMetricComputation {
  const dayEvents = events.filter((event) => event.occurredDateLocal === dateLocal);
  const streakEvents = events
    .filter(
      (event) =>
        event.eventName === "streak_updated" &&
        typeof event.properties.streakDate === "string" &&
        event.properties.streakDate === dateLocal,
    )
    .sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));

  const subjectBreakdown = emptySubjectBreakdown();
  let focusMinutes = 0;
  let sessionsStarted = 0;
  let sessionsCompleted = 0;
  let sessionsAbandoned = 0;
  let shortAbandonedSessions = 0;
  let completedSessionMinutes = 0;
  let taskCompletedCount = 0;
  const qualityScores: number[] = [];

  for (const event of dayEvents) {
    if (event.eventName === "session_started") {
      sessionsStarted += 1;
      continue;
    }

    if (event.eventName === "session_completed") {
      sessionsCompleted += 1;
      const duration = Number(event.properties.durationMinutes ?? 0);
      focusMinutes += duration;
      completedSessionMinutes += duration;
      if (typeof event.properties.qualityScore === "number") {
        qualityScores.push(event.properties.qualityScore);
      }

      const subject = event.subjectMode ?? "general";
      subjectBreakdown[subject].focusMinutes += duration;
      subjectBreakdown[subject].sessionsCompleted += 1;
      continue;
    }

    if (event.eventName === "session_abandoned") {
      sessionsAbandoned += 1;
      const elapsedMinutes = Number(event.properties.elapsedMinutes ?? 0);
      if (elapsedMinutes > 0 && elapsedMinutes < 10) {
        shortAbandonedSessions += 1;
      }
      if (typeof event.properties.qualityScore === "number") {
        qualityScores.push(event.properties.qualityScore);
      }
      continue;
    }

    if (event.eventName === "task_completed") {
      taskCompletedCount += 1;
      const subject = event.subjectMode ?? "general";
      subjectBreakdown[subject].tasksCompleted += 1;
    }
  }

  const latestStreakEvent = streakEvents[streakEvents.length - 1] ?? null;
  const streakLengthEndOfDay =
    latestStreakEvent && typeof latestStreakEvent.properties.newLength === "number"
      ? latestStreakEvent.properties.newLength
      : 0;

  return {
    userId,
    dateLocal,
    timezone: dayEvents[0]?.clientTimezone ?? latestStreakEvent?.clientTimezone ?? "UTC",
    focusMinutes,
    sessionsStarted,
    sessionsCompleted,
    averageCompletedSessionLength:
      sessionsCompleted > 0 ? roundToOneDecimal(completedSessionMinutes / sessionsCompleted) : 0,
    sessionsAbandoned,
    shortAbandonedSessions,
    taskCompletedCount,
    streakActive: streakLengthEndOfDay > 0,
    streakLengthEndOfDay,
    averageSessionQualityScore:
      qualityScores.length > 0
        ? roundToOneDecimal(qualityScores.reduce((sum, value) => sum + value, 0) / qualityScores.length)
        : null,
    subjectBreakdown,
  };
}

function buildDailyMetricRecord(
  metric: DailyMetricComputation,
  recentMetrics: DailyMetricComputation[],
): AnalyticsDailyMetricRecord {
  const dailyPerformanceScore = calculateDailyPerformanceScore(metric, recentMetrics);

  return {
    userId: metric.userId,
    dateLocal: metric.dateLocal,
    timezone: metric.timezone,
    updatedAtISO: new Date().toISOString(),
    focusMinutes: metric.focusMinutes,
    sessionsStarted: metric.sessionsStarted,
    sessionsCompleted: metric.sessionsCompleted,
    sessionCompletionRate:
      metric.sessionsStarted > 0
        ? roundToOneDecimal((metric.sessionsCompleted / metric.sessionsStarted) * 100)
        : 0,
    averageCompletedSessionLength: metric.averageCompletedSessionLength,
    sessionsAbandoned: metric.sessionsAbandoned,
    taskCompletedCount: metric.taskCompletedCount,
    streakActive: metric.streakActive,
    streakLengthEndOfDay: metric.streakLengthEndOfDay,
    averageSessionQualityScore: metric.averageSessionQualityScore,
    dailyPerformanceScore,
    dailyPerformanceBand: performanceBandForScore(dailyPerformanceScore),
    subjectBreakdown: metric.subjectBreakdown,
  };
}

async function persistDailyMetric(authHeader: string, metric: AnalyticsDailyMetricRecord) {
  const { apiKey } = requireConfig();
  const baseUrl = firestoreDocumentsBaseUrl();
  const docId = `${metric.userId}_${metric.dateLocal}`;

  const response = await fetch(`${baseUrl}/analyticsDailyMetrics/${encodeURIComponent(docId)}?key=${apiKey}`, {
    method: "PATCH",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      fields: {
        userId: encodeFirestoreValue(metric.userId),
        dateLocal: encodeFirestoreValue(metric.dateLocal),
        timezone: encodeFirestoreValue(metric.timezone),
        updatedAtISO: encodeFirestoreValue(metric.updatedAtISO),
        focusMinutes: encodeFirestoreValue(metric.focusMinutes),
        sessionsStarted: encodeFirestoreValue(metric.sessionsStarted),
        sessionsCompleted: encodeFirestoreValue(metric.sessionsCompleted),
        sessionCompletionRate: encodeFirestoreValue(metric.sessionCompletionRate),
        averageCompletedSessionLength: encodeFirestoreValue(metric.averageCompletedSessionLength),
        sessionsAbandoned: encodeFirestoreValue(metric.sessionsAbandoned),
        taskCompletedCount: encodeFirestoreValue(metric.taskCompletedCount),
        streakActive: encodeFirestoreValue(metric.streakActive),
        streakLengthEndOfDay: encodeFirestoreValue(metric.streakLengthEndOfDay),
        averageSessionQualityScore: encodeFirestoreValue(metric.averageSessionQualityScore),
        dailyPerformanceScore: encodeFirestoreValue(metric.dailyPerformanceScore),
        dailyPerformanceBand: encodeFirestoreValue(metric.dailyPerformanceBand),
        subjectBreakdown: encodeFirestoreValue(metric.subjectBreakdown),
      },
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to save analytics daily metrics.");
  }
}

export async function aggregateAnalyticsDailyMetrics(
  authHeader: string,
  userId: string,
  targetDates?: string[],
) {
  const allEvents = await runUserEventsQuery(authHeader, userId);
  const inferredDates = new Set<string>();

  allEvents.forEach((event) => {
    if (event.occurredDateLocal) {
      inferredDates.add(event.occurredDateLocal);
    }

    if (event.eventName === "streak_updated" && typeof event.properties.streakDate === "string") {
      inferredDates.add(event.properties.streakDate);
    }
  });

  const dates = [...new Set(targetDates && targetDates.length > 0 ? targetDates : [...inferredDates])]
    .filter(Boolean)
    .sort();
  const allRelevantDates = [...new Set([...inferredDates, ...dates])].sort();
  const dailyComputations = new Map(
    allRelevantDates.map((dateLocal) => [dateLocal, buildDailyMetricComputation(userId, dateLocal, allEvents)]),
  );

  const metrics: AnalyticsDailyMetricRecord[] = [];
  for (const dateLocal of dates) {
    const currentMetric = dailyComputations.get(dateLocal);
    if (!currentMetric) {
      continue;
    }

    const recentMetrics = allRelevantDates
      .filter((entryDate) => entryDate < dateLocal)
      .map((entryDate) => dailyComputations.get(entryDate))
      .filter((entry): entry is DailyMetricComputation => Boolean(entry))
      .slice(-7);

    const metric = buildDailyMetricRecord(currentMetric, recentMetrics);
    await persistDailyMetric(authHeader, metric);
    metrics.push(metric);
  }

  return metrics;
}

export function requireAnalyticsAuthHeader(request: NextRequest) {
  const authHeader = getAuthHeader(request);
  if (!authHeader) {
    throw new Error("Missing Firebase auth token.");
  }

  return authHeader;
}
