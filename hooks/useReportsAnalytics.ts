"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";

import { resolveApiUrl } from "@/lib/api-base";
import { dayKeyLocal, addDaysLocal } from "@/lib/date-utils";
import { buildPerformanceNotificationPlan } from "@/lib/performance-notifications";

type TrendRange = 7 | 30 | 90;
type KpiDetailKey = "totalFocus" | "totalSessions" | "averageSession" | "bestDay" | "weeklyProgress";

type AnalyticsInsightTone = "positive" | "neutral" | "warning";

export type AnalyticsInsight = {
  type: string;
  title: string;
  body: string;
  tone: AnalyticsInsightTone;
};

export type AnalyticsWeeklySummary = {
  daysCaptured: number;
  activeDays: number;
  totals: {
    focusMinutes: number;
    sessionsStarted: number;
    sessionsCompleted: number;
    sessionsAbandoned: number;
    tasksCompleted: number;
  };
  averages: {
    dailyPerformanceScore: number;
    completionRate: number;
    completedSessionLength: number;
    sessionQualityScore: number | null;
  };
  performanceBands: {
    high: number;
    steady: number;
    recovery: number;
  };
  streak: {
    active: boolean;
    longestAtEndOfDay: number;
  };
  subjectBreakdown: Record<
    "language" | "school" | "work" | "general",
    { focusMinutes: number; sessionsCompleted: number; tasksCompleted: number }
  >;
  days: Array<{
    dateLocal: string;
    dailyPerformanceScore: number;
    dailyPerformanceBand: "high" | "steady" | "recovery";
    focusMinutes: number;
    sessionCompletionRate: number;
  }>;
};

export type AnalyticsDailySummary = {
  dateLocal: string;
  dailyPerformanceScore: number;
  dailyPerformanceBand: "high" | "steady" | "recovery";
  sessionCompletionRate: number;
  focusMinutes: number;
  sessionsAbandoned: number;
  taskCompletedCount: number;
  averageSessionQualityScore: number | null;
};

export type BestFocusHoursSummary = {
  bestWindow: {
    startHour: number;
    endHour: number;
    label: string;
    focusMinutes: number;
    sharePercent: number;
  } | null;
  hours: Array<{
    hour: number;
    focusMinutes: number;
    completedSessions: number;
    sharePercent: number;
    averageSessionLength: number;
  }>;
};

type UseReportsAnalyticsOptions = {
  user: User | null;
  isPro: boolean;
  activeTab: string;
  focusMetrics: { weekMinutes: number; todayMinutes: number; todaySessions: number; disciplineScore: number; activeDaysInMonth: number };
  notes: Array<{ updatedAtISO: string; reminderAtISO?: string | null }>;
  sessions: Array<{ minutes: number; note?: string | null; completedAtISO: string }>;
  trendPoints: Array<{ label: string; minutes: number }>;
  streak: number;
  setSenseiReaction: (value: string) => void;
};

export function useReportsAnalytics({
  user,
  isPro,
  activeTab,
  focusMetrics,
  notes,
  sessions,
  trendPoints,
  streak,
  setSenseiReaction,
}: UseReportsAnalyticsOptions) {
  const [reportCopyStatus, setReportCopyStatus] = useState("");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsWeeklySummary, setAnalyticsWeeklySummary] = useState<AnalyticsWeeklySummary | null>(null);
  const [analyticsDailySummary, setAnalyticsDailySummary] = useState<AnalyticsDailySummary | null>(null);
  const [analyticsInsights, setAnalyticsInsights] = useState<AnalyticsInsight[]>([]);
  const [analyticsBestHours, setAnalyticsBestHours] = useState<BestFocusHoursSummary | null>(null);
  const [analyticsScoreHistory, setAnalyticsScoreHistory] = useState<
    Array<{ date: string; score: number; band: "high" | "steady" | "recovery"; focusMinutes: number; completionRate: number }>
  >([]);
  const [insightRange, setInsightRange] = useState<TrendRange>(30);
  const [kpiDetailOpen, setKpiDetailOpen] = useState<KpiDetailKey | null>(null);
  const reportsInsightToastRef = useRef<string | null>(null);

  function weekStartKeyLocal(dateInput: string | Date) {
    const date = typeof dateInput === "string" ? new Date(dateInput) : new Date(dateInput);
    const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = local.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    local.setDate(local.getDate() + diff);
    return dayKeyLocal(local);
  }

  const reportMetrics = useMemo(() => {
    const sessionCount = sessions.length;
    const totalMinutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
    const averageSession = sessionCount === 0 ? 0 : Math.round(totalMinutes / sessionCount);
    const bestTrend = [...trendPoints].sort((a, b) => b.minutes - a.minutes)[0];
    const weeklyTarget = 420;
    const weeklyProgress = Math.min(100, Math.round((focusMetrics.weekMinutes / weeklyTarget) * 100));
    const plannedCompletionCount = sessions.filter((session) =>
      (session.note || "").startsWith("Planned block completed:"),
    ).length;
    const notesUpdated7d = notes.filter((note) => {
      const updated = new Date(note.updatedAtISO);
      const now = new Date();
      return now.getTime() - updated.getTime() <= 7 * 24 * 60 * 60 * 1000;
    }).length;
    const notesWithReminders = notes.filter((note) => Boolean(note.reminderAtISO)).length;

    return {
      sessionCount,
      totalMinutes,
      averageSession,
      bestTrendLabel: bestTrend?.label ?? "N/A",
      bestTrendMinutes: bestTrend?.minutes ?? 0,
      weeklyProgress,
      plannedCompletionCount,
      notesUpdated7d,
      notesWithReminders,
    };
  }, [focusMetrics.weekMinutes, notes, sessions, trendPoints]);

  const analyticsDateRange = useMemo(() => {
    const endDate = dayKeyLocal(new Date());
    const startDate = dayKeyLocal(addDaysLocal(new Date(), -(insightRange - 1)));
    return { startDate, endDate };
  }, [insightRange]);

  const analyticsNotificationPlan = useMemo(() => {
    if (!analyticsDailySummary) return null;
    return buildPerformanceNotificationPlan({
      dailyPerformanceScore: analyticsDailySummary.dailyPerformanceScore,
      dailyPerformanceBand: analyticsDailySummary.dailyPerformanceBand,
      sessionCompletionRate: analyticsDailySummary.sessionCompletionRate,
      sessionsAbandoned: analyticsDailySummary.sessionsAbandoned,
      taskCompletedCount: analyticsDailySummary.taskCompletedCount,
      focusMinutes: analyticsDailySummary.focusMinutes,
      averageSessionQualityScore: analyticsDailySummary.averageSessionQualityScore,
    });
  }, [analyticsDailySummary]);

  useEffect(() => {
    if (!user || !isPro) {
      setAnalyticsLoading(false);
      setAnalyticsError("");
      setAnalyticsWeeklySummary(null);
      setAnalyticsDailySummary(null);
      setAnalyticsInsights([]);
      setAnalyticsBestHours(null);
      setAnalyticsScoreHistory([]);
      return;
    }

    let cancelled = false;
    const currentUser = user;

    async function fetchAnalyticsJson<T>(path: string) {
      const token = await currentUser.getIdToken();
      const response = await fetch(resolveApiUrl(path), {
        headers: { Authorization: `Bearer ${token}` },
      });

      const body = (await response.json().catch(() => null)) as T | { error?: string } | null;
      if (!response.ok) {
        throw new Error((body as { error?: string } | null)?.error || "Failed to load analytics.");
      }
      return body as T;
    }

    async function loadAnalytics() {
      setAnalyticsLoading(true);
      setAnalyticsError("");

      try {
        const todayKey = dayKeyLocal(new Date());
        const weekStart = weekStartKeyLocal(new Date());
        const [weeklyPayload, dailyPayload, insightsPayload, bestHoursPayload, scoreHistoryPayload] =
          await Promise.all([
            fetchAnalyticsJson<{ summary: AnalyticsWeeklySummary }>(
              `/api/analytics/weekly-summary?uid=${encodeURIComponent(currentUser.uid)}&weekStart=${encodeURIComponent(weekStart)}`,
            ),
            fetchAnalyticsJson<{ summary: AnalyticsDailySummary | null }>(
              `/api/analytics/daily-summary?uid=${encodeURIComponent(currentUser.uid)}&date=${encodeURIComponent(todayKey)}`,
            ),
            fetchAnalyticsJson<{ insights: AnalyticsInsight[] }>(
              `/api/analytics/insights?uid=${encodeURIComponent(currentUser.uid)}&startDate=${encodeURIComponent(
                analyticsDateRange.startDate,
              )}&endDate=${encodeURIComponent(analyticsDateRange.endDate)}&limit=6`,
            ),
            fetchAnalyticsJson<BestFocusHoursSummary>(
              `/api/analytics/best-focus-hours?uid=${encodeURIComponent(currentUser.uid)}&startDate=${encodeURIComponent(
                analyticsDateRange.startDate,
              )}&endDate=${encodeURIComponent(analyticsDateRange.endDate)}`,
            ),
            fetchAnalyticsJson<{
              history: Array<{ date: string; score: number; band: "high" | "steady" | "recovery"; focusMinutes: number; completionRate: number }>;
            }>(
              `/api/analytics/performance-score-history?uid=${encodeURIComponent(
                currentUser.uid,
              )}&startDate=${encodeURIComponent(analyticsDateRange.startDate)}&endDate=${encodeURIComponent(
                analyticsDateRange.endDate,
              )}`,
            ),
          ]);

        if (cancelled) return;
        setAnalyticsWeeklySummary(weeklyPayload.summary);
        setAnalyticsDailySummary(dailyPayload.summary);
        setAnalyticsInsights(insightsPayload.insights);
        setAnalyticsBestHours(bestHoursPayload);
        setAnalyticsScoreHistory(scoreHistoryPayload.history);
      } catch (error: unknown) {
        if (!cancelled) {
          setAnalyticsError(error instanceof Error ? error.message : "Failed to load reports.");
        }
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    }

    void loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [analyticsDateRange.endDate, analyticsDateRange.startDate, isPro, user]);

  useEffect(() => {
    if (activeTab !== "reports" || !isPro) return;
    const topInsight = analyticsInsights[0];
    if (!topInsight) return;
    if (reportsInsightToastRef.current === topInsight.title) return;
    reportsInsightToastRef.current = topInsight.title;
    setSenseiReaction(topInsight.body);
  }, [activeTab, analyticsInsights, isPro, setSenseiReaction]);

  const copyWeeklyReport = useCallback(async () => {
    const userLabel = user?.displayName || user?.email || "Whelm user";
    const report = [
      "Whelm Weekly Report",
      `Focus today: ${focusMetrics.todayMinutes}m`,
      `Focus this week: ${focusMetrics.weekMinutes}m`,
      `Sessions today: ${focusMetrics.todaySessions}`,
      `Discipline score: ${focusMetrics.disciplineScore}/100`,
      `Current streak: ${streak} day${streak === 1 ? "" : "s"}`,
      `Active days (30d): ${focusMetrics.activeDaysInMonth}/30`,
      `User: ${userLabel}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(report);
      setReportCopyStatus("Copied");
    } catch {
      setReportCopyStatus("Copy failed");
    } finally {
      window.setTimeout(() => setReportCopyStatus(""), 1200);
    }
  }, [focusMetrics, streak, user]);

  const maxAnalyticsScore = Math.max(100, ...analyticsScoreHistory.map((entry) => entry.score));
  const analyticsScorePath = analyticsScoreHistory
    .map((entry, index) => {
      const x = (index / Math.max(1, analyticsScoreHistory.length - 1)) * 100;
      const y = 100 - (entry.score / maxAnalyticsScore) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  const analyticsTopHours = analyticsBestHours?.hours.slice(0, 4) ?? [];
  const analyticsTopSubjects = analyticsWeeklySummary
    ? (Object.entries(analyticsWeeklySummary.subjectBreakdown) as Array<
        [
          "language" | "school" | "work" | "general",
          { focusMinutes: number; sessionsCompleted: number; tasksCompleted: number },
        ]
      >)
        .map(([key, value]) => ({
          key,
          label: key === "general" ? "General" : key.charAt(0).toUpperCase() + key.slice(1),
          ...value,
        }))
        .sort((a, b) => b.focusMinutes - a.focusMinutes)
    : [];
  const analyticsTopSubjectMinutes = Math.max(1, ...analyticsTopSubjects.map((subject) => subject.focusMinutes));
  const analyticsLeadInsight = analyticsInsights[0] ?? null;
  const analyticsLeadSubject = analyticsTopSubjects.find((subject) => subject.focusMinutes > 0) ?? null;
  const analyticsLeadNotification = analyticsNotificationPlan?.notifications[0] ?? null;

  return {
    reportCopyStatus,
    analyticsLoading,
    analyticsError,
    analyticsWeeklySummary,
    analyticsDailySummary,
    analyticsInsights,
    analyticsBestHours,
    analyticsScoreHistory,
    insightRange,
    setInsightRange,
    kpiDetailOpen,
    setKpiDetailOpen,
    reportMetrics,
    analyticsDateRange,
    analyticsNotificationPlan,
    copyWeeklyReport,
    analyticsScorePath,
    analyticsTopHours,
    analyticsTopSubjects,
    analyticsTopSubjectMinutes,
    analyticsLeadInsight,
    analyticsLeadSubject,
    analyticsLeadNotification,
  };
}
