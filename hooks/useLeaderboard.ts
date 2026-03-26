"use client";

import { useMemo } from "react";

import type { LeaderboardSnapshotEntry } from "@/lib/leaderboard";
import type { LifetimeXpSummary } from "@/lib/xp-utils";

export type { LeaderboardSnapshotEntry };

type LeaderboardMovement = {
  delta: number;
  previousRank: number | null;
  direction: "up" | "down" | "same" | "new";
};

type LeaderboardRow = {
  entry: LeaderboardSnapshotEntry;
  rank: number;
  movement: LeaderboardMovement;
};

type UseLeaderboardInput = {
  leaderboardPageItems: LeaderboardSnapshotEntry[];
  leaderboardAroundItems: LeaderboardSnapshotEntry[];
  currentUserId: string;
  displayStreak: number;
  lifetimeXpSummary: LifetimeXpSummary;
  tierColor: string | null | undefined;
};

/**
 * Derives leaderboard display rows from raw snapshot data,
 * overriding the current user's entry with locally-computed values
 * so XP and streak are always accurate and never stale.
 */
export function useLeaderboard({
  leaderboardPageItems,
  leaderboardAroundItems,
  currentUserId,
  displayStreak,
  lifetimeXpSummary,
  tierColor,
}: UseLeaderboardInput) {
  const leaderboardRows = useMemo<LeaderboardRow[]>(() => {
    return leaderboardPageItems.map((entry) => {
      const isCurrentUser = entry.userId === currentUserId;
      const overriddenEntry = isCurrentUser
        ? {
            ...entry,
            totalXp: lifetimeXpSummary.totalXp,
            currentStreak: displayStreak,
            bandanaColor: tierColor ?? entry.bandanaColor,
          }
        : entry;

      return {
        entry: overriddenEntry,
        rank: entry.rank,
        movement: {
          delta: Math.abs(entry.movement),
          previousRank: entry.previousRank,
          direction: entry.movementDirection,
        },
      };
    });
  }, [leaderboardPageItems, currentUserId, displayStreak, lifetimeXpSummary.totalXp, tierColor]);

  const leaderboardAroundRows = useMemo<LeaderboardRow[]>(() => {
    return leaderboardAroundItems.map((entry) => {
      const isCurrentUser = entry.userId === currentUserId;
      const overriddenEntry = isCurrentUser
        ? {
            ...entry,
            totalXp: lifetimeXpSummary.totalXp,
            currentStreak: displayStreak,
            bandanaColor: tierColor ?? entry.bandanaColor,
          }
        : entry;

      return {
        entry: overriddenEntry,
        rank: entry.rank,
        movement: {
          delta: Math.abs(entry.movement),
          previousRank: entry.previousRank,
          direction: entry.movementDirection,
        },
      };
    });
  }, [leaderboardAroundItems, currentUserId, displayStreak, lifetimeXpSummary.totalXp, tierColor]);

  const currentUserRow = useMemo(
    () => leaderboardRows.find((row) => row.entry.userId === currentUserId) ?? null,
    [leaderboardRows, currentUserId],
  );

  return {
    leaderboardRows,
    leaderboardAroundRows,
    currentUserRow,
  };
}
