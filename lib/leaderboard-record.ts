import type { LifetimeXpSummary } from "@/lib/xp-engine";

export type CanonicalLeaderboardSelf = {
  id: string;
  username: string;
  createdAtISO: string;
  level: number;
  totalXp: number;
  currentStreak: number;
  bestStreak: number;
  totalFocusHours: number;
  avatarUrl: string | null;
  isProStyle: boolean;
  isCurrentUser: true;
};

export type LeaderboardRecordShape = {
  id: string;
  username: string;
  createdAtISO: string;
  level: number;
  totalXp: number;
  currentStreak: number;
  bestStreak?: number;
  totalFocusHours?: number;
  avatarUrl?: string | null;
  isProStyle?: boolean;
  isCurrentUser?: boolean;
};

export function buildCanonicalLeaderboardSelf({
  currentUserId,
  currentUserPhotoUrl,
  currentUserCreatedAtISO,
  profileDisplayName,
  displayStreak,
  isPro,
  lifetimeXpSummary,
  myBestStreak,
  myTotalFocusHours,
}: {
  currentUserId: string;
  currentUserPhotoUrl: string | null;
  currentUserCreatedAtISO: string;
  profileDisplayName: string;
  displayStreak: number;
  isPro: boolean;
  lifetimeXpSummary: LifetimeXpSummary;
  myBestStreak: number;
  myTotalFocusHours: number;
}): CanonicalLeaderboardSelf {
  return {
    id: currentUserId,
    username: profileDisplayName,
    createdAtISO: currentUserCreatedAtISO,
    level: lifetimeXpSummary.currentLevel,
    totalXp: lifetimeXpSummary.totalXp,
    currentStreak: displayStreak,
    bestStreak: myBestStreak,
    totalFocusHours: myTotalFocusHours,
    avatarUrl: currentUserPhotoUrl,
    isProStyle: isPro,
    isCurrentUser: true,
  };
}

export function adoptCanonicalLeaderboardSelf<T extends LeaderboardRecordShape>(
  entry: T,
  canonicalSelf: CanonicalLeaderboardSelf,
) {
  if (entry.id !== canonicalSelf.id) {
    return entry;
  }

  return {
    ...entry,
    ...canonicalSelf,
  };
}
