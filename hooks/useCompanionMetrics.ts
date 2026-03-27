"use client";

import { useMemo } from "react";

import {
  buildSenseiCompanionState,
  type SenseiCompanionStyle,
} from "@/lib/sensei-companion";
import { dayKeyLocal } from "@/lib/date-utils";

type AppTab = "today" | "calendar" | "notes" | "leaderboard" | "mirror" | "history" | "reports" | "streaks" | "settings";

type SessionLike = {
  completedAtISO: string;
  minutes: number;
};

type TrendPoint = {
  label: string;
  minutes: number;
};

type CalendarDay = {
  label: string;
  dateKey: string;
  minutes: number;
  level: 0 | 1 | 2 | 3;
};

type MonthCell = {
  key: string;
  dayNumber: number | null;
  minutes: number;
  level: 0 | 1 | 2 | 3;
  isCurrentMonth: boolean;
};

type UseCompanionMetricsOptions = {
  sessions: SessionLike[];
  streak: number;
  trendRange: 7 | 30 | 90;
  dueReminderCount: number;
  todayActivePlannedBlocksCount: number;
  notesCount: number;
  notesUpdated7d: number;
  activeTab: AppTab;
  companionStyle: SenseiCompanionStyle;
  landingWisdomMinute: number;
  focusLevel: (minutes: number) => 0 | 1 | 2 | 3;
  summarizeDisciplineScore: (input: {
    todayMinutes: number;
    todaySessions: number;
    streak: number;
    weekMinutes: number;
  }) => number;
  milestoneForStreak: (streak: number) => { next: number | null; remaining: number };
  startOfDayLocal: (dateInput?: string | Date | undefined) => Date;
  landingWisdomRotation: Array<{ title: string; body: string; signatureLine: string }>;
};

export function useCompanionMetrics({
  sessions,
  streak,
  trendRange,
  dueReminderCount,
  todayActivePlannedBlocksCount,
  notesCount,
  notesUpdated7d,
  activeTab,
  companionStyle,
  landingWisdomMinute,
  focusLevel,
  summarizeDisciplineScore,
  milestoneForStreak,
  startOfDayLocal,
  landingWisdomRotation,
}: UseCompanionMetricsOptions) {
  const focusMetrics = useMemo(() => {
    const now = new Date();
    const todayKey = dayKeyLocal(now);
    const todayStart = startOfDayLocal(now);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 29);
    const thisMonthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    const daysInMonth = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0).getDate();

    let todayMinutes = 0;
    let todaySessions = 0;
    let weekMinutes = 0;
    let monthMinutes = 0;
    const byDay = new Map<string, number>();

    for (const session of sessions) {
      const sessionDate = new Date(session.completedAtISO);
      const key = dayKeyLocal(sessionDate);
      byDay.set(key, (byDay.get(key) ?? 0) + session.minutes);

      if (key === todayKey) {
        todayMinutes += session.minutes;
        todaySessions += 1;
      }
      if (sessionDate >= weekStart && sessionDate <= now) weekMinutes += session.minutes;
      if (sessionDate >= monthStart && sessionDate <= now) monthMinutes += session.minutes;
    }

    let activeDaysInMonth = 0;
    for (let i = 0; i < 30; i += 1) {
      const day = new Date(monthStart);
      day.setDate(monthStart.getDate() + i);
      if ((byDay.get(dayKeyLocal(day)) ?? 0) > 0) activeDaysInMonth += 1;
    }

    const calendar: CalendarDay[] = [];
    for (let i = 27; i >= 0; i -= 1) {
      const day = new Date(todayStart);
      day.setDate(todayStart.getDate() - i);
      const dateKey = dayKeyLocal(day);
      const minutes = byDay.get(dateKey) ?? 0;
      calendar.push({
        label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        dateKey,
        minutes,
        level: focusLevel(minutes),
      });
    }

    const monthCalendar: MonthCell[] = [];
    const leadingSpaces = thisMonthStart.getDay();
    for (let i = 0; i < leadingSpaces; i += 1) {
      monthCalendar.push({ key: `leading-${i}`, dayNumber: null, minutes: 0, level: 0, isCurrentMonth: false });
    }
    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
      const day = new Date(todayStart.getFullYear(), todayStart.getMonth(), dayNumber);
      const dateKey = dayKeyLocal(day);
      const minutes = byDay.get(dateKey) ?? 0;
      monthCalendar.push({
        key: dateKey,
        dayNumber,
        minutes,
        level: focusLevel(minutes),
        isCurrentMonth: true,
      });
    }
    while (monthCalendar.length < 42) {
      monthCalendar.push({
        key: `trailing-${monthCalendar.length}`,
        dayNumber: null,
        minutes: 0,
        level: 0,
        isCurrentMonth: false,
      });
    }

    function buildTrendPoints(days: number): TrendPoint[] {
      const points: TrendPoint[] = [];
      for (let i = days - 1; i >= 0; i -= 1) {
        const day = new Date(todayStart);
        day.setDate(todayStart.getDate() - i);
        const dateKey = dayKeyLocal(day);
        points.push({
          label:
            days <= 7
              ? day.toLocaleDateString(undefined, { weekday: "short" })
              : day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          minutes: byDay.get(dateKey) ?? 0,
        });
      }
      return points;
    }

    return {
      todayMinutes,
      todaySessions,
      weekMinutes,
      monthMinutes,
      activeDaysInMonth,
      disciplineScore: summarizeDisciplineScore({
        todayMinutes,
        todaySessions,
        streak,
        weekMinutes,
      }),
      calendar,
      monthCalendar,
      trendPoints7: buildTrendPoints(7),
      trendPoints30: buildTrendPoints(30),
      trendPoints90: buildTrendPoints(90),
    };
  }, [focusLevel, sessions, startOfDayLocal, streak, summarizeDisciplineScore]);

  const trendPoints = useMemo(() => {
    if (trendRange === 30) return focusMetrics.trendPoints30;
    if (trendRange === 90) return focusMetrics.trendPoints90;
    return focusMetrics.trendPoints7;
  }, [focusMetrics, trendRange]);

  const averageSessionStartHour = useMemo(() => {
    const recentSessions = sessions.slice(0, 14);
    if (recentSessions.length === 0) return null;
    const total = recentSessions.reduce((sum, session) => {
      const date = new Date(session.completedAtISO);
      return sum + date.getHours() + date.getMinutes() / 60;
    }, 0);
    return total / recentSessions.length;
  }, [sessions]);

  const lastSessionHoursAgo = useMemo(() => {
    const iso = sessions[0]?.completedAtISO;
    if (!iso) return null;
    const ms = Date.now() - new Date(iso).getTime();
    return Math.max(0, ms / (1000 * 60 * 60));
  }, [sessions]);

  const comebackDaysAway = useMemo(() => {
    const todayKey = dayKeyLocal(new Date());
    const previousDayKeys = [...new Set(sessions.map((session) => dayKeyLocal(session.completedAtISO)))].filter(
      (key) => key !== todayKey,
    );
    if (focusMetrics.todaySessions === 0 || previousDayKeys.length === 0) return 0;
    const previous = previousDayKeys[0];
    const today = startOfDayLocal(new Date());
    const prior = startOfDayLocal(new Date(`${previous}T00:00:00`));
    const days = Math.round((today.getTime() - prior.getTime()) / (1000 * 60 * 60 * 24)) - 1;
    return Math.max(0, days);
  }, [focusMetrics.todaySessions, sessions, startOfDayLocal]);

  const missedYesterday = useMemo(
    () => focusMetrics.todaySessions === 0 && lastSessionHoursAgo !== null && lastSessionHoursAgo >= 24,
    [focusMetrics.todaySessions, lastSessionHoursAgo],
  );

  const nextSenseiMilestone = useMemo(() => milestoneForStreak(streak), [milestoneForStreak, streak]);
  const senseiActiveTab =
    activeTab === "streaks" || activeTab === "leaderboard"
      ? "reports"
      : activeTab === "mirror"
        ? "notes"
        : activeTab;

  const companionState = useMemo(
    () =>
      buildSenseiCompanionState({
        now: new Date(),
        activeTab: senseiActiveTab,
        totalSessions: sessions.length,
        totalMinutes: sessions.reduce((sum, session) => sum + session.minutes, 0),
        todaySessions: focusMetrics.todaySessions,
        todayMinutes: focusMetrics.todayMinutes,
        weekMinutes: focusMetrics.weekMinutes,
        streak,
        dueReminders: dueReminderCount,
        plannedTodayCount: todayActivePlannedBlocksCount,
        notesCount,
        notesUpdated7d,
        nextMilestone: nextSenseiMilestone.next,
        nextMilestoneRemaining: nextSenseiMilestone.remaining,
        averageStartHour: averageSessionStartHour,
        lastSessionHoursAgo,
        comebackDaysAway,
        missedYesterday,
        companionStyle,
      }),
    [
      averageSessionStartHour,
      comebackDaysAway,
      companionStyle,
      dueReminderCount,
      focusMetrics.todayMinutes,
      focusMetrics.todaySessions,
      focusMetrics.weekMinutes,
      lastSessionHoursAgo,
      missedYesterday,
      nextSenseiMilestone.next,
      nextSenseiMilestone.remaining,
      notesCount,
      notesUpdated7d,
      senseiActiveTab,
      sessions,
      streak,
      todayActivePlannedBlocksCount,
    ],
  );

  const senseiGuidance = companionState.hero;
  const landingWisdom = useMemo(
    () => landingWisdomRotation[landingWisdomMinute % landingWisdomRotation.length],
    [landingWisdomMinute, landingWisdomRotation],
  );
  const todayHeroCopy =
    activeTab === "today"
      ? {
          ...senseiGuidance,
          title: landingWisdom.title,
          body: landingWisdom.body,
          signatureLine: landingWisdom.signatureLine,
        }
      : senseiGuidance;

  return {
    focusMetrics,
    trendPoints,
    averageSessionStartHour,
    lastSessionHoursAgo,
    comebackDaysAway,
    missedYesterday,
    nextSenseiMilestone,
    companionState,
    senseiGuidance,
    todayHeroCopy,
  };
}
