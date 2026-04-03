"use client";

import { useMemo, useState, type CSSProperties } from "react";

import { dayKeyLocal } from "@/lib/date-utils";
import { getStreakBandanaTier } from "@/lib/streak-bandanas";
import { deriveStreakState } from "@/lib/streak-state";
import type { LifetimeXpSummary } from "@/lib/xp-engine";

type SickDaySaveInput = {
  dateKey: string;
  claimedAtISO: string;
};

export type StreakMonthCell = {
  key: string;
  dateKey: string | null;
  dayNumber: number | null;
  isCurrentMonth: boolean;
  isToday: boolean;
  streakLength: number;
  streakTierColor: string | null;
  hasSession: boolean;
  isSaved: boolean;
  leftConnected: boolean;
  rightConnected: boolean;
};

type UseStreakOptions = {
  isPro: boolean;
  streak: number;
  streakQualifiedDateKeys: string[];
  sessionMinutesByDay: Map<string, number>;
  noteWordsByDay: Map<string, number>;
  completedBlocksByDay: Map<string, number>;
  sickDaySaves: SickDaySaveInput[];
  sickDaySaveDismissals: string[];
  lifetimeXpSummary: LifetimeXpSummary;
};

export function useStreak({
  isPro,
  streak,
  streakQualifiedDateKeys,
  sessionMinutesByDay,
  noteWordsByDay,
  completedBlocksByDay,
  sickDaySaves,
  sickDaySaveDismissals,
  lifetimeXpSummary,
}: UseStreakOptions) {
  const [streakCalendarCursor, setStreakCalendarCursor] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const streakState = useMemo(
    () =>
      deriveStreakState({
        isPro,
        streak,
        streakQualifiedDateKeys,
        sessionMinutesByDay,
        noteWordsByDay,
        completedBlocksByDay,
        sickDaySaves,
        sickDaySaveDismissals,
        lifetimeXpSummary,
      }),
    [
      completedBlocksByDay,
      isPro,
      lifetimeXpSummary,
      noteWordsByDay,
      sessionMinutesByDay,
      sickDaySaveDismissals,
      sickDaySaves,
      streak,
      streakQualifiedDateKeys,
    ],
  );

  const {
    historicalStreaksByDay,
    todayKey,
    yesterdayKey,
    todayFocusMinutes,
    todayNoteWords,
    todayMinutesProgress,
    todayWordsProgress,
    hasEarnedToday,
    displayStreak,
    streakBandanaTier,
    xpTierTheme,
    monthlyStreakSaveCount,
    streakSaveMonthlyLimit,
    streakSaveSlotsLeft,
    rawYesterdayMissed,
    yesterdaySave,
    monthlySaveLimitReached,
    sickDaySaveEligible,
    formattedLifetimeXp,
    formattedXpToNextLevel,
    nextBandanaMilestone,
    longestStreak,
    streakRuleV2ActiveToday,
    streakProtectedToday,
    streakProgressMinutesLabel,
    streakProgressBlocksLabel,
    streakProgressWordsLabel,
    streakStatusLine,
    streakNudgeDraft,
    streakRuleSummaryLine,
  } = streakState;

  const xpDockStyle = {
    "--xp-accent": xpTierTheme.accent,
    "--xp-accent-strong": xpTierTheme.accentStrong,
    "--xp-accent-deep": xpTierTheme.accentDeep,
    "--xp-accent-glow": xpTierTheme.accentGlow,
    "--xp-shell": xpTierTheme.shell,
    "--xp-text-strong": xpTierTheme.textStrong,
    "--xp-text-soft": xpTierTheme.textSoft,
  } as CSSProperties;
  const mobileStreakJumpStyle = {
    "--mobile-streak-accent": xpTierTheme.accent,
    "--mobile-streak-accent-strong": xpTierTheme.accentStrong,
    "--mobile-streak-accent-deep": xpTierTheme.accentDeep,
    "--mobile-streak-glow": xpTierTheme.accentGlow,
    "--mobile-streak-text": xpTierTheme.textStrong,
  } as CSSProperties;

  const streakMonthLabel = streakCalendarCursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const streakMonthCalendar = useMemo<StreakMonthCell[]>(() => {
    const monthStart = new Date(
      streakCalendarCursor.getFullYear(),
      streakCalendarCursor.getMonth(),
      1,
    );
    const daysInMonth = new Date(
      streakCalendarCursor.getFullYear(),
      streakCalendarCursor.getMonth() + 1,
      0,
    ).getDate();
    const cells: StreakMonthCell[] = [];

    for (let i = 0; i < monthStart.getDay(); i += 1) {
      cells.push({
        key: `streak-leading-${i}`,
        dateKey: null,
        dayNumber: null,
        isCurrentMonth: false,
        isToday: false,
        streakLength: 0,
        streakTierColor: null,
        hasSession: false,
        isSaved: false,
        leftConnected: false,
        rightConnected: false,
      });
    }

    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
      const day = new Date(
        streakCalendarCursor.getFullYear(),
        streakCalendarCursor.getMonth(),
        dayNumber,
      );
      const dateKey = dayKeyLocal(day);
      const isFutureDate = dateKey > todayKey;
      const streakLength = isFutureDate ? 0 : (historicalStreaksByDay.get(dateKey) ?? 0);

      cells.push({
        key: dateKey,
        dateKey,
        dayNumber,
        isCurrentMonth: true,
        isToday: dateKey === todayKey,
        streakLength,
        streakTierColor: isFutureDate ? null : (getStreakBandanaTier(streakLength)?.color ?? null),
        hasSession: !isFutureDate && sessionMinutesByDay.has(dateKey),
        isSaved: !isFutureDate && sickDaySaves.some((save) => save.dateKey === dateKey) && !sessionMinutesByDay.has(dateKey),
        leftConnected: false,
        rightConnected: false,
      });
    }

    while (cells.length < 42) {
      cells.push({
        key: `streak-trailing-${cells.length}`,
        dateKey: null,
        dayNumber: null,
        isCurrentMonth: false,
        isToday: false,
        streakLength: 0,
        streakTierColor: null,
        hasSession: false,
        isSaved: false,
        leftConnected: false,
        rightConnected: false,
      });
    }

    return cells.map((cell, index, items) => {
      if (!cell.dateKey || cell.streakLength <= 0) return cell;

      const previous = items[index - 1];
      const next = items[index + 1];
      const sameWeekAsPrevious = previous ? Math.floor((index - 1) / 7) === Math.floor(index / 7) : false;
      const sameWeekAsNext = next ? Math.floor((index + 1) / 7) === Math.floor(index / 7) : false;

      return {
        ...cell,
        leftConnected: Boolean(previous?.dateKey) && (previous?.streakLength ?? 0) > 0 && sameWeekAsPrevious,
        rightConnected: Boolean(next?.dateKey) && (next?.streakLength ?? 0) > 0 && sameWeekAsNext,
      };
    });
  }, [historicalStreaksByDay, sessionMinutesByDay, sickDaySaves, streakCalendarCursor, todayKey]);

  return {
    streakCalendarCursor,
    setStreakCalendarCursor,
    historicalStreaksByDay,
    todayKey,
    yesterdayKey,
    todayFocusMinutes,
    todayNoteWords,
    todayMinutesProgress,
    todayWordsProgress,
    hasEarnedToday,
    displayStreak,
    streakBandanaTier,
    xpTierTheme,
    xpDockStyle,
    mobileStreakJumpStyle,
    monthlyStreakSaveCount,
    streakSaveMonthlyLimit,
    streakSaveSlotsLeft,
    rawYesterdayMissed,
    yesterdaySave,
    monthlySaveLimitReached,
    sickDaySaveEligible,
    formattedLifetimeXp,
    formattedXpToNextLevel,
    nextBandanaMilestone,
    longestStreak,
    streakRuleV2ActiveToday,
    streakProtectedToday,
    streakProgressMinutesLabel,
    streakProgressBlocksLabel,
    streakProgressWordsLabel,
    streakStatusLine,
    streakNudgeDraft,
    streakRuleSummaryLine,
    streakMonthLabel,
    streakMonthCalendar,
  };
}
