import { getStreakBandanaTier } from "@/lib/streak-bandanas";

export type LeaderboardMetric = "xp" | "streak";

export type LeaderboardProfile = {
  userId: string;
  username: string;
  usernameLower: string;
  totalXp: number;
  currentStreak: number;
  level: number;
  createdAtISO: string;
  updatedAtISO: string;
  bandanaColor: string | null;
  bandanaLabel: string | null;
};

export type LeaderboardMovementDirection = "up" | "down" | "same" | "new";

export type LeaderboardSnapshotEntry = LeaderboardProfile & {
  snapshotDate: string;
  metric: LeaderboardMetric;
  rank: number;
  previousRank: number | null;
  movement: number;
  movementDirection: LeaderboardMovementDirection;
};

export type LeaderboardPageResponse = {
  metric: LeaderboardMetric;
  snapshotDate: string | null;
  items: LeaderboardSnapshotEntry[];
  aroundMe: LeaderboardSnapshotEntry[];
  nextCursor: string | null;
  hasMore: boolean;
  totalEntries: number;
  source: "snapshot" | "fallback";
};

export function compareLeaderboardProfiles(
  left: Pick<LeaderboardProfile, "totalXp" | "currentStreak" | "createdAtISO">,
  right: Pick<LeaderboardProfile, "totalXp" | "currentStreak" | "createdAtISO">,
  metric: LeaderboardMetric,
) {
  if (metric === "xp") {
    return (
      right.totalXp - left.totalXp ||
      right.currentStreak - left.currentStreak ||
      left.createdAtISO.localeCompare(right.createdAtISO)
    );
  }

  return (
    right.currentStreak - left.currentStreak ||
    right.totalXp - left.totalXp ||
    left.createdAtISO.localeCompare(right.createdAtISO)
  );
}

export function movementDirection(currentRank: number, previousRank: number | null): LeaderboardMovementDirection {
  if (previousRank === null) return "new";
  if (previousRank > currentRank) return "up";
  if (previousRank < currentRank) return "down";
  return "same";
}

export function buildLeaderboardProfile(input: {
  userId: string;
  username: string;
  totalXp: number;
  currentStreak: number;
  level: number;
  createdAtISO: string;
  updatedAtISO?: string;
}): LeaderboardProfile {
  const bandana = getStreakBandanaTier(input.currentStreak);

  return {
    userId: input.userId,
    username: input.username.trim() || "Whelm user",
    usernameLower: (input.username.trim() || "Whelm user").toLowerCase(),
    totalXp: Math.max(0, Math.round(input.totalXp)),
    currentStreak: Math.max(0, Math.round(input.currentStreak)),
    level: Math.max(1, Math.round(input.level)),
    createdAtISO: input.createdAtISO,
    updatedAtISO: input.updatedAtISO ?? new Date().toISOString(),
    bandanaColor: bandana?.color ?? null,
    bandanaLabel: bandana?.label ?? null,
  };
}

export function snapshotRunDocId(snapshotDate: string, metric: LeaderboardMetric) {
  return `${snapshotDate}_${metric}`;
}

export function snapshotEntryDocId(snapshotDate: string, metric: LeaderboardMetric, userId: string) {
  return `${snapshotDate}_${metric}_${userId}`;
}

export function decodeCursor(cursor: string | null) {
  if (!cursor) return 0;
  const parsed = Number(cursor);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function encodeCursor(rank: number | null) {
  return rank === null ? null : String(rank);
}
