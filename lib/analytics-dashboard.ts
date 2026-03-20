import type { AnalyticsDailyMetricRecord } from "@/lib/analytics-aggregation";
import {
  PERFORMANCE_INSIGHT_TEMPLATES,
  type InsightSessionRecord,
  generatePerformanceInsights,
} from "@/lib/performance-insights";

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

type AnalyticsEventRecord = {
  eventName: string;
  occurredAt: string;
  occurredDateLocal: string;
  clientTimezone: string;
  userId: string;
  properties: Record<string, string | number | boolean | null>;
};

export type AnalyticsDateRange = {
  startDate: string;
  endDate: string;
};

type SubjectBreakdown = AnalyticsDailyMetricRecord["subjectBreakdown"];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_RANGE_DAYS = 28;
const MAX_RANGE_DAYS = 180;
const SUBJECT_KEYS = ["language", "school", "work", "general"] as const;

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

function decodeAnalyticsDailyMetric(document: FirestoreDocument): AnalyticsDailyMetricRecord | null {
  if (!document.fields) return null;
  const fields = document.fields;
  const subjectBreakdown = decodeFirestoreValue(fields.subjectBreakdown);
  const averageSessionQualityScore = decodeFirestoreValue(fields.averageSessionQualityScore);

  return {
    userId: String(decodeFirestoreValue(fields.userId) ?? ""),
    dateLocal: String(decodeFirestoreValue(fields.dateLocal) ?? ""),
    timezone: String(decodeFirestoreValue(fields.timezone) ?? "UTC"),
    updatedAtISO: String(decodeFirestoreValue(fields.updatedAtISO) ?? ""),
    focusMinutes: Number(decodeFirestoreValue(fields.focusMinutes) ?? 0),
    sessionsStarted: Number(decodeFirestoreValue(fields.sessionsStarted) ?? 0),
    sessionsCompleted: Number(decodeFirestoreValue(fields.sessionsCompleted) ?? 0),
    sessionCompletionRate: Number(decodeFirestoreValue(fields.sessionCompletionRate) ?? 0),
    averageCompletedSessionLength: Number(decodeFirestoreValue(fields.averageCompletedSessionLength) ?? 0),
    sessionsAbandoned: Number(decodeFirestoreValue(fields.sessionsAbandoned) ?? 0),
    taskCompletedCount: Number(decodeFirestoreValue(fields.taskCompletedCount) ?? 0),
    streakActive: Boolean(decodeFirestoreValue(fields.streakActive) ?? false),
    streakLengthEndOfDay: Number(decodeFirestoreValue(fields.streakLengthEndOfDay) ?? 0),
    averageSessionQualityScore:
      averageSessionQualityScore === null ? null : Number(averageSessionQualityScore ?? 0),
    dailyPerformanceScore: Number(decodeFirestoreValue(fields.dailyPerformanceScore) ?? 0),
    dailyPerformanceBand:
      (decodeFirestoreValue(fields.dailyPerformanceBand) as AnalyticsDailyMetricRecord["dailyPerformanceBand"]) ??
      "recovery",
    subjectBreakdown:
      subjectBreakdown && typeof subjectBreakdown === "object" && !Array.isArray(subjectBreakdown)
        ? (subjectBreakdown as AnalyticsDailyMetricRecord["subjectBreakdown"])
        : emptySubjectBreakdown(),
  };
}

function decodeAnalyticsEvent(document: FirestoreDocument): AnalyticsEventRecord | null {
  if (!document.fields) return null;
  const fields = document.fields;
  const properties = decodeFirestoreValue(fields.properties);

  return {
    eventName: String(decodeFirestoreValue(fields.eventName) ?? ""),
    occurredAt: String(decodeFirestoreValue(fields.occurredAt) ?? ""),
    occurredDateLocal: String(decodeFirestoreValue(fields.occurredDateLocal) ?? ""),
    clientTimezone: String(decodeFirestoreValue(fields.clientTimezone) ?? "UTC"),
    userId: String(decodeFirestoreValue(fields.userId) ?? ""),
    properties:
      properties && typeof properties === "object" && !Array.isArray(properties)
        ? (properties as Record<string, string | number | boolean | null>)
        : {},
  };
}

function compareByDateAsc(a: { dateLocal: string }, b: { dateLocal: string }) {
  if (a.dateLocal === b.dateLocal) return 0;
  return a.dateLocal < b.dateLocal ? -1 : 1;
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sumBy<T>(items: T[], selector: (item: T) => number) {
  return items.reduce((sum, item) => sum + selector(item), 0);
}

function hasActivity(metric: AnalyticsDailyMetricRecord) {
  return metric.focusMinutes > 0 || metric.sessionsStarted > 0 || metric.taskCompletedCount > 0;
}

function emptySubjectBreakdown(): SubjectBreakdown {
  return {
    language: { focusMinutes: 0, sessionsCompleted: 0, tasksCompleted: 0 },
    school: { focusMinutes: 0, sessionsCompleted: 0, tasksCompleted: 0 },
    work: { focusMinutes: 0, sessionsCompleted: 0, tasksCompleted: 0 },
    general: { focusMinutes: 0, sessionsCompleted: 0, tasksCompleted: 0 },
  };
}

function dateToKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateLocal: string, days: number) {
  const date = new Date(`${dateLocal}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateToKey(date);
}

function differenceInDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function getWeekStartDateKey(dateLocal: string) {
  const date = new Date(`${dateLocal}T00:00:00Z`);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + mondayOffset);
  return dateToKey(date);
}

function getUserScopedFilters(userId: string, startDate?: string, endDate?: string, dateField = "dateLocal") {
  const filters: object[] = [
    {
      fieldFilter: {
        field: { fieldPath: "userId" },
        op: "EQUAL",
        value: { stringValue: userId },
      },
    },
  ];

  if (startDate) {
    filters.push({
      fieldFilter: {
        field: { fieldPath: dateField },
        op: "GREATER_THAN_OR_EQUAL",
        value: { stringValue: startDate },
      },
    });
  }

  if (endDate) {
    filters.push({
      fieldFilter: {
        field: { fieldPath: dateField },
        op: "LESS_THAN_OR_EQUAL",
        value: { stringValue: endDate },
      },
    });
  }

  return filters.length === 1
    ? filters[0]
    : {
        compositeFilter: {
          op: "AND",
          filters,
        },
      };
}

async function runFirestoreQuery<T>({
  authHeader,
  collectionId,
  where,
  orderByField,
  decode,
}: {
  authHeader: string;
  collectionId: string;
  where: object;
  orderByField: string;
  decode: (document: FirestoreDocument) => T | null;
}) {
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
        from: [{ collectionId }],
        where,
        orderBy: [{ field: { fieldPath: orderByField }, direction: "ASCENDING" }],
      },
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to query Firestore.");
  }

  const rows = (await response.json()) as RunQueryResponse[];
  return rows
    .map((row) => (row.document ? decode(row.document) : null))
    .filter((entry): entry is T => Boolean(entry));
}

async function fetchDailyMetrics(authHeader: string, userId: string, range: AnalyticsDateRange) {
  const metrics = await runFirestoreQuery({
    authHeader,
    collectionId: "analyticsDailyMetrics",
    where: getUserScopedFilters(userId, range.startDate, range.endDate, "dateLocal"),
    orderByField: "dateLocal",
    decode: decodeAnalyticsDailyMetric,
  });

  return metrics.sort(compareByDateAsc);
}

async function fetchAnalyticsEvents(authHeader: string, userId: string, range: AnalyticsDateRange) {
  return runFirestoreQuery({
    authHeader,
    collectionId: "analyticsEvents",
    where: getUserScopedFilters(userId, range.startDate, range.endDate, "occurredDateLocal"),
    orderByField: "occurredDateLocal",
    decode: decodeAnalyticsEvent,
  });
}

function buildSubjectBreakdown(metrics: AnalyticsDailyMetricRecord[]) {
  return metrics.reduce((totals, metric) => {
    SUBJECT_KEYS.forEach((subject) => {
      totals[subject].focusMinutes += metric.subjectBreakdown[subject].focusMinutes;
      totals[subject].sessionsCompleted += metric.subjectBreakdown[subject].sessionsCompleted;
      totals[subject].tasksCompleted += metric.subjectBreakdown[subject].tasksCompleted;
    });
    return totals;
  }, emptySubjectBreakdown());
}

function groupMetricsByWeek(metrics: AnalyticsDailyMetricRecord[]) {
  const weeks = new Map<string, AnalyticsDailyMetricRecord[]>();

  for (const metric of metrics) {
    const weekStart = getWeekStartDateKey(metric.dateLocal);
    const list = weeks.get(weekStart) ?? [];
    list.push(metric);
    weeks.set(weekStart, list);
  }

  return [...weeks.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([weekStart, weekMetrics]) => ({
      weekStart,
      weekEnd: addDays(weekStart, 6),
      metrics: weekMetrics.sort(compareByDateAsc),
    }));
}

export function normalizeDateRange(
  startDate?: string | null,
  endDate?: string | null,
  defaultDays = DEFAULT_RANGE_DAYS,
) {
  const today = dateToKey(new Date());
  const resolvedEnd = endDate ?? today;
  const resolvedStart = startDate ?? addDays(resolvedEnd, -(defaultDays - 1));

  if (!DATE_PATTERN.test(resolvedStart) || !DATE_PATTERN.test(resolvedEnd)) {
    throw new Error("Dates must use YYYY-MM-DD format.");
  }

  if (resolvedStart > resolvedEnd) {
    throw new Error("startDate must be on or before endDate.");
  }

  if (differenceInDays(resolvedStart, resolvedEnd) + 1 > MAX_RANGE_DAYS) {
    throw new Error(`Date range cannot exceed ${MAX_RANGE_DAYS} days.`);
  }

  return {
    startDate: resolvedStart,
    endDate: resolvedEnd,
  };
}

export function normalizeWeekStart(weekStart?: string | null) {
  const value = weekStart ?? getWeekStartDateKey(dateToKey(new Date()));
  if (!DATE_PATTERN.test(value)) {
    throw new Error("weekStart must use YYYY-MM-DD format.");
  }

  return value;
}

export function parsePositiveInt(value: string | null, fallback: number, max = 20) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Numeric query parameter must be a positive integer.");
  }
  return Math.min(parsed, max);
}

export function getUserIdParam(input: URLSearchParams) {
  const userId = input.get("userId") ?? input.get("uid");
  if (!userId) {
    throw new Error("Missing userId.");
  }
  return userId;
}

export async function getDailySummary(authHeader: string, userId: string, date: string) {
  const metrics = await fetchDailyMetrics(authHeader, userId, { startDate: date, endDate: date });
  const summary = metrics[0] ?? null;

  return {
    userId,
    date,
    summary,
  };
}

export async function getWeeklySummary(authHeader: string, userId: string, weekStart: string) {
  const range = { startDate: weekStart, endDate: addDays(weekStart, 6) };
  const metrics = await fetchDailyMetrics(authHeader, userId, range);
  const activeDays = metrics.filter(hasActivity).length;
  const subjectBreakdown = buildSubjectBreakdown(metrics);
  const qualityScores = metrics
    .map((metric) => metric.averageSessionQualityScore)
    .filter((value): value is number => value !== null);

  return {
    userId,
    weekStart,
    weekEnd: range.endDate,
    summary: {
      daysCaptured: metrics.length,
      activeDays,
      totals: {
        focusMinutes: sumBy(metrics, (metric) => metric.focusMinutes),
        sessionsStarted: sumBy(metrics, (metric) => metric.sessionsStarted),
        sessionsCompleted: sumBy(metrics, (metric) => metric.sessionsCompleted),
        sessionsAbandoned: sumBy(metrics, (metric) => metric.sessionsAbandoned),
        tasksCompleted: sumBy(metrics, (metric) => metric.taskCompletedCount),
      },
      averages: {
        dailyPerformanceScore: roundToOneDecimal(average(metrics.map((metric) => metric.dailyPerformanceScore))),
        completionRate: roundToOneDecimal(average(metrics.map((metric) => metric.sessionCompletionRate))),
        completedSessionLength: roundToOneDecimal(
          average(metrics.map((metric) => metric.averageCompletedSessionLength)),
        ),
        sessionQualityScore: qualityScores.length > 0 ? roundToOneDecimal(average(qualityScores)) : null,
      },
      performanceBands: {
        high: metrics.filter((metric) => metric.dailyPerformanceBand === "high").length,
        steady: metrics.filter((metric) => metric.dailyPerformanceBand === "steady").length,
        recovery: metrics.filter((metric) => metric.dailyPerformanceBand === "recovery").length,
      },
      streak: {
        active: metrics.some((metric) => metric.streakActive),
        longestAtEndOfDay: metrics.reduce((max, metric) => Math.max(max, metric.streakLengthEndOfDay), 0),
      },
      subjectBreakdown,
      days: metrics,
    },
  };
}

export async function getPerformanceScoreHistory(
  authHeader: string,
  userId: string,
  range: AnalyticsDateRange,
) {
  const metrics = await fetchDailyMetrics(authHeader, userId, range);

  return {
    userId,
    startDate: range.startDate,
    endDate: range.endDate,
    history: metrics.map((metric) => ({
      date: metric.dateLocal,
      score: metric.dailyPerformanceScore,
      band: metric.dailyPerformanceBand,
      focusMinutes: metric.focusMinutes,
      completionRate: metric.sessionCompletionRate,
    })),
  };
}

export async function getFocusTrends(
  authHeader: string,
  userId: string,
  range: AnalyticsDateRange,
  groupBy: "day" | "week",
) {
  const metrics = await fetchDailyMetrics(authHeader, userId, range);

  if (groupBy === "day") {
    return {
      userId,
      startDate: range.startDate,
      endDate: range.endDate,
      groupBy,
      trend: metrics.map((metric) => ({
        periodStart: metric.dateLocal,
        periodEnd: metric.dateLocal,
        focusMinutes: metric.focusMinutes,
        sessionsCompleted: metric.sessionsCompleted,
        averageCompletedSessionLength: metric.averageCompletedSessionLength,
      })),
    };
  }

  return {
    userId,
    startDate: range.startDate,
    endDate: range.endDate,
    groupBy,
    trend: groupMetricsByWeek(metrics).map((week) => ({
      periodStart: week.weekStart,
      periodEnd: week.weekEnd,
      focusMinutes: sumBy(week.metrics, (metric) => metric.focusMinutes),
      sessionsCompleted: sumBy(week.metrics, (metric) => metric.sessionsCompleted),
      averageCompletedSessionLength: roundToOneDecimal(
        average(week.metrics.map((metric) => metric.averageCompletedSessionLength)),
      ),
    })),
  };
}

export async function getBestFocusHours(
  authHeader: string,
  userId: string,
  range: AnalyticsDateRange,
) {
  const events = await fetchAnalyticsEvents(authHeader, userId, range);
  const completedSessions = events.filter((event) => event.eventName === "session_completed");
  const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    focusMinutes: 0,
    completedSessions: 0,
  }));

  for (const event of completedSessions) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: event.clientTimezone,
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date(event.occurredAt));
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const durationMinutes = Number(event.properties.durationMinutes ?? 0);

    hourBuckets[hour].focusMinutes += durationMinutes;
    hourBuckets[hour].completedSessions += 1;
  }

  const totalFocusMinutes = hourBuckets.reduce((sum, bucket) => sum + bucket.focusMinutes, 0);
  const rankedHours = [...hourBuckets]
    .filter((bucket) => bucket.focusMinutes > 0)
    .sort((a, b) => b.focusMinutes - a.focusMinutes)
    .map((bucket) => ({
      ...bucket,
      sharePercent: totalFocusMinutes > 0 ? roundToOneDecimal((bucket.focusMinutes / totalFocusMinutes) * 100) : 0,
      averageSessionLength:
        bucket.completedSessions > 0 ? roundToOneDecimal(bucket.focusMinutes / bucket.completedSessions) : 0,
    }));

  const twoHourWindows = Array.from({ length: 23 }, (_, startHour) => {
    const first = hourBuckets[startHour];
    const second = hourBuckets[startHour + 1];
    return {
      startHour,
      endHour: startHour + 2,
      focusMinutes: first.focusMinutes + second.focusMinutes,
    };
  }).sort((a, b) => b.focusMinutes - a.focusMinutes);

  const bestWindow = twoHourWindows[0] ?? null;

  return {
    userId,
    startDate: range.startDate,
    endDate: range.endDate,
    totalCompletedSessions: completedSessions.length,
    bestWindow: bestWindow
      ? {
          startHour: bestWindow.startHour,
          endHour: bestWindow.endHour,
          label: `${bestWindow.startHour}:00-${bestWindow.endHour}:00`,
          focusMinutes: bestWindow.focusMinutes,
          sharePercent:
            totalFocusMinutes > 0 ? roundToOneDecimal((bestWindow.focusMinutes / totalFocusMinutes) * 100) : 0,
        }
      : null,
    hours: rankedHours,
  };
}

export async function getSessionCompletionAnalytics(
  authHeader: string,
  userId: string,
  range: AnalyticsDateRange,
) {
  const metrics = await fetchDailyMetrics(authHeader, userId, range);
  const sessionsStarted = sumBy(metrics, (metric) => metric.sessionsStarted);
  const sessionsCompleted = sumBy(metrics, (metric) => metric.sessionsCompleted);
  const sessionsAbandoned = sumBy(metrics, (metric) => metric.sessionsAbandoned);

  return {
    userId,
    startDate: range.startDate,
    endDate: range.endDate,
    summary: {
      sessionsStarted,
      sessionsCompleted,
      sessionsAbandoned,
      completionRate:
        sessionsStarted > 0 ? roundToOneDecimal((sessionsCompleted / sessionsStarted) * 100) : 0,
      abandonmentRate:
        sessionsStarted > 0 ? roundToOneDecimal((sessionsAbandoned / sessionsStarted) * 100) : 0,
    },
    daily: metrics.map((metric) => ({
      date: metric.dateLocal,
      sessionsStarted: metric.sessionsStarted,
      sessionsCompleted: metric.sessionsCompleted,
      sessionsAbandoned: metric.sessionsAbandoned,
      completionRate: metric.sessionCompletionRate,
    })),
  };
}

export async function getUserInsightsFeed(
  authHeader: string,
  userId: string,
  range: AnalyticsDateRange,
  limit: number,
) {
  const [metrics, events] = await Promise.all([
    fetchDailyMetrics(authHeader, userId, range),
    fetchAnalyticsEvents(authHeader, userId, range),
  ]);

  const sessionRecords: InsightSessionRecord[] = events
    .filter((event) => event.eventName === "session_completed" || event.eventName === "session_abandoned")
    .map((event) => ({
      eventName: event.eventName as InsightSessionRecord["eventName"],
      occurredAtISO: event.occurredAt,
      timezone: event.clientTimezone,
      durationMinutes:
        event.eventName === "session_completed"
          ? Number(event.properties.durationMinutes ?? 0)
          : Number(event.properties.elapsedMinutes ?? 0),
      qualityScore:
        typeof event.properties.qualityScore === "number" ? event.properties.qualityScore : null,
    }));

  return {
    userId,
    startDate: range.startDate,
    endDate: range.endDate,
    templateCount: PERFORMANCE_INSIGHT_TEMPLATES.length,
    insights: generatePerformanceInsights({
      dailyMetrics: metrics,
      sessionRecords,
      limit,
    }),
  };
}
