"use client";

import { useMemo, useRef } from "react";

import { computeHistoricalStreaks, computeStreak, computeStreakEndingAtDateKey } from "@/lib/streak";
import { getStreakBandanaTier } from "@/lib/streak-bandanas";
import { dayKeyLocal, addDays, addDaysLocal, startOfDayLocal, monthKeyLocal, countWords } from "@/lib/date-utils";
import { buildDayXpSummary, getLifetimeXpSummary, getStreakTierColorTheme, STREAK_RULE_V2_START_DATE, STREAK_SAVE_MONTHLY_LIMIT, type DayXpSummary, type LifetimeXpSummary } from "@/lib/xp-utils";
import type { SessionDoc } from "@/lib/streak";
import type { WorkspaceNote } from "@/lib/notes-store";

export type { DayXpSummary, LifetimeXpSummary };

type PlannedBlockInput = {
  dateKey: string;
  status: "active" | "completed";
};

type SickDaySaveInput = {
  dateKey: string;
  claimedAtISO: string;
};

type UseStreakInput = {
  sessions: SessionDoc[];
  notes: WorkspaceNote[];
  plannedBlocks: PlannedBlockInput[];
  sickDaySaves: SickDaySaveInput[];
  sickDaySaveDismissals: string[];
  plannedBlocksHydrated: boolean;
};

export function useStreak({
  sessions,
  notes,
  plannedBlocks,
  sickDaySaves,
  sickDaySaveDismissals,
  plannedBlocksHydrated,
}: UseStreakInput) {
  const lastGoodStreakRef = useRef<number>(0);

  // ── Day maps ────────────────────────────────────────────────────────────────
  const sessionMinutesByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of sessions) {
      const key = dayKeyLocal(session.completedAtISO);
      map.set(key, (map.get(key) ?? 0) + session.minutes);
    }
    return map;
  }, [sessions]);

  const noteWordsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const note of notes) {
      const key = dayKeyLocal(note.updatedAtISO);
      map.set(key, (map.get(key) ?? 0) + countWords(note.body));
    }
    return map;
  }, [notes]);

  const completedBlocksByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const block of plannedBlocks) {
      if (block.status !== "completed") continue;
      map.set(block.dateKey, (map.get(block.dateKey) ?? 0) + 1);
    }
    return map;
  }, [plannedBlocks]);

  const protectedStreakDateKeys = useMemo(
    () => sickDaySaves.map((save) => save.dateKey),
    [sickDaySaves],
  );

  // ── Qualified dates ─────────────────────────────────────────────────────────
  const streakQualifiedDateKeys = useMemo(() => {
    const todayKey = dayKeyLocal(new Date());
    const qualifyingDays = new Set(protectedStreakDateKeys);

    for (const [dateKey, minutes] of sessionMinutesByDay.entries()) {
      if (dateKey < STREAK_RULE_V2_START_DATE) {
        qualifyingDays.add(dateKey);
        continue;
      }
      const completedBlocks = completedBlocksByDay.get(dateKey) ?? 0;
      const noteWords = noteWordsByDay.get(dateKey) ?? 0;
      if (dateKey <= todayKey && completedBlocks >= 1 && (minutes >= 30 || noteWords >= 33)) {
        qualifyingDays.add(dateKey);
      }
    }

    return [...qualifyingDays].sort();
  }, [completedBlocksByDay, noteWordsByDay, protectedStreakDateKeys, sessionMinutesByDay]);

  // ── Streak ──────────────────────────────────────────────────────────────────
  const streak = useMemo(() => {
    const computed = computeStreak([], streakQualifiedDateKeys);
    if (computed > 0) {
      lastGoodStreakRef.current = computed;
      return computed;
    }
    // Hold the last known good value until plannedBlocks finish loading
    // to avoid a transient 0-streak flash during partial hydration.
    if (!plannedBlocksHydrated && lastGoodStreakRef.current > 0) {
      return lastGoodStreakRef.current;
    }
    return computed;
  }, [streakQualifiedDateKeys, plannedBlocksHydrated]);

  // ── Display streak (today vs yesterday carry) ───────────────────────────────
  const todayKey = dayKeyLocal(new Date());
  const yesterdayKey = dayKeyLocal(addDays(startOfDayLocal(new Date()), -1));
  const dayBeforeYesterdayKey = dayKeyLocal(addDays(startOfDayLocal(new Date()), -2));

  const hasEarnedToday = streakQualifiedDateKeys.includes(todayKey);
  const carriedRunThroughYesterday = computeStreakEndingAtDateKey([], yesterdayKey, streakQualifiedDateKeys);
  const displayStreak = hasEarnedToday ? streak : carriedRunThroughYesterday;

  // ── Bandana tier ────────────────────────────────────────────────────────────
  const streakBandanaTier = getStreakBandanaTier(displayStreak);
  const xpTierTheme = getStreakTierColorTheme(streakBandanaTier?.color);

  // ── Sick-day save eligibility ───────────────────────────────────────────────
  const currentMonthKey = monthKeyLocal(new Date());
  const monthlyStreakSaveCount = sickDaySaves.filter(
    (save) => monthKeyLocal(save.claimedAtISO) === currentMonthKey,
  ).length;
  const streakSaveSlotsLeft = Math.max(0, STREAK_SAVE_MONTHLY_LIMIT - monthlyStreakSaveCount);
  const rawYesterdayMissed = !streakQualifiedDateKeys.includes(yesterdayKey);
  const yesterdaySave = sickDaySaves.find((save) => save.dateKey === yesterdayKey) ?? null;
  const priorRunBeforeYesterday = computeStreakEndingAtDateKey([], dayBeforeYesterdayKey, streakQualifiedDateKeys);
  const monthlySaveLimitReached = monthlyStreakSaveCount >= STREAK_SAVE_MONTHLY_LIMIT;
  const sickDaySaveEligible =
    rawYesterdayMissed &&
    priorRunBeforeYesterday > 0 &&
    !yesterdaySave &&
    !monthlySaveLimitReached &&
    !sickDaySaveDismissals.includes(yesterdayKey);

  // ── Historical streaks (for calendar) ──────────────────────────────────────
  const historicalStreaksByDay = useMemo(
    () => computeHistoricalStreaks([], streakQualifiedDateKeys),
    [streakQualifiedDateKeys],
  );

  // ── XP ──────────────────────────────────────────────────────────────────────
  const xpByDay = useMemo<DayXpSummary[]>(() => {
    const allDayKeys = new Set<string>();
    const today = dayKeyLocal(new Date());
    for (const key of sessionMinutesByDay.keys()) { if (key <= today) allDayKeys.add(key); }
    for (const key of noteWordsByDay.keys()) { if (key <= today) allDayKeys.add(key); }
    for (const key of completedBlocksByDay.keys()) { if (key <= today) allDayKeys.add(key); }
    for (const key of protectedStreakDateKeys) { if (key <= today) allDayKeys.add(key); }

    return [...allDayKeys].sort().map((dateKey) =>
      buildDayXpSummary({ dateKey, sessionMinutesByDay, completedBlocksByDay, noteWordsByDay, streakQualifiedDateKeys }),
    );
  }, [completedBlocksByDay, noteWordsByDay, streakQualifiedDateKeys, sessionMinutesByDay, protectedStreakDateKeys]);

  const lifetimeXpSummary = useMemo<LifetimeXpSummary>(() => {
    const totalXp = xpByDay.reduce((sum, day) => sum + day.totalXp, 0);
    const today = dayKeyLocal(new Date());
    const todayXp = xpByDay.find((day) => day.dateKey === today)?.totalXp ?? 0;
    return getLifetimeXpSummary(totalXp, todayXp);
  }, [xpByDay]);

  const formattedLifetimeXp = lifetimeXpSummary.totalXp.toLocaleString();
  const formattedXpToNextLevel = Math.max(
    0,
    lifetimeXpSummary.nextLevelXp - lifetimeXpSummary.totalXp,
  ).toLocaleString();

  // ── Today's focus metrics ───────────────────────────────────────────────────
  const todayFocusMinutes = sessionMinutesByDay.get(todayKey) ?? 0;
  const todayNoteWords = noteWordsByDay.get(todayKey) ?? 0;
  const todayMinutesProgress = Math.min(30, todayFocusMinutes);
  const todayWordsProgress = Math.min(33, todayNoteWords);

  return {
    // Maps
    sessionMinutesByDay,
    noteWordsByDay,
    completedBlocksByDay,
    protectedStreakDateKeys,
    // Qualified dates
    streakQualifiedDateKeys,
    // Streak values
    streak,
    displayStreak,
    hasEarnedToday,
    carriedRunThroughYesterday,
    streakBandanaTier,
    xpTierTheme,
    historicalStreaksByDay,
    // Sick-day save
    monthlyStreakSaveCount,
    streakSaveSlotsLeft,
    sickDaySaveEligible,
    yesterdaySave,
    rawYesterdayMissed,
    // XP
    xpByDay,
    lifetimeXpSummary,
    formattedLifetimeXp,
    formattedXpToNextLevel,
    // Today
    todayKey,
    yesterdayKey,
    dayBeforeYesterdayKey,
    todayFocusMinutes,
    todayNoteWords,
    todayMinutesProgress,
    todayWordsProgress,
  };
}
