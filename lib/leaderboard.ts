import { getStreakBandanaTier } from "@/lib/streak-bandanas";
import { normalizeUsername, usernameKey } from "@/lib/username";

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
  /** Longest streak ever achieved — used in public profile cards. */
  bestStreak: number;
  /** Lifetime focus minutes ÷ 60, rounded — used in public profile cards. */
  totalFocusHours: number;
  /** XP earned in the current ISO week (Mon–Sun). Reset every Monday. */
  weeklyXp: number;
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

export type LeaderboardBandanaHolderEntry = Pick<
  LeaderboardProfile,
  "userId" | "username" | "createdAtISO" | "totalXp" | "currentStreak" | "level" | "bestStreak" | "totalFocusHours"
>;

export type LeaderboardBandanaHolder = {
  color: string;
  label: string;
  entry: LeaderboardBandanaHolderEntry | null;
};

export type LeaderboardPageResponse = {
  metric: LeaderboardMetric;
  snapshotDate: string | null;
  items: LeaderboardSnapshotEntry[];
  aroundMe: LeaderboardSnapshotEntry[];
  bandanaHolders: LeaderboardBandanaHolder[];
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
  bestStreak?: number;
  totalFocusHours?: number;
  weeklyXp?: number;
}): LeaderboardProfile {
  const bandana = getStreakBandanaTier(input.currentStreak);
  const username = normalizeUsername(input.username) || "Whelm user";

  return {
    userId: input.userId,
    username,
    usernameLower: usernameKey(username),
    totalXp: Math.max(0, Math.round(input.totalXp)),
    currentStreak: Math.max(0, Math.round(input.currentStreak)),
    level: Math.max(1, Math.round(input.level)),
    createdAtISO: input.createdAtISO,
    updatedAtISO: input.updatedAtISO ?? new Date().toISOString(),
    bandanaColor: bandana?.color ?? null,
    bandanaLabel: bandana?.label ?? null,
    bestStreak: Math.max(0, Math.round(input.bestStreak ?? 0)),
    totalFocusHours: Math.max(0, Math.round(input.totalFocusHours ?? 0)),
    weeklyXp: Math.max(0, Math.round(input.weeklyXp ?? 0)),
  };
}

export function mergeLeaderboardProfiles(existing: LeaderboardProfile | null, incoming: LeaderboardProfile) {
  if (!existing) {
    return incoming;
  }

  const incomingWinsOnProgress = incoming.totalXp > existing.totalXp;
  const mergedCreatedAtISO =
    existing.createdAtISO <= incoming.createdAtISO ? existing.createdAtISO : incoming.createdAtISO;
  const mergedTotalXp = Math.max(existing.totalXp, incoming.totalXp);
  // Streak regressions are too destructive to trust from one client write.
  // Preserve the highest observed streak until we have a more authoritative
  // server-side streak source.
  const mergedCurrentStreak = Math.max(existing.currentStreak, incoming.currentStreak);
  const mergedWeeklyXp =
    incoming.totalXp > existing.totalXp
      ? incoming.weeklyXp
      : incoming.totalXp < existing.totalXp
        ? existing.weeklyXp
        : Math.max(existing.weeklyXp, incoming.weeklyXp);

  return buildLeaderboardProfile({
    userId: existing.userId || incoming.userId,
    username: incoming.username || existing.username,
    totalXp: mergedTotalXp,
    currentStreak: mergedCurrentStreak,
    level: incomingWinsOnProgress ? incoming.level : Math.max(existing.level, incoming.level),
    createdAtISO: mergedCreatedAtISO,
    updatedAtISO: new Date().toISOString(),
    bestStreak: Math.max(existing.bestStreak, incoming.bestStreak),
    totalFocusHours: Math.max(existing.totalFocusHours, incoming.totalFocusHours),
    weeklyXp: mergedWeeklyXp,
  });
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
