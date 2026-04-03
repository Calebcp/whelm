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
    let totalMinutes = 0;
    let recentStartHourTotal = 0;
    let recentStartHourCount = 0;
    let lastSessionHoursAgo: number | null = null;
    const uniqueDayKeys: string[] = [];
    const seenDayKeys = new Set<string>();
    const byDay = new Map<string, number>();

    sessions.forEach((session, index) => {
      const sessionDate = new Date(session.completedAtISO);
      const key = dayKeyLocal(sessionDate);
      byDay.set(key, (byDay.get(key) ?? 0) + session.minutes);
      totalMinutes += session.minutes;

      if (key === todayKey) {
        todayMinutes += session.minutes;
        todaySessions += 1;
      }
      if (sessionDate >= weekStart && sessionDate <= now) weekMinutes += session.minutes;
      if (sessionDate >= monthStart && sessionDate <= now) monthMinutes += session.minutes;
      if (index < 14) {
        recentStartHourTotal += sessionDate.getHours() + sessionDate.getMinutes() / 60;
        recentStartHourCount += 1;
      }
      if (index === 0) {
        const ms = now.getTime() - sessionDate.getTime();
        lastSessionHoursAgo = Math.max(0, ms / (1000 * 60 * 60));
      }
      if (!seenDayKeys.has(key)) {
        seenDayKeys.add(key);
        uniqueDayKeys.push(key);
      }
    });

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
      totalMinutes,
      activeDaysInMonth,
      disciplineScore: summarizeDisciplineScore({
        todayMinutes,
        todaySessions,
        streak,
        weekMinutes,
      }),
      averageSessionStartHour:
        recentStartHourCount === 0 ? null : recentStartHourTotal / recentStartHourCount,
      lastSessionHoursAgo,
      uniqueDayKeys,
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

  const comebackDaysAway = useMemo(() => {
    const todayKey = dayKeyLocal(new Date());
    const previous = focusMetrics.uniqueDayKeys.find((key) => key !== todayKey);
    if (focusMetrics.todaySessions === 0 || !previous) return 0;
    const today = startOfDayLocal(new Date());
    const prior = startOfDayLocal(new Date(`${previous}T00:00:00`));
    const days = Math.round((today.getTime() - prior.getTime()) / (1000 * 60 * 60 * 24)) - 1;
    return Math.max(0, days);
  }, [focusMetrics.todaySessions, focusMetrics.uniqueDayKeys, startOfDayLocal]);

  const missedYesterday = useMemo(
    () =>
      focusMetrics.todaySessions === 0 &&
      focusMetrics.lastSessionHoursAgo !== null &&
      focusMetrics.lastSessionHoursAgo >= 24,
    [focusMetrics.lastSessionHoursAgo, focusMetrics.todaySessions],
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
        totalMinutes: focusMetrics.totalMinutes,
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
        averageStartHour: focusMetrics.averageSessionStartHour,
        lastSessionHoursAgo: focusMetrics.lastSessionHoursAgo,
        comebackDaysAway,
        missedYesterday,
        companionStyle,
      }),
    [
      comebackDaysAway,
      companionStyle,
      dueReminderCount,
      focusMetrics.todayMinutes,
      focusMetrics.todaySessions,
      focusMetrics.weekMinutes,
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
    averageSessionStartHour: focusMetrics.averageSessionStartHour,
    lastSessionHoursAgo: focusMetrics.lastSessionHoursAgo,
    comebackDaysAway,
    missedYesterday,
    nextSenseiMilestone,
    companionState,
    senseiGuidance,
    todayHeroCopy,
  };
}
