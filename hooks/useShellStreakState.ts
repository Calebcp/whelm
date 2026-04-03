"use client";

import { useMemo } from "react";

import { useStreak } from "@/hooks/useStreak";
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

  return {
    ...streakState,
    visibleBandanaColor,
    streakSaveMonthlyLimit,
  };
}
