"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  dedupeSessions,
  loadSessions,
  readLocalSessions,
  syncMissingSessionsToCloud,
} from "@/lib/session-store";
import { computeStreak, type SessionDoc } from "@/lib/streak";
import { bandanaColorFromStreak } from "@/lib/whelm-mascot";
import { useMascot } from "@/hooks/useMascot";
import { trackAppOpened } from "@/lib/analytics-tracker";
import { dayKeyLocal } from "@/lib/date-utils";
import { logClientRuntime } from "@/lib/client-runtime";
import {
  buildStreakLedger,
  inferCompletedBlocksByDayFromSessions,
  mergeCompletedBlocksByDay,
} from "@/lib/streak-ledger";
import { resolveHydratedStreak } from "@/lib/streak-hydration";
import {
  buildDayXpSummaryForDate,
  getLifetimeXpSummary,
  type DayXpSummary,
  type LifetimeXpSummary,
  type SessionRewardState,
  type StreakCelebrationState,
  type StreakNudgeState,
} from "@/lib/xp-engine";
import type { XPPop } from "@/components/XPPopAnimation";

// ── Types ────────────────────────────────────────────────────────────────────

export type { DayXpSummary, LifetimeXpSummary, SessionRewardState, StreakCelebrationState, StreakNudgeState };

type UseUserDataOptions = {
  /** From usePlannedBlocks — how many completed blocks per calendar day */
  completedBlocksByDay: Map<string, number>;
  /** From useNotes — how many note words per calendar day */
  noteWordsByDay: Map<string, number>;
  /** From sickDaySaves — date keys that are protected from streak loss */
  protectedStreakDateKeys: string[];
  /** From usePlannedBlocks — true once the initial blocks snapshot has been received */
  plannedBlocksHydrated: boolean;
  /** From useNotes — whether note evidence has finished its initial sync path */
  notesHydrated: boolean;
  /** Called by the auth listener when a user signs in, so page.tsx can seed/load notes */
  onSignIn?: (uid: string) => void;
  /** Called by the auth listener when a user signs out, so page.tsx can clear its own state */
  onSignOut?: () => void;
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useUserData({
  completedBlocksByDay,
  noteWordsByDay,
  protectedStreakDateKeys,
  plannedBlocksHydrated,
  notesHydrated,
  onSignIn,
  onSignOut,
}: UseUserDataOptions) {
  // ── Auth + sessions ────────────────────────────────────────────────────────
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionsSynced, setSessionsSynced] = useState(false);

  // Guards against stale onSnapshot cache-fires overwriting sessions before
  // the initial localStorage→Firestore sync finishes.
  const sessionsSyncedRef = useRef(false);
  const authReadyRef = useRef(false);
  const appOpenTrackedRef = useRef<string | null>(null);
  const sessionsSyncInFlightRef = useRef(false);
  const sessionsRef = useRef<SessionDoc[]>([]);

  // ── XP/streak animation state ──────────────────────────────────────────────
  const [xpPops, setXpPops] = useState<XPPop[]>([]);
  const [sessionReward, setSessionReward] = useState<SessionRewardState | null>(null);
  const [streakCelebration, setStreakCelebration] = useState<StreakCelebrationState | null>(null);
  const [streakNudge, setStreakNudge] = useState<StreakNudgeState | null>(null);

  const triggerXPPop = useCallback((amount: number, x?: number, y?: number) => {
    const id = `xp-${Date.now()}-${Math.random()}`;
    setXpPops((prev) => [...prev, { id, amount, x, y }]);
  }, []);

  const removeXPPop = useCallback((id: string) => {
    setXpPops((prev) => prev.filter((p) => p.id !== id));
  }, []);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const applySessionsSnapshot = useCallback((remoteSessions: SessionDoc[]) => {
    const currentUser = auth.currentUser;
    const uid = currentUser?.uid;
    const localSessions = uid ? readLocalSessions(uid) : [];
    const merged = dedupeSessions([...remoteSessions, ...sessionsRef.current, ...localSessions]);
    const remoteWasStale = merged.length !== remoteSessions.length;

    sessionsRef.current = merged;
    setSessions(merged);
    sessionsSyncedRef.current = true;
    setSessionsSynced(true);

    if (!currentUser || !remoteWasStale || sessionsSyncInFlightRef.current) return;

    sessionsSyncInFlightRef.current = true;
    void syncMissingSessionsToCloud(currentUser, remoteSessions).finally(() => {
      sessionsSyncInFlightRef.current = false;
    });
  }, []);

  const refreshSessionsFromCloud = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const synced = await loadSessions(currentUser);
      sessionsRef.current = synced;
      setSessions(synced);
      sessionsSyncedRef.current = true;
      setSessionsSynced(true);
    } catch {
      // Keep local state when a visibility or focus refresh cannot reach cloud.
    }
  }, []);

  // ── Auth listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      const authEventStartedAt = performance.now();
      if (!nextUser) {
        console.info("[whelm:auth] signed out", { online: typeof navigator !== "undefined" ? navigator.onLine : undefined });
        appOpenTrackedRef.current = null;
        sessionsSyncedRef.current = false;
        setSessionsSynced(false);
        setUser(null);
        sessionsRef.current = [];
        setSessions([]);
        if (authReadyRef.current) {
          setAuthChecked(true);
        }
        onSignOut?.();
        return;
      }

      authReadyRef.current = true;
      logClientRuntime("auth-ready");
      setUser(nextUser);

      if (appOpenTrackedRef.current !== nextUser.uid) {
        appOpenTrackedRef.current = nextUser.uid;
        void trackAppOpened(nextUser, {
          screenName: "today",
          launchSource: "cold_start",
        }).catch(() => { /* non-critical */ });
      }

      setAuthChecked(true);

      // Seed sessions from localStorage immediately so XP shows at once.
      try {
        const raw = window.localStorage.getItem(`whelm:sessions:${nextUser.uid}`);
        const local = raw ? (JSON.parse(raw) as SessionDoc[]) : [];
        if (local.length > 0) {
          sessionsRef.current = local;
          setSessions(local);
        }
      } catch { /* ignore */ }

      // Kick off the Firestore sync (localStorage→Firestore merge).
      // Mark sync done when it resolves so onSnapshot callbacks take over.
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === nextUser.uid) {
        void loadSessions(currentUser)
          .then((synced) => {
            console.info("[whelm:auth] sessions loaded", {
              uid: nextUser.uid,
              sessionCount: synced.length,
              durationMs: Math.round(performance.now() - authEventStartedAt),
            });
            sessionsRef.current = synced;
            setSessions(synced);
            sessionsSyncedRef.current = true;
            setSessionsSynced(true);
          })
          .catch((error) => {
            console.warn("[whelm:auth] sessions load failed", {
              uid: nextUser.uid,
              durationMs: Math.round(performance.now() - authEventStartedAt),
              message: error instanceof Error ? error.message : "Unknown error",
            });
            sessionsSyncedRef.current = true;
            setSessionsSynced(true);
          });
      }

      // Delegate notes + other domain state to page.tsx.
      onSignIn?.(nextUser.uid);
    });

    return () => unsub();
  }, [onSignIn, onSignOut]);

  // Fallback: mark auth ready if the SDK lacks authStateReady().
  useEffect(() => {
    let cancelled = false;
    const waitForAuthReady =
      typeof auth.authStateReady === "function" ? auth.authStateReady() : Promise.resolve();

    waitForAuthReady.catch(() => undefined).finally(() => {
      if (cancelled || authReadyRef.current) return;
      authReadyRef.current = true;
      setUser(auth.currentUser);
      setAuthChecked(true);
    });

    return () => { cancelled = true; };
  }, []);

  // ── Streak computation ─────────────────────────────────────────────────────

  const sessionMinutesByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of sessions) {
      const key = dayKeyLocal(session.completedAtISO);
      map.set(key, (map.get(key) ?? 0) + session.minutes);
    }
    return map;
  }, [sessions]);

  const inferredCompletedBlocksByDay = useMemo(
    () => inferCompletedBlocksByDayFromSessions(sessions),
    [sessions],
  );

  const effectiveCompletedBlocksByDay = useMemo(
    () =>
      mergeCompletedBlocksByDay({
        completedBlocksByDay,
        inferredCompletedBlocksByDay,
      }),
    [completedBlocksByDay, inferredCompletedBlocksByDay],
  );

  const streakLedger = useMemo(
    () =>
      buildStreakLedger({
        sessionMinutesByDay,
        completedBlocksByDay: effectiveCompletedBlocksByDay,
        noteWordsByDay,
        protectedStreakDateKeys,
        todayKey: dayKeyLocal(new Date()),
      }),
    [effectiveCompletedBlocksByDay, noteWordsByDay, protectedStreakDateKeys, sessionMinutesByDay],
  );

  const streakQualifiedDateKeys = useMemo(
    () => streakLedger.filter((day) => day.qualifies).map((day) => day.dateKey),
    [streakLedger],
  );

  // Defensive: preserve the last non-zero streak so a partial data load
  // (sessions resolved before plannedBlocks) never briefly flashes streak to 0.
  const lastGoodStreakRef = useRef<number>(0);
  // Defensive: preserve the last non-zero XP summary so XP display never flashes
  // to 0 before sessions have loaded from Firestore.
  const lastGoodLifetimeXpRef = useRef<LifetimeXpSummary | null>(null);
  const hydratedStreak = useMemo(
    () =>
      resolveHydratedStreak({
      computedStreak: computeStreak([], streakQualifiedDateKeys),
      lastGoodStreak: lastGoodStreakRef.current,
      sessionsSynced,
      plannedBlocksHydrated,
      notesHydrated,
    }),
    [notesHydrated, plannedBlocksHydrated, sessionsSynced, streakQualifiedDateKeys],
  );

  useEffect(() => {
    lastGoodStreakRef.current = hydratedStreak.nextLastGoodStreak;
  }, [hydratedStreak.nextLastGoodStreak]);

  const streak = hydratedStreak.streak;
  const streakIsProvisional = hydratedStreak.isProvisional;

  const bandanaColor = bandanaColorFromStreak(streak);
  const { mascot, show: showMascot, dismiss: dismissMascot } = useMascot(bandanaColor);

  // ── XP computation ─────────────────────────────────────────────────────────

  const xpByDay = useMemo(() => {
    const todayKey = dayKeyLocal(new Date());

    return streakLedger
      .filter((day) => day.dateKey <= todayKey)
      .map<DayXpSummary>((day) =>
        buildDayXpSummaryForDate({
          dateKey: day.dateKey,
          sessionMinutesByDay,
          completedBlocksByDay: effectiveCompletedBlocksByDay,
          noteWordsByDay,
          streakQualifiedDateKeys,
        }),
      );
  }, [
    effectiveCompletedBlocksByDay,
    noteWordsByDay,
    sessionMinutesByDay,
    streakLedger,
    streakQualifiedDateKeys,
  ]);

  const weeklyXp = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysFromMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysFromMonday);
    const mondayKey = dayKeyLocal(monday);
    const todayKey = dayKeyLocal(now);
    return xpByDay
      .filter((day) => day.dateKey >= mondayKey && day.dateKey <= todayKey)
      .reduce((sum, day) => sum + day.totalXp, 0);
  }, [xpByDay]);

  const lifetimeXpSummary = useMemo<LifetimeXpSummary>(() => {
    const totalXp = xpByDay.reduce((sum, day) => sum + day.totalXp, 0);
    const todayKey = dayKeyLocal(new Date());
    const todayXp = xpByDay.find((day) => day.dateKey === todayKey)?.totalXp ?? 0;
    const summary = getLifetimeXpSummary(totalXp, todayXp);
    if (summary.totalXp > 0) {
      lastGoodLifetimeXpRef.current = summary;
      return summary;
    }
    if (!sessionsSyncedRef.current && lastGoodLifetimeXpRef.current) {
      return lastGoodLifetimeXpRef.current;
    }
    return summary;
  }, [xpByDay, sessionsSyncedRef]);

  // ── Profile display ────────────────────────────────────────────────────────

  const profileDisplayName =
    user?.displayName?.trim() ||
    user?.email?.split("@")[0]?.trim() ||
    "Whelm user";

  const currentUserPhotoUrl = user?.photoURL ?? null;
  const currentUserId = user?.uid ?? "current-user";
  const currentUserCreatedAtISO =
    user?.metadata.creationTime
      ? new Date(user.metadata.creationTime).toISOString()
      : new Date().toISOString();

  return {
    // Auth
    user,
    authChecked,
    setAuthChecked,
    sessionsSynced,
    sessionsSyncedRef,
    // Sessions
    sessions,
    setSessions,
    // Streak
    sessionMinutesByDay,
    streakQualifiedDateKeys,
    streak,
    streakIsProvisional,
    bandanaColor,
    mascot,
    showMascot,
    dismissMascot,
    // XP
    xpByDay,
    weeklyXp,
    lifetimeXpSummary,
    // Reward / celebration state
    xpPops,
    triggerXPPop,
    removeXPPop,
    sessionReward,
    setSessionReward,
    streakCelebration,
    setStreakCelebration,
    streakNudge,
    setStreakNudge,
    // Profile
    profileDisplayName,
    currentUserPhotoUrl,
    currentUserId,
    currentUserCreatedAtISO,
    applySessionsSnapshot,
    refreshSessionsFromCloud,
  };
}
