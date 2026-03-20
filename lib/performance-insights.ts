import type { AnalyticsDailyMetricRecord } from "@/lib/analytics-aggregation";

export type InsightType =
  | "best_focus_window"
  | "completion_rate_improved"
  | "completion_rate_declined"
  | "weekday_consistency"
  | "weekend_consistency"
  | "focus_after_40_drop"
  | "abandoned_sessions_up"
  | "short_failed_sessions_up"
  | "task_completion_improved"
  | "quality_improved"
  | "strongest_day"
  | "most_reliable_day"
  | "high_performance_days_up";

export type InsightTone = "positive" | "neutral" | "warning";

export type PerformanceInsight = {
  type: InsightType;
  tone: InsightTone;
  title: string;
  body: string;
};

export type InsightSessionRecord = {
  eventName: "session_completed" | "session_abandoned";
  occurredAtISO: string;
  timezone: string;
  durationMinutes: number;
  qualityScore: number | null;
};

export type GeneratePerformanceInsightsInput = {
  dailyMetrics: AnalyticsDailyMetricRecord[];
  sessionRecords?: InsightSessionRecord[];
  limit?: number;
};

type WeekSummary = {
  metrics: AnalyticsDailyMetricRecord[];
  days: number;
  activeDays: number;
  totalFocusMinutes: number;
  totalTasksCompleted: number;
  totalSessionsStarted: number;
  totalSessionsCompleted: number;
  totalSessionsAbandoned: number;
  totalPerformanceScore: number;
  averagePerformanceScore: number;
  averageCompletionRate: number;
  averageSessionQualityScore: number | null;
  highPerformanceDays: number;
  shortFailedDays: number;
};

type InsightDetector = (context: InsightContext) => PerformanceInsight | null;

type InsightContext = {
  sortedMetrics: AnalyticsDailyMetricRecord[];
  currentWeek: WeekSummary | null;
  previousWeek: WeekSummary | null;
  trailingWeeks: WeekSummary[];
  sessionRecords: InsightSessionRecord[];
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const TWO_HOUR_WINDOWS = [
  { startHour: 6, endHour: 8 },
  { startHour: 8, endHour: 10 },
  { startHour: 10, endHour: 12 },
  { startHour: 12, endHour: 14 },
  { startHour: 14, endHour: 16 },
  { startHour: 16, endHour: 18 },
  { startHour: 18, endHour: 20 },
  { startHour: 20, endHour: 22 },
  { startHour: 22, endHour: 24 },
] as const;

function round(value: number) {
  return Math.round(value);
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageNullable(values: Array<number | null>) {
  const present = values.filter((value): value is number => value !== null);
  return present.length > 0 ? average(present) : null;
}

function sampleVariance(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return average(values.map((value) => (value - mean) ** 2));
}

function compareByDateAsc(a: AnalyticsDailyMetricRecord, b: AnalyticsDailyMetricRecord) {
  return a.dateLocal < b.dateLocal ? -1 : 1;
}

function hasActivity(metric: AnalyticsDailyMetricRecord) {
  return metric.focusMinutes > 0 || metric.sessionsStarted > 0 || metric.taskCompletedCount > 0;
}

function getWeekStartDateKey(dateLocal: string) {
  const date = new Date(`${dateLocal}T00:00:00Z`);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}

function dayOfWeekFromDateKey(dateLocal: string) {
  const date = new Date(`${dateLocal}T00:00:00Z`);
  return date.getUTCDay();
}

function formatWindowLabel(startHour: number, endHour: number) {
  const formatHour = (hour: number) => {
    const normalized = hour === 24 ? 12 : hour % 12 === 0 ? 12 : hour % 12;
    const suffix = hour >= 12 && hour < 24 ? "PM" : "AM";
    return `${normalized} ${suffix}`;
  };

  return `${formatHour(startHour)} and ${formatHour(endHour)}`;
}

function chunkWeeks(metrics: AnalyticsDailyMetricRecord[]) {
  const byWeek = new Map<string, AnalyticsDailyMetricRecord[]>();

  for (const metric of metrics) {
    const weekKey = getWeekStartDateKey(metric.dateLocal);
    const list = byWeek.get(weekKey) ?? [];
    list.push(metric);
    byWeek.set(weekKey, list);
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, weekMetrics]) => weekMetrics.sort(compareByDateAsc));
}

function summarizeWeek(metrics: AnalyticsDailyMetricRecord[]): WeekSummary {
  const activeMetrics = metrics.filter(hasActivity);

  return {
    metrics,
    days: metrics.length,
    activeDays: activeMetrics.length,
    totalFocusMinutes: metrics.reduce((sum, metric) => sum + metric.focusMinutes, 0),
    totalTasksCompleted: metrics.reduce((sum, metric) => sum + metric.taskCompletedCount, 0),
    totalSessionsStarted: metrics.reduce((sum, metric) => sum + metric.sessionsStarted, 0),
    totalSessionsCompleted: metrics.reduce((sum, metric) => sum + metric.sessionsCompleted, 0),
    totalSessionsAbandoned: metrics.reduce((sum, metric) => sum + metric.sessionsAbandoned, 0),
    totalPerformanceScore: metrics.reduce((sum, metric) => sum + metric.dailyPerformanceScore, 0),
    averagePerformanceScore: roundToOneDecimal(average(metrics.map((metric) => metric.dailyPerformanceScore))),
    averageCompletionRate: roundToOneDecimal(average(metrics.map((metric) => metric.sessionCompletionRate))),
    averageSessionQualityScore: averageNullable(metrics.map((metric) => metric.averageSessionQualityScore)),
    highPerformanceDays: metrics.filter((metric) => metric.dailyPerformanceBand === "high").length,
    shortFailedDays: metrics.filter((metric) => metric.sessionsAbandoned >= 2).length,
  };
}

function getLocalHour(occurredAtISO: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date(occurredAtISO));

  const hourPart = parts.find((part) => part.type === "hour")?.value ?? "00";
  return Number(hourPart);
}

function bestFocusWindowDetector(context: InsightContext): PerformanceInsight | null {
  const completedSessions = context.sessionRecords.filter((record) => record.eventName === "session_completed");
  if (completedSessions.length < 4) return null;

  const windowTotals = TWO_HOUR_WINDOWS.map((window) => ({
    ...window,
    focusMinutes: completedSessions
      .filter((record) => {
        const hour = getLocalHour(record.occurredAtISO, record.timezone);
        return hour >= window.startHour && hour < window.endHour;
      })
      .reduce((sum, record) => sum + record.durationMinutes, 0),
  }));

  const bestWindow = [...windowTotals].sort((a, b) => b.focusMinutes - a.focusMinutes)[0];
  const totalFocus = completedSessions.reduce((sum, record) => sum + record.durationMinutes, 0);

  if (!bestWindow || bestWindow.focusMinutes < 90 || totalFocus <= 0) return null;
  if (bestWindow.focusMinutes / totalFocus < 0.35) return null;

  return {
    type: "best_focus_window",
    tone: "positive",
    title: "Best focus window",
    body: `You focus best between ${formatWindowLabel(bestWindow.startHour, bestWindow.endHour)}.`,
  };
}

function completionRateImprovedDetector(context: InsightContext): PerformanceInsight | null {
  const { currentWeek, previousWeek } = context;
  if (!currentWeek || !previousWeek) return null;
  if (currentWeek.totalSessionsStarted < 4 || previousWeek.totalSessionsStarted < 4) return null;

  const improvement = currentWeek.averageCompletionRate - previousWeek.averageCompletionRate;
  if (improvement < 10) return null;

  return {
    type: "completion_rate_improved",
    tone: "positive",
    title: "Completion rate improved",
    body: `Your completion rate improved this week, up ${round(improvement)} points from last week.`,
  };
}

function completionRateDeclinedDetector(context: InsightContext): PerformanceInsight | null {
  const { currentWeek, previousWeek } = context;
  if (!currentWeek || !previousWeek) return null;
  if (currentWeek.totalSessionsStarted < 4 || previousWeek.totalSessionsStarted < 4) return null;

  const decline = previousWeek.averageCompletionRate - currentWeek.averageCompletionRate;
  if (decline < 10) return null;

  return {
    type: "completion_rate_declined",
    tone: "warning",
    title: "Completion rate slipped",
    body: `Your completion rate fell ${round(decline)} points this week compared with last week.`,
  };
}

function weekdayConsistencyDetector(context: InsightContext): PerformanceInsight | null {
  const activeMetrics = context.sortedMetrics.filter(hasActivity);
  const weekdayScores = activeMetrics
    .filter((metric) => {
      const day = dayOfWeekFromDateKey(metric.dateLocal);
      return day >= 1 && day <= 5;
    })
    .map((metric) => metric.dailyPerformanceScore);
  const weekendScores = activeMetrics
    .filter((metric) => {
      const day = dayOfWeekFromDateKey(metric.dateLocal);
      return day === 0 || day === 6;
    })
    .map((metric) => metric.dailyPerformanceScore);

  if (weekdayScores.length < 3 || weekendScores.length < 2) return null;

  const weekdayVariance = sampleVariance(weekdayScores);
  const weekendVariance = sampleVariance(weekendScores);

  if (weekendVariance - weekdayVariance < 120) return null;

  return {
    type: "weekday_consistency",
    tone: "neutral",
    title: "Weekday consistency",
    body: "You are more consistent on weekdays than weekends.",
  };
}

function weekendConsistencyDetector(context: InsightContext): PerformanceInsight | null {
  const activeMetrics = context.sortedMetrics.filter(hasActivity);
  const weekdayScores = activeMetrics
    .filter((metric) => {
      const day = dayOfWeekFromDateKey(metric.dateLocal);
      return day >= 1 && day <= 5;
    })
    .map((metric) => metric.dailyPerformanceScore);
  const weekendScores = activeMetrics
    .filter((metric) => {
      const day = dayOfWeekFromDateKey(metric.dateLocal);
      return day === 0 || day === 6;
    })
    .map((metric) => metric.dailyPerformanceScore);

  if (weekdayScores.length < 3 || weekendScores.length < 2) return null;

  const weekdayVariance = sampleVariance(weekdayScores);
  const weekendVariance = sampleVariance(weekendScores);

  if (weekdayVariance - weekendVariance < 120) return null;

  return {
    type: "weekend_consistency",
    tone: "neutral",
    title: "Weekend consistency",
    body: "You are more consistent on weekends than weekdays.",
  };
}

function focusAfter40DropDetector(context: InsightContext): PerformanceInsight | null {
  const completedSessions = context.sessionRecords.filter((record) => record.eventName === "session_completed");
  const shortSessions = completedSessions.filter(
    (record) => record.durationMinutes >= 20 && record.durationMinutes <= 40 && record.qualityScore !== null,
  );
  const longSessions = completedSessions.filter(
    (record) => record.durationMinutes > 40 && record.qualityScore !== null,
  );

  if (shortSessions.length < 3 || longSessions.length < 3) return null;

  const shortQuality = average(shortSessions.map((record) => record.qualityScore ?? 0));
  const longQuality = average(longSessions.map((record) => record.qualityScore ?? 0));

  if (shortQuality - longQuality < 12) return null;

  return {
    type: "focus_after_40_drop",
    tone: "warning",
    title: "Long sessions lose quality",
    body: "Your focus quality tends to drop after 40 minutes.",
  };
}

function abandonedSessionsUpDetector(context: InsightContext): PerformanceInsight | null {
  const { currentWeek, trailingWeeks } = context;
  if (!currentWeek || trailingWeeks.length < 2) return null;

  const baselineWeeks = trailingWeeks.slice(-4, -1);
  if (baselineWeeks.length < 2) return null;

  const baselineAverage = average(baselineWeeks.map((week) => week.totalSessionsAbandoned));
  if (currentWeek.totalSessionsAbandoned < baselineAverage + 2) return null;

  return {
    type: "abandoned_sessions_up",
    tone: "warning",
    title: "Abandoned sessions are up",
    body: `You had more abandoned sessions this week than usual, up from about ${round(
      baselineAverage,
    )} to ${currentWeek.totalSessionsAbandoned}.`,
  };
}

function shortFailedSessionsUpDetector(context: InsightContext): PerformanceInsight | null {
  const { currentWeek, trailingWeeks } = context;
  if (!currentWeek || trailingWeeks.length < 2) return null;

  const weekShortFailures = (week: WeekSummary) =>
    week.metrics.filter((metric) => metric.sessionsAbandoned >= 2 && metric.focusMinutes < 30).length;
  const baselineWeeks = trailingWeeks.slice(-4, -1);
  if (baselineWeeks.length < 2) return null;

  const currentShortFailures = weekShortFailures(currentWeek);
  const baselineAverage = average(baselineWeeks.map(weekShortFailures));
  if (currentShortFailures < baselineAverage + 1.5 || currentShortFailures < 2) return null;

  return {
    type: "short_failed_sessions_up",
    tone: "warning",
    title: "Too many short failed starts",
    body: "You had more short failed sessions this week than your recent pattern.",
  };
}

function taskCompletionImprovedDetector(context: InsightContext): PerformanceInsight | null {
  const { currentWeek, previousWeek } = context;
  if (!currentWeek || !previousWeek) return null;
  if (currentWeek.totalTasksCompleted < previousWeek.totalTasksCompleted + 2) return null;

  return {
    type: "task_completion_improved",
    tone: "positive",
    title: "Task completion improved",
    body: `You completed ${currentWeek.totalTasksCompleted} tasks this week, up from ${previousWeek.totalTasksCompleted} last week.`,
  };
}

function qualityImprovedDetector(context: InsightContext): PerformanceInsight | null {
  const { currentWeek, previousWeek } = context;
  if (!currentWeek || !previousWeek) return null;
  if (currentWeek.averageSessionQualityScore === null || previousWeek.averageSessionQualityScore === null) return null;

  const improvement = currentWeek.averageSessionQualityScore - previousWeek.averageSessionQualityScore;
  if (improvement < 8) return null;

  return {
    type: "quality_improved",
    tone: "positive",
    title: "Session quality improved",
    body: `Your average session quality improved by ${round(improvement)} points this week.`,
  };
}

function strongestDayDetector(context: InsightContext): PerformanceInsight | null {
  const byDay = new Map<number, AnalyticsDailyMetricRecord[]>();

  for (const metric of context.sortedMetrics.filter(hasActivity)) {
    const day = dayOfWeekFromDateKey(metric.dateLocal);
    const list = byDay.get(day) ?? [];
    list.push(metric);
    byDay.set(day, list);
  }

  const ranked = [...byDay.entries()]
    .filter(([, metrics]) => metrics.length >= 2)
    .map(([day, metrics]) => ({
      day,
      averageFocus: average(metrics.map((metric) => metric.focusMinutes)),
    }))
    .sort((a, b) => b.averageFocus - a.averageFocus);

  if (ranked.length < 2) return null;
  if (ranked[0].averageFocus - ranked[1].averageFocus < 20) return null;

  return {
    type: "strongest_day",
    tone: "positive",
    title: "Strongest day",
    body: `${DAY_NAMES[ranked[0].day]} is usually your strongest focus day.`,
  };
}

function mostReliableDayDetector(context: InsightContext): PerformanceInsight | null {
  const byDay = new Map<number, AnalyticsDailyMetricRecord[]>();

  for (const metric of context.sortedMetrics.filter(hasActivity)) {
    const day = dayOfWeekFromDateKey(metric.dateLocal);
    const list = byDay.get(day) ?? [];
    list.push(metric);
    byDay.set(day, list);
  }

  const ranked = [...byDay.entries()]
    .filter(([, metrics]) => metrics.length >= 2)
    .map(([day, metrics]) => ({
      day,
      completionRate: average(metrics.map((metric) => metric.sessionCompletionRate)),
    }))
    .sort((a, b) => b.completionRate - a.completionRate);

  if (ranked.length < 2) return null;
  if (ranked[0].completionRate - ranked[1].completionRate < 10) return null;

  return {
    type: "most_reliable_day",
    tone: "neutral",
    title: "Most reliable day",
    body: `${DAY_NAMES[ranked[0].day]} is the day you are most likely to finish what you start.`,
  };
}

function highPerformanceDaysUpDetector(context: InsightContext): PerformanceInsight | null {
  const { currentWeek, previousWeek } = context;
  if (!currentWeek || !previousWeek) return null;
  if (currentWeek.highPerformanceDays < previousWeek.highPerformanceDays + 2) return null;

  return {
    type: "high_performance_days_up",
    tone: "positive",
    title: "More strong days",
    body: `You had ${currentWeek.highPerformanceDays} high-performance days this week, up from ${previousWeek.highPerformanceDays} last week.`,
  };
}

const INSIGHT_DETECTORS: InsightDetector[] = [
  bestFocusWindowDetector,
  completionRateImprovedDetector,
  completionRateDeclinedDetector,
  weekdayConsistencyDetector,
  weekendConsistencyDetector,
  focusAfter40DropDetector,
  abandonedSessionsUpDetector,
  shortFailedSessionsUpDetector,
  taskCompletionImprovedDetector,
  qualityImprovedDetector,
  strongestDayDetector,
  mostReliableDayDetector,
  highPerformanceDaysUpDetector,
];

export function generatePerformanceInsights(
  input: GeneratePerformanceInsightsInput,
): PerformanceInsight[] {
  const sortedMetrics = [...input.dailyMetrics].sort(compareByDateAsc);
  const weeklyChunks = chunkWeeks(sortedMetrics);
  const trailingWeeks = weeklyChunks.map(summarizeWeek);
  const currentWeek = trailingWeeks[trailingWeeks.length - 1] ?? null;
  const previousWeek = trailingWeeks[trailingWeeks.length - 2] ?? null;
  const context: InsightContext = {
    sortedMetrics,
    currentWeek,
    previousWeek,
    trailingWeeks,
    sessionRecords: input.sessionRecords ?? [],
  };

  const insights = INSIGHT_DETECTORS.map((detector) => detector(context)).filter(
    (insight): insight is PerformanceInsight => Boolean(insight),
  );

  const deduped = insights.filter(
    (insight, index) => insights.findIndex((candidate) => candidate.type === insight.type) === index,
  );

  return deduped.slice(0, input.limit ?? 6);
}

export const PERFORMANCE_INSIGHT_TEMPLATES: Array<{
  type: InsightType;
  condition: string;
  template: string;
}> = [
  {
    type: "best_focus_window",
    condition: "A two-hour local time window contains at least 35% of completed-session focus and at least 90 total minutes.",
    template: "You focus best between 8 PM and 10 PM.",
  },
  {
    type: "completion_rate_improved",
    condition: "This week's average completion rate is at least 10 points higher than last week's, with enough sessions in both weeks.",
    template: "Your completion rate improved this week, up 14 points from last week.",
  },
  {
    type: "completion_rate_declined",
    condition: "This week's average completion rate is at least 10 points lower than last week's.",
    template: "Your completion rate fell 12 points this week compared with last week.",
  },
  {
    type: "weekday_consistency",
    condition: "Daily performance score varies much less on weekdays than weekends.",
    template: "You are more consistent on weekdays than weekends.",
  },
  {
    type: "weekend_consistency",
    condition: "Daily performance score varies much less on weekends than weekdays.",
    template: "You are more consistent on weekends than weekdays.",
  },
  {
    type: "focus_after_40_drop",
    condition: "Completed sessions longer than 40 minutes have meaningfully lower quality than 20 to 40 minute sessions.",
    template: "Your focus quality tends to drop after 40 minutes.",
  },
  {
    type: "abandoned_sessions_up",
    condition: "This week's abandoned sessions are materially above the recent multi-week baseline.",
    template: "You had more abandoned sessions this week than usual, up from about 2 to 5.",
  },
  {
    type: "short_failed_sessions_up",
    condition: "This week contains more days with repeated short failed starts than the recent baseline.",
    template: "You had more short failed sessions this week than your recent pattern.",
  },
  {
    type: "task_completion_improved",
    condition: "This week's completed task total is at least two higher than last week's.",
    template: "You completed 9 tasks this week, up from 6 last week.",
  },
  {
    type: "quality_improved",
    condition: "Average session quality improved at least 8 points week over week.",
    template: "Your average session quality improved by 9 points this week.",
  },
  {
    type: "strongest_day",
    condition: "One day of the week has a clearly higher average focus total than the others.",
    template: "Tuesday is usually your strongest focus day.",
  },
  {
    type: "most_reliable_day",
    condition: "One day of the week has a clearly higher average completion rate than the others.",
    template: "Thursday is the day you are most likely to finish what you start.",
  },
  {
    type: "high_performance_days_up",
    condition: "This week has at least two more high-performance days than last week.",
    template: "You had 4 high-performance days this week, up from 2 last week.",
  },
];

export function buildExamplePerformanceInsights(): PerformanceInsight[] {
  return [
    {
      type: "best_focus_window",
      tone: "positive",
      title: "Best focus window",
      body: "You focus best between 8 PM and 10 PM.",
    },
    {
      type: "completion_rate_improved",
      tone: "positive",
      title: "Completion rate improved",
      body: "Your completion rate improved this week, up 14 points from last week.",
    },
    {
      type: "abandoned_sessions_up",
      tone: "warning",
      title: "Abandoned sessions are up",
      body: "You had more abandoned sessions this week than usual, up from about 2 to 5.",
    },
  ];
}
