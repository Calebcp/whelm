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
  buildDayXpSummaryForDate,
  getLifetimeXpSummary,
  STREAK_RULE_V2_START_DATE,
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

  const applySessionsSnapshot = useCallback((remoteSessions: SessionDoc[]) => {
    const currentUser = auth.currentUser;
    const uid = currentUser?.uid;
    const localSessions = uid ? readLocalSessions(uid) : [];
    const merged = dedupeSessions([...remoteSessions, ...sessions, ...localSessions]);
    const remoteWasStale = merged.length !== remoteSessions.length;

    setSessions(merged);
    sessionsSyncedRef.current = true;
    setSessionsSynced(true);

    if (!currentUser || !remoteWasStale || sessionsSyncInFlightRef.current) return;

    sessionsSyncInFlightRef.current = true;
    void syncMissingSessionsToCloud(currentUser, remoteSessions).finally(() => {
      sessionsSyncInFlightRef.current = false;
    });
  }, [sessions]);

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
        if (local.length > 0) setSessions(local);
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

  const inferredCompletedBlocksByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of sessions) {
      const note = session.note?.trim() ?? "";
      if (!note.toLowerCase().startsWith("planned block completed:")) continue;
      const key = dayKeyLocal(session.completedAtISO);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [sessions]);

  const effectiveCompletedBlocksByDay = useMemo(() => {
    const merged = new Map(completedBlocksByDay);
    for (const [dateKey, count] of inferredCompletedBlocksByDay.entries()) {
      merged.set(dateKey, Math.max(merged.get(dateKey) ?? 0, count));
    }
    return merged;
  }, [completedBlocksByDay, inferredCompletedBlocksByDay]);

  const streakQualifiedDateKeys = useMemo(() => {
    const todayKey = dayKeyLocal(new Date());
    const qualifyingDays = new Set(protectedStreakDateKeys);
    const candidateDays = new Set<string>([
      ...sessionMinutesByDay.keys(),
      ...completedBlocksByDay.keys(),
      ...noteWordsByDay.keys(),
      ...protectedStreakDateKeys,
    ]);

    for (const dateKey of candidateDays) {
      const minutes = sessionMinutesByDay.get(dateKey) ?? 0;
      if (dateKey < STREAK_RULE_V2_START_DATE) {
        if (minutes > 0) qualifyingDays.add(dateKey);
        continue;
      }

      const completedBlocks = effectiveCompletedBlocksByDay.get(dateKey) ?? 0;
      const noteWords = noteWordsByDay.get(dateKey) ?? 0;
      if (dateKey <= todayKey && completedBlocks >= 1 && (minutes >= 30 || noteWords >= 33)) {
        qualifyingDays.add(dateKey);
      }
    }

    return [...qualifyingDays].sort();
  }, [effectiveCompletedBlocksByDay, noteWordsByDay, protectedStreakDateKeys, sessionMinutesByDay]);

  // Defensive: preserve the last non-zero streak so a partial data load
  // (sessions resolved before plannedBlocks) never briefly flashes streak to 0.
  const lastGoodStreakRef = useRef<number>(0);
  // Defensive: preserve the last non-zero XP summary so XP display never flashes
  // to 0 before sessions have loaded from Firestore.
  const lastGoodLifetimeXpRef = useRef<LifetimeXpSummary | null>(null);
  const streak = useMemo(() => {
    const computed = computeStreak([], streakQualifiedDateKeys);
    if (computed > 0) {
      lastGoodStreakRef.current = computed;
      return computed;
    }
    if (!plannedBlocksHydrated && lastGoodStreakRef.current > 0) {
      return lastGoodStreakRef.current;
    }
    return computed;
  }, [streakQualifiedDateKeys, plannedBlocksHydrated]);

  const bandanaColor = bandanaColorFromStreak(streak);
  const { mascot, show: showMascot, dismiss: dismissMascot } = useMascot(bandanaColor);

  // ── XP computation ─────────────────────────────────────────────────────────

  const xpByDay = useMemo(() => {
    const allDayKeys = new Set<string>();
    const todayKey = dayKeyLocal(new Date());

    for (const key of sessionMinutesByDay.keys()) {
      if (key <= todayKey) allDayKeys.add(key);
    }
    for (const key of noteWordsByDay.keys()) {
      if (key <= todayKey) allDayKeys.add(key);
    }
    for (const key of completedBlocksByDay.keys()) {
      if (key <= todayKey) allDayKeys.add(key);
    }
    for (const key of protectedStreakDateKeys) {
      if (key <= todayKey) allDayKeys.add(key);
    }

    return [...allDayKeys]
      .sort()
      .map<DayXpSummary>((dateKey) =>
        buildDayXpSummaryForDate({
          dateKey,
          sessionMinutesByDay,
          completedBlocksByDay: effectiveCompletedBlocksByDay,
          noteWordsByDay,
          streakQualifiedDateKeys,
        }),
      );
  }, [
    effectiveCompletedBlocksByDay,
    noteWordsByDay,
    streakQualifiedDateKeys,
    sessionMinutesByDay,
    protectedStreakDateKeys,
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
  };
}
