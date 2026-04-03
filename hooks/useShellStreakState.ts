"use client";

import { useMemo } from "react";

import { useStreak } from "@/hooks/useStreak";
import { buildStreakLedger } from "@/lib/streak-ledger";
import type { ShellStreakSummaryBase } from "@/lib/streak-record";
import { getWhelmStreakSaveMonthlyLimit } from "@/lib/whelm-plans";
import type { WhelBandanaColor } from "@/lib/whelm-mascot";
import type { LifetimeXpSummary } from "@/lib/xp-engine";

type SickDaySaveInput = {
  dateKey: string;
  claimedAtISO: string;
};

export function useShellStreakState({
  isPro,
  streak,
  streakQualifiedDateKeys,
  sessionMinutesByDay,
  noteWordsByDay,
  completedBlocksByDay,
  sickDaySaves,
  sickDaySaveDismissals,
  lifetimeXpSummary,
  bandanaColor,
  streakIsProvisional,
}: {
  isPro: boolean;
  streak: number;
  streakQualifiedDateKeys: string[];
  sessionMinutesByDay: Map<string, number>;
  noteWordsByDay: Map<string, number>;
  completedBlocksByDay: Map<string, number>;
  sickDaySaves: SickDaySaveInput[];
  sickDaySaveDismissals: string[];
  lifetimeXpSummary: LifetimeXpSummary;
  bandanaColor: WhelBandanaColor;
  streakIsProvisional: boolean;
}) {
  const streakState = useStreak({
    isPro,
    streak,
    streakQualifiedDateKeys,
    sessionMinutesByDay,
    noteWordsByDay,
    completedBlocksByDay,
    sickDaySaves,
    sickDaySaveDismissals,
    lifetimeXpSummary,
  });

  const visibleBandanaColor = useMemo(
    () => (streakState.streakBandanaTier?.color ?? bandanaColor) as WhelBandanaColor,
    [bandanaColor, streakState.streakBandanaTier?.color],
  );

  const streakSaveMonthlyLimit = useMemo(
    () => getWhelmStreakSaveMonthlyLimit(isPro),
    [isPro],
  );

  const streakSummaryBase = useMemo<ShellStreakSummaryBase>(
    () => ({
      isReady: !streakIsProvisional,
      visibleBandanaColor,
      streakBandanaLabel: streakState.streakBandanaTier?.label ?? null,
      displayStreak: streakState.displayStreak,
      longestStreak: streakState.longestStreak,
      nextBandanaMilestone: streakState.nextBandanaMilestone,
    }),
    [
      streakIsProvisional,
      visibleBandanaColor,
      streakState.displayStreak,
      streakState.longestStreak,
      streakState.nextBandanaMilestone,
      streakState.streakBandanaTier?.label,
    ],
  );

  const streakDailyRecords = useMemo(
    () =>
      buildStreakLedger({
        sessionMinutesByDay,
        completedBlocksByDay,
        noteWordsByDay,
        protectedStreakDateKeys: sickDaySaves.map((save) => save.dateKey),
        todayKey: streakState.todayKey,
      }),
    [
      completedBlocksByDay,
      noteWordsByDay,
      sessionMinutesByDay,
      sickDaySaves,
      streakState.todayKey,
    ],
  );

  return {
    ...streakState,
    visibleBandanaColor,
    streakSaveMonthlyLimit,
    streakSummaryBase,
    streakDailyRecords,
  };
}
