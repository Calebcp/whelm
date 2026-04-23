"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";

import {
  trackLeaderboardAroundMeLoaded,
  trackLeaderboardPageLoaded,
  trackLeaderboardTabSwitched,
  trackLeaderboardViewed,
} from "@/lib/analytics-tracker";
import type { AppTab } from "@/lib/app-tabs";
import { resolveApiUrl } from "@/lib/api-base";
import {
  buildCanonicalLeaderboardSelf,
} from "@/lib/leaderboard-record";
import { canSyncLeaderboardProfile } from "@/lib/leaderboard-sync";
import {
  type LeaderboardBandanaHolder as RemoteLeaderboardBandanaHolder,
  type LeaderboardMetric,
  type LeaderboardPageResponse,
  type LeaderboardSnapshotEntry,
} from "@/lib/leaderboard";
import { STREAK_BANDANA_TIERS, getStreakBandanaTier } from "@/lib/streak-bandanas";
import type { SessionDoc } from "@/lib/streak";
import { getLifetimeXpSummary, type LifetimeXpSummary } from "@/lib/xp-engine";

export type { LeaderboardSnapshotEntry };

export type LeaderboardMetricTab = "xp" | "streak";

export type LeaderboardEntry = {
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

export type LeaderboardMovement = {
  delta: number;
  previousRank: number | null;
  direction: "up" | "down" | "same" | "new";
};

export type LeaderboardBandanaHolder = {
  color: string;
  label: string;
  entry: LeaderboardEntry | null;
};

export type LeaderboardRowData = {
  entry: LeaderboardEntry;
  rank: number;
  movement: LeaderboardMovement;
};

type UseLeaderboardOptions = {
  activeTab: AppTab;
  user: User | null;
  currentUserId: string;
  currentUserPhotoUrl: string | null;
  currentUserCreatedAtISO: string;
  profileDisplayName: string;
  displayStreak: number;
  isPro: boolean;
  lifetimeXpSummary: LifetimeXpSummary;
  historicalStreaksByDay: Map<string, number>;
  sessions: SessionDoc[];
  sessionsSynced: boolean;
  streakIsProvisional: boolean;
  weeklyXp: number;
};

const LEADERBOARD_SEED_DATA: ReadonlyArray<{
  id: string;
  username: string;
  totalXp: number;
  currentStreak: number;
  createdAtISO: string;
}> = [
  { id: "seed-1", username: "Astra Vale", totalXp: 28640, currentStreak: 123, createdAtISO: "2024-01-04T08:30:00.000Z" },
  { id: "seed-2", username: "Soren Pike", totalXp: 21480, currentStreak: 74, createdAtISO: "2024-01-12T12:15:00.000Z" },
  { id: "seed-3", username: "Mira Sol", totalXp: 18420, currentStreak: 33, createdAtISO: "2024-02-09T10:20:00.000Z" },
  { id: "seed-4", username: "Kael Mercer", totalXp: 15110, currentStreak: 18, createdAtISO: "2024-02-21T07:10:00.000Z" },
  { id: "seed-5", username: "Talia Reed", totalXp: 12340, currentStreak: 8, createdAtISO: "2024-03-03T09:45:00.000Z" },
  { id: "seed-6", username: "Juno Hart", totalXp: 9780, currentStreak: 4, createdAtISO: "2024-03-18T14:05:00.000Z" },
  { id: "seed-7", username: "Ren Kade", totalXp: 8325, currentStreak: 2, createdAtISO: "2024-04-06T16:25:00.000Z" },
  { id: "seed-8", username: "Ivo Lane", totalXp: 6940, currentStreak: 1, createdAtISO: "2024-04-19T11:50:00.000Z" },
  { id: "seed-9", username: "Nova Chen", totalXp: 5420, currentStreak: 57, createdAtISO: "2024-05-08T13:30:00.000Z" },
  { id: "seed-10", username: "Eden Cross", totalXp: 11960, currentStreak: 21, createdAtISO: "2024-05-12T15:40:00.000Z" },
] as const;

const LEADERBOARD_PREVIOUS_SNAPSHOT: ReadonlyArray<{
  id: string;
  username: string;
  totalXp: number;
  currentStreak: number;
  createdAtISO: string;
}> = [
  { id: "seed-1", username: "Astra Vale", totalXp: 27880, currentStreak: 121, createdAtISO: "2024-01-04T08:30:00.000Z" },
  { id: "seed-2", username: "Soren Pike", totalXp: 21310, currentStreak: 73, createdAtISO: "2024-01-12T12:15:00.000Z" },
  { id: "seed-3", username: "Mira Sol", totalXp: 18340, currentStreak: 31, createdAtISO: "2024-02-09T10:20:00.000Z" },
  { id: "seed-4", username: "Kael Mercer", totalXp: 14810, currentStreak: 17, createdAtISO: "2024-02-21T07:10:00.000Z" },
  { id: "seed-5", username: "Talia Reed", totalXp: 12180, currentStreak: 8, createdAtISO: "2024-03-03T09:45:00.000Z" },
  { id: "seed-6", username: "Juno Hart", totalXp: 9610, currentStreak: 4, createdAtISO: "2024-03-18T14:05:00.000Z" },
  { id: "seed-7", username: "Ren Kade", totalXp: 8250, currentStreak: 2, createdAtISO: "2024-04-06T16:25:00.000Z" },
  { id: "seed-8", username: "Ivo Lane", totalXp: 6895, currentStreak: 1, createdAtISO: "2024-04-19T11:50:00.000Z" },
  { id: "seed-9", username: "Nova Chen", totalXp: 5210, currentStreak: 54, createdAtISO: "2024-05-08T13:30:00.000Z" },
  { id: "seed-10", username: "Eden Cross", totalXp: 12040, currentStreak: 19, createdAtISO: "2024-05-12T15:40:00.000Z" },
] as const;

function compareLeaderboardEntries(
  left: LeaderboardEntry,
  right: LeaderboardEntry,
  tab: LeaderboardMetricTab,
) {
  if (tab === "xp") {
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

function movementForRanks(currentRank: number, previousRank: number | null): LeaderboardMovement {
  if (previousRank === null) {
    return { delta: 0, previousRank, direction: "new" };
  }

  const delta = previousRank - currentRank;
  if (delta > 0) return { delta, previousRank, direction: "up" };
  if (delta < 0) return { delta, previousRank, direction: "down" };
  return { delta: 0, previousRank, direction: "same" };
}

function movementFromSnapshot(entry: LeaderboardSnapshotEntry): LeaderboardMovement {
  return {
    delta: entry.movement,
    previousRank: entry.previousRank,
    direction: entry.movementDirection,
  };
}

function seenChallengersStorageKey(uid: string) {
  return `whelm:seen-challengers:${uid}`;
}

function previousRanksStorageKey(uid: string, metric: LeaderboardMetric) {
  return `whelm:leaderboard-prev-ranks:${uid}:${metric}`;
}

function persistentMovementStorageKey(uid: string, metric: LeaderboardMetric) {
  return `whelm:leaderboard-movement:${uid}:${metric}`;
}

function resolvePersistentMovement(
  current: LeaderboardMovement,
  cached: LeaderboardMovement | null | undefined,
) {
  if (current.direction === "up" || current.direction === "down") {
    return current;
  }
  if (cached && (cached.direction === "up" || cached.direction === "down")) {
    return cached;
  }
  return current;
}

function matchesBandanaBucket(streak: number, color: string) {
  if (color === "yellow") {
    return streak <= 1;
  }
  return getStreakBandanaTier(streak)?.color === color;
}

function isAbortLikeError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  return error instanceof Error && error.name === "AbortError";
}

export function useLeaderboard({
  activeTab,
  user,
  currentUserId,
  currentUserPhotoUrl,
  currentUserCreatedAtISO,
  profileDisplayName,
  displayStreak,
  isPro,
  lifetimeXpSummary,
  historicalStreaksByDay,
  sessions,
  sessionsSynced,
  streakIsProvisional,
  weeklyXp,
}: UseLeaderboardOptions) {
  const [leaderboardMetricTab, setLeaderboardMetricTab] = useState<LeaderboardMetricTab>("xp");
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardPageItems, setLeaderboardPageItems] = useState<LeaderboardSnapshotEntry[]>([]);
  const [leaderboardAroundMeItems, setLeaderboardAroundMeItems] = useState<LeaderboardSnapshotEntry[]>([]);
  const [leaderboardCursor, setLeaderboardCursor] = useState<string | null>(null);
  const [leaderboardHasMore, setLeaderboardHasMore] = useState(false);
  const [leaderboardSnapshotDate, setLeaderboardSnapshotDate] = useState<string | null>(null);
  const [leaderboardSource, setLeaderboardSource] = useState<LeaderboardPageResponse["source"]>("fallback");
  const [leaderboardTotalEntries, setLeaderboardTotalEntries] = useState(0);
  const [leaderboardRemoteBandanaHolders, setLeaderboardRemoteBandanaHolders] = useState<
    RemoteLeaderboardBandanaHolder[]
  >([]);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [leaderboardIsLive, setLeaderboardIsLive] = useState(false);
  const [seenChallengerIds, setSeenChallengerIds] = useState<Set<string>>(new Set());
  const [cachedPreviousRanks, setCachedPreviousRanks] = useState<Map<string, number>>(new Map());
  const [cachedMovementById, setCachedMovementById] = useState<Map<string, LeaderboardMovement>>(new Map());

  const myBestStreak = useMemo(
    () => Math.max(0, ...Array.from(historicalStreaksByDay.values())),
    [historicalStreaksByDay],
  );
  const myTotalFocusHours = useMemo(
    () => Math.round(sessions.reduce((sum, session) => sum + session.minutes, 0) / 60),
    [sessions],
  );
  const canonicalCurrentUserEntry = useMemo(
    () =>
      buildCanonicalLeaderboardSelf({
        currentUserId,
        currentUserPhotoUrl,
        currentUserCreatedAtISO,
        profileDisplayName,
        displayStreak,
        isPro,
        lifetimeXpSummary,
        myBestStreak,
        myTotalFocusHours,
      }),
    [
      currentUserCreatedAtISO,
      currentUserId,
      currentUserPhotoUrl,
      displayStreak,
      isPro,
      lifetimeXpSummary,
      myBestStreak,
      myTotalFocusHours,
      profileDisplayName,
    ],
  );

  const leaderboardEntries = useMemo<LeaderboardEntry[]>(() => {
    const seeded = LEADERBOARD_SEED_DATA.map((entry) => ({
      id: entry.id,
      username: entry.username,
      createdAtISO: entry.createdAtISO,
      totalXp: entry.totalXp,
      currentStreak: entry.currentStreak,
      level: getLifetimeXpSummary(entry.totalXp, 0).currentLevel,
    }));

    return [...seeded, canonicalCurrentUserEntry];
  }, [
    canonicalCurrentUserEntry,
  ]);

  const leaderboardPreviousSnapshotEntries = useMemo<LeaderboardEntry[]>(() => {
    const seeded = LEADERBOARD_PREVIOUS_SNAPSHOT.map((entry) => ({
      id: entry.id,
      username: entry.username,
      createdAtISO: entry.createdAtISO,
      totalXp: entry.totalXp,
      currentStreak: entry.currentStreak,
      level: getLifetimeXpSummary(entry.totalXp, 0).currentLevel,
    }));

    const currentEntry: LeaderboardEntry = {
      id: currentUserId,
      username: profileDisplayName,
      createdAtISO: currentUserCreatedAtISO,
      level: getLifetimeXpSummary(Math.max(0, lifetimeXpSummary.totalXp - 420), 0).currentLevel,
      totalXp: Math.max(0, lifetimeXpSummary.totalXp - 420),
      currentStreak: Math.max(0, displayStreak - 1),
      avatarUrl: currentUserPhotoUrl,
      isProStyle: isPro,
      isCurrentUser: true,
    };

    return [...seeded, currentEntry];
  }, [
    currentUserCreatedAtISO,
    currentUserId,
    currentUserPhotoUrl,
    displayStreak,
    isPro,
    lifetimeXpSummary.totalXp,
    profileDisplayName,
  ]);

  const leaderboardSortedEntries = useMemo(
    () => [...leaderboardEntries].sort((left, right) => compareLeaderboardEntries(left, right, leaderboardMetricTab)),
    [leaderboardEntries, leaderboardMetricTab],
  );

  const leaderboardPreviousRankMaps = useMemo(() => {
    const xp = new Map<string, number>();
    [...leaderboardPreviousSnapshotEntries]
      .sort((left, right) => compareLeaderboardEntries(left, right, "xp"))
      .forEach((entry, index) => xp.set(entry.id, index + 1));

    const streak = new Map<string, number>();
    [...leaderboardPreviousSnapshotEntries]
      .sort((left, right) => compareLeaderboardEntries(left, right, "streak"))
      .forEach((entry, index) => streak.set(entry.id, index + 1));

    return { xp, streak };
  }, [leaderboardPreviousSnapshotEntries]);

  const leaderboardFallbackRows = useMemo<LeaderboardRowData[]>(
    () =>
      leaderboardSortedEntries.map((entry, index) => ({
        entry,
        rank: index + 1,
        movement: movementForRanks(
          index + 1,
          leaderboardPreviousRankMaps[leaderboardMetricTab].get(entry.id) ?? null,
        ),
      })),
    [leaderboardMetricTab, leaderboardPreviousRankMaps, leaderboardSortedEntries],
  );

  const leaderboardRemoteRows = useMemo<LeaderboardRowData[]>(
    () =>
      leaderboardPageItems.map((entry) => {
        const isMe = entry.userId === currentUserId;
        const previousRank = entry.previousRank ?? cachedPreviousRanks.get(entry.userId) ?? null;
        const currentMovement =
          previousRank !== null
            ? movementForRanks(entry.rank, previousRank)
            : movementFromSnapshot(entry);
        return {
          entry: {
            id: entry.userId,
            username: isMe ? profileDisplayName : entry.username,
            createdAtISO: entry.createdAtISO,
            totalXp: entry.totalXp,
            currentStreak: entry.currentStreak,
            level: entry.level,
            bestStreak: entry.bestStreak ?? 0,
            totalFocusHours: entry.totalFocusHours ?? 0,
            avatarUrl: isMe ? currentUserPhotoUrl : null,
            isProStyle: isMe ? isPro : false,
            isCurrentUser: isMe,
          },
          rank: entry.rank,
          movement: resolvePersistentMovement(currentMovement, cachedMovementById.get(entry.userId)),
        };
      }),
    [
      cachedMovementById,
      cachedPreviousRanks,
      currentUserId,
      currentUserPhotoUrl,
      isPro,
      leaderboardPageItems,
      profileDisplayName,
    ],
  );

  const leaderboardAroundRows = useMemo<LeaderboardRowData[]>(
    () =>
      leaderboardAroundMeItems.map((entry) => {
        const isMe = entry.userId === currentUserId;
        const previousRank = entry.previousRank ?? cachedPreviousRanks.get(entry.userId) ?? null;
        const currentMovement =
          previousRank !== null
            ? movementForRanks(entry.rank, previousRank)
            : movementFromSnapshot(entry);
        return {
          entry: {
            id: entry.userId,
            username: isMe ? profileDisplayName : entry.username,
            createdAtISO: entry.createdAtISO,
            totalXp: entry.totalXp,
            currentStreak: entry.currentStreak,
            level: entry.level,
            bestStreak: entry.bestStreak ?? 0,
            totalFocusHours: entry.totalFocusHours ?? 0,
            avatarUrl: isMe ? currentUserPhotoUrl : null,
            isProStyle: isMe ? isPro : false,
            isCurrentUser: isMe,
          },
          rank: entry.rank,
          movement: resolvePersistentMovement(currentMovement, cachedMovementById.get(entry.userId)),
        };
      }),
    [
      cachedMovementById,
      cachedPreviousRanks,
      currentUserId,
      currentUserPhotoUrl,
      isPro,
      leaderboardAroundMeItems,
      profileDisplayName,
    ],
  );

  const leaderboardRows =
    leaderboardSource === "snapshot" && leaderboardRemoteRows.length > 0
      ? leaderboardRemoteRows
      : leaderboardFallbackRows;

  const leaderboardCurrentUserRank =
    (leaderboardSource === "snapshot" && leaderboardAroundRows.find((row) => row.entry.isCurrentUser)?.rank) ??
    leaderboardRows.find((row) => row.entry.isCurrentUser)?.rank ??
    0;

  const leaderboardCurrentUserMovement =
    (leaderboardSource === "snapshot"
      ? leaderboardAroundRows.find((row) => row.entry.isCurrentUser)?.movement
      : undefined) ??
    leaderboardRows.find((row) => row.entry.isCurrentUser)?.movement ?? {
      delta: 0,
      previousRank: null,
      direction: "same" as const,
    };

  const leaderboardBandanaHolders = useMemo<LeaderboardBandanaHolder[]>(() => {
    if (leaderboardSource === "snapshot" && leaderboardRemoteBandanaHolders.length > 0) {
      return leaderboardRemoteBandanaHolders.map((holder) => ({
        color: holder.color,
        label: holder.label,
        entry: holder.entry
          ? {
              id: holder.entry.userId,
              username: holder.entry.userId === currentUserId ? profileDisplayName : holder.entry.username,
              createdAtISO: holder.entry.createdAtISO,
              totalXp: holder.entry.totalXp,
              currentStreak: holder.entry.currentStreak,
              level: holder.entry.level,
              bestStreak: holder.entry.bestStreak,
              totalFocusHours: holder.entry.totalFocusHours,
              avatarUrl: holder.entry.userId === currentUserId ? currentUserPhotoUrl : null,
              isProStyle: holder.entry.userId === currentUserId ? isPro : false,
              isCurrentUser: holder.entry.userId === currentUserId,
            }
          : null,
      }));
    }

    const sourceEntries =
      leaderboardSource === "snapshot" && leaderboardPageItems.length > 0
        ? leaderboardPageItems.map((entry) => {
            const isMe = entry.userId === currentUserId;
            return {
              id: entry.userId,
              username: isMe ? profileDisplayName : entry.username,
              createdAtISO: entry.createdAtISO,
              totalXp: entry.totalXp,
              currentStreak: entry.currentStreak,
              level: entry.level,
              avatarUrl: isMe ? currentUserPhotoUrl : null,
              isProStyle: isMe ? isPro : false,
            };
          })
        : leaderboardEntries;

    return STREAK_BANDANA_TIERS.map((tier) => {
      const topEntry =
        [...sourceEntries]
          .filter((entry) => matchesBandanaBucket(entry.currentStreak, tier.color))
          .sort((left, right) => compareLeaderboardEntries(left, right, "xp"))[0] ?? null;

      return {
        color: tier.color,
        label: `Top ${tier.label.replace(" Bandana", "")}`,
        entry: topEntry,
      };
    });
  }, [
    currentUserId,
    currentUserPhotoUrl,
    isPro,
    leaderboardEntries,
    leaderboardPageItems,
    leaderboardRemoteBandanaHolders,
    leaderboardSource,
    profileDisplayName,
  ]);

  const leaderboardHasEntries = leaderboardRows.length > 0;

  const setLeaderboardMetricTabTracked = useCallback((nextTab: LeaderboardMetricTab) => {
    setLeaderboardMetricTab((current) => {
      if (current === nextTab) return current;
      if (user) {
        void trackLeaderboardTabSwitched(user, {
          fromMetric: current,
          toMetric: nextTab,
        }).catch(() => undefined);
      }
      return nextTab;
    });
  }, [user]);

  const handleLeaderboardLoadMore = useCallback(async () => {
    if (!user || !leaderboardHasMore || !leaderboardCursor) return;
    const controller = new AbortController();
    setLeaderboardLoading(true);
    setLeaderboardError("");

    try {
      const token = await user.getIdToken();
      const url = new URL(resolveApiUrl("/api/leaderboard"), window.location.origin);
      url.searchParams.set("metric", leaderboardMetricTab);
      url.searchParams.set("limit", "20");
      url.searchParams.set("userId", user.uid);
      url.searchParams.set("cursor", leaderboardCursor);
      url.searchParams.set("aroundWindow", "2");

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
      const body = (await response.json()) as LeaderboardPageResponse | { error?: string };
      if (!response.ok) {
        throw new Error(("error" in body && body.error) || "Failed to load more leaderboard entries.");
      }

      const payload = body as LeaderboardPageResponse;
      setLeaderboardPageItems((current) => [...current, ...payload.items]);
      setLeaderboardCursor(payload.nextCursor);
      setLeaderboardHasMore(payload.hasMore);
      setLeaderboardSnapshotDate(payload.snapshotDate);
      setLeaderboardSource(payload.source);
      setLeaderboardTotalEntries(payload.totalEntries);
      setLeaderboardRemoteBandanaHolders(payload.bandanaHolders ?? []);
      setLeaderboardIsLive(payload.source === "snapshot");

      void trackLeaderboardPageLoaded(user, {
        metric: leaderboardMetricTab,
        pageSize: payload.items.length,
        cursor: leaderboardCursor,
        snapshotDate: payload.snapshotDate,
      }).catch(() => undefined);
    } catch (error: unknown) {
      if (controller.signal.aborted || isAbortLikeError(error)) {
        return;
      }
      setLeaderboardError(
        error instanceof Error ? error.message : "Failed to load more leaderboard entries.",
      );
    } finally {
      setLeaderboardLoading(false);
    }
  }, [leaderboardCursor, leaderboardHasMore, leaderboardMetricTab, user]);

  useEffect(() => {
    if (!user) {
      setSeenChallengerIds(new Set());
      return;
    }
    try {
      const raw = window.localStorage.getItem(seenChallengersStorageKey(user.uid));
      setSeenChallengerIds(raw ? new Set(JSON.parse(raw) as string[]) : new Set());
    } catch {
      setSeenChallengerIds(new Set());
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCachedPreviousRanks(new Map());
      return;
    }
    try {
      const raw = window.localStorage.getItem(previousRanksStorageKey(user.uid, leaderboardMetricTab));
      const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      setCachedPreviousRanks(
        new Map(Object.entries(parsed).map(([id, rank]) => [id, Number(rank) || 0])),
      );
    } catch {
      setCachedPreviousRanks(new Map());
    }
  }, [leaderboardMetricTab, user]);

  useEffect(() => {
    if (!user) {
      setCachedMovementById(new Map());
      return;
    }
    try {
      const raw = window.localStorage.getItem(persistentMovementStorageKey(user.uid, leaderboardMetricTab));
      const parsed = raw ? (JSON.parse(raw) as Record<string, LeaderboardMovement>) : {};
      setCachedMovementById(new Map(Object.entries(parsed)));
    } catch {
      setCachedMovementById(new Map());
    }
  }, [leaderboardMetricTab, user]);

  useEffect(() => {
    const currentUser = user;
    if (!currentUser || !canSyncLeaderboardProfile({ sessionsSynced, streakIsProvisional })) return;
    const authedUser = currentUser;

    const controller = new AbortController();

    async function syncLeaderboardProfile(isRetry = false) {
      try {
        const token = await authedUser.getIdToken();
        const response = await fetch(resolveApiUrl("/api/leaderboard/profile"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: authedUser.uid,
            username: profileDisplayName,
            totalXp: lifetimeXpSummary.totalXp,
            currentStreak: displayStreak,
            level: lifetimeXpSummary.currentLevel,
            createdAtISO: authedUser.metadata.creationTime
              ? new Date(authedUser.metadata.creationTime).toISOString()
              : new Date().toISOString(),
            bestStreak: myBestStreak,
            totalFocusHours: myTotalFocusHours,
            weeklyXp,
          }),
          signal: controller.signal,
        });
        if (!response.ok && !isRetry && !controller.signal.aborted) {
          // Single retry on server error.
          void syncLeaderboardProfile(true);
        }
      } catch {
        if (!isRetry && !controller.signal.aborted) {
          // Single retry on network error after a short delay.
          window.setTimeout(() => { void syncLeaderboardProfile(true); }, 3000);
        }
      }
    }

    void syncLeaderboardProfile();
    return () => controller.abort();
  }, [
    sessionsSynced,
    streakIsProvisional,
    displayStreak,
    lifetimeXpSummary.currentLevel,
    lifetimeXpSummary.totalXp,
    myBestStreak,
    myTotalFocusHours,
    weeklyXp,
    profileDisplayName,
    user,
  ]);

  useEffect(() => {
    if (activeTab !== "leaderboard") return;
    const currentUser = user;
    if (!currentUser) return;
    if (!sessionsSynced) return;
    const authedUser = currentUser;
    const controller = new AbortController();

    let cancelled = false;
    let timeoutId: number | null = null;

    async function loadLeaderboard() {
      setLeaderboardLoading(true);
      setLeaderboardError("");

      try {
        const token = await authedUser.getIdToken();
        const url = new URL(resolveApiUrl("/api/leaderboard"), window.location.origin);
        url.searchParams.set("metric", leaderboardMetricTab);
        url.searchParams.set("limit", "20");
        url.searchParams.set("userId", authedUser.uid);
        url.searchParams.set("aroundWindow", "2");

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        const body = (await response.json()) as LeaderboardPageResponse | { error?: string };
        if (!response.ok) {
          throw new Error(("error" in body && body.error) || "Failed to load leaderboard.");
        }

        if (cancelled) return;
        const payload = body as LeaderboardPageResponse;
        setLeaderboardPageItems(payload.items);
        setLeaderboardAroundMeItems(payload.aroundMe);
        setLeaderboardCursor(payload.nextCursor);
        setLeaderboardHasMore(payload.hasMore);
        setLeaderboardSnapshotDate(payload.snapshotDate);
        setLeaderboardSource(payload.source);
        setLeaderboardTotalEntries(payload.totalEntries);
        setLeaderboardRemoteBandanaHolders(payload.bandanaHolders ?? []);
        setLeaderboardIsLive(payload.source === "snapshot");

        void trackLeaderboardPageLoaded(authedUser, {
          metric: leaderboardMetricTab,
          pageSize: payload.items.length,
          cursor: null,
          snapshotDate: payload.snapshotDate,
        }).catch(() => undefined);

        if (payload.aroundMe.length > 0) {
          void trackLeaderboardAroundMeLoaded(authedUser, {
            metric: leaderboardMetricTab,
            anchorRank:
              payload.aroundMe.find((entry) => entry.userId === authedUser.uid)?.rank ??
              payload.aroundMe[0].rank,
            resultCount: payload.aroundMe.length,
            snapshotDate: payload.snapshotDate,
          }).catch(() => undefined);
        }
      } catch (error: unknown) {
        if (cancelled || controller.signal.aborted || isAbortLikeError(error)) return;
        setLeaderboardPageItems([]);
        setLeaderboardAroundMeItems([]);
        setLeaderboardCursor(null);
        setLeaderboardHasMore(false);
        setLeaderboardSnapshotDate(null);
        setLeaderboardSource("fallback");
        setLeaderboardTotalEntries(0);
        setLeaderboardRemoteBandanaHolders([]);
        setLeaderboardIsLive(false);
        setLeaderboardError(error instanceof Error ? error.message : "Failed to load leaderboard.");
      } finally {
        if (!cancelled) {
          setLeaderboardLoading(false);
        }
      }
    }

    timeoutId = window.setTimeout(() => {
      void loadLeaderboard();
    }, 120);
    return () => {
      cancelled = true;
      controller.abort();
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    activeTab,
    displayStreak,
    leaderboardMetricTab,
    lifetimeXpSummary.totalXp,
    sessionsSynced,
    user,
  ]);

  useEffect(() => {
    setLeaderboardIsLive(false);
    setLeaderboardRemoteBandanaHolders([]);
  }, [activeTab, leaderboardMetricTab, user]);

  useEffect(() => {
    if (activeTab !== "leaderboard") return;
    const currentUser = user;
    if (!currentUser) return;
    void trackLeaderboardViewed(currentUser, {
      metric: leaderboardMetricTab,
      snapshotDate: leaderboardSnapshotDate,
    }).catch(() => undefined);
  }, [activeTab, leaderboardMetricTab, leaderboardSnapshotDate, user]);

  useEffect(() => {
    if (!user || leaderboardRows.length === 0) return;
    const newIds = leaderboardRows
      .filter((row) => row.movement.direction === "new" && !seenChallengerIds.has(row.entry.id))
      .map((row) => row.entry.id);
    if (newIds.length === 0) return;
    setSeenChallengerIds((prev) => {
      const next = new Set([...prev, ...newIds]);
      try {
        window.localStorage.setItem(seenChallengersStorageKey(user.uid), JSON.stringify([...next]));
      } catch {
        // Ignore local storage errors.
      }
      return next;
    });
  }, [leaderboardRows, seenChallengerIds, user]);

  useEffect(() => {
    if (!user) return;
    const rankMap = new Map<string, number>();
    leaderboardPageItems.forEach((entry) => rankMap.set(entry.userId, entry.rank));
    leaderboardAroundMeItems.forEach((entry) => rankMap.set(entry.userId, entry.rank));
    if (rankMap.size === 0) return;
    try {
      window.localStorage.setItem(
        previousRanksStorageKey(user.uid, leaderboardMetricTab),
        JSON.stringify(Object.fromEntries(rankMap)),
      );
    } catch {
      // Ignore local storage errors.
    }
  }, [leaderboardAroundMeItems, leaderboardMetricTab, leaderboardPageItems, user]);

  useEffect(() => {
    if (!user || leaderboardRows.length === 0) return;
    const next = new Map(cachedMovementById);
    let changed = false;
    leaderboardRows.forEach((row) => {
      if (row.movement.direction === "up" || row.movement.direction === "down") {
        const existing = next.get(row.entry.id);
        if (
          !existing ||
          existing.direction !== row.movement.direction ||
          existing.delta !== row.movement.delta ||
          existing.previousRank !== row.movement.previousRank
        ) {
          next.set(row.entry.id, row.movement);
          changed = true;
        }
      }
    });
    if (!changed) return;
    setCachedMovementById(next);
    try {
      window.localStorage.setItem(
        persistentMovementStorageKey(user.uid, leaderboardMetricTab),
        JSON.stringify(Object.fromEntries(next)),
      );
    } catch {
      // Ignore local storage errors.
    }
  }, [cachedMovementById, leaderboardMetricTab, leaderboardRows, user]);

  return {
    leaderboardMetricTab,
    setLeaderboardMetricTab: setLeaderboardMetricTabTracked,
    leaderboardCurrentUserRank,
    leaderboardCurrentUserMovement,
    leaderboardSource,
    leaderboardTotalEntries,
    leaderboardRows,
    leaderboardAroundRows,
    leaderboardBandanaHolders,
    leaderboardError,
    leaderboardLoading,
    leaderboardHasEntries,
    leaderboardHasMore,
    leaderboardIsLive,
    seenChallengerIds,
    handleLeaderboardLoadMore,
  };
}
