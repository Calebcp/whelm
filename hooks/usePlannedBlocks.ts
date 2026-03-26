"use client";

import { useMemo } from "react";

import { dayKeyLocal } from "@/lib/date-utils";
import type { PlannedBlockDoc } from "@/lib/planned-blocks-store";

export type { PlannedBlockDoc };

type UsePlannedBlocksInput = {
  plannedBlocks: PlannedBlockDoc[];
  plannedBlocksHydrated: boolean;
  selectedDateKey: string;
};

/**
 * Derives computed planned-block values from raw block state.
 * In Phase 3, this hook will own its own Firestore subscription and mutations.
 * For now it accepts state from page.tsx and computes derived values.
 */
export function usePlannedBlocks({
  plannedBlocks,
  plannedBlocksHydrated,
  selectedDateKey,
}: UsePlannedBlocksInput) {
  const completedBlocksByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const block of plannedBlocks) {
      if (block.status !== "completed") continue;
      map.set(block.dateKey, (map.get(block.dateKey) ?? 0) + 1);
    }
    return map;
  }, [plannedBlocks]);

  const todayKey = dayKeyLocal(new Date());

  const todayBlocks = useMemo(
    () => plannedBlocks.filter((b) => b.dateKey === todayKey),
    [plannedBlocks, todayKey],
  );

  const todayActiveBlocks = useMemo(
    () => todayBlocks.filter((b) => b.status === "active"),
    [todayBlocks],
  );

  const todayCompletedBlocks = useMemo(
    () => todayBlocks.filter((b) => b.status === "completed"),
    [todayBlocks],
  );

  const selectedDateBlocks = useMemo(
    () => plannedBlocks.filter((b) => b.dateKey === selectedDateKey),
    [plannedBlocks, selectedDateKey],
  );

  const blocksByDate = useMemo(() => {
    const map = new Map<string, PlannedBlockDoc[]>();
    for (const block of plannedBlocks) {
      const existing = map.get(block.dateKey) ?? [];
      map.set(block.dateKey, [...existing, block]);
    }
    return map;
  }, [plannedBlocks]);

  return {
    plannedBlocks,
    plannedBlocksHydrated,
    completedBlocksByDay,
    todayBlocks,
    todayActiveBlocks,
    todayCompletedBlocks,
    selectedDateBlocks,
    blocksByDate,
  };
}
