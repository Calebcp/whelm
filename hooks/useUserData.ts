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

    if (!currentUser || !remoteWasStale || sessionsSyncInFlightRef.current) return;

    sessionsSyncInFlightRef.current = true;
    void syncMissingSessionsToCloud(currentUser, remoteSessions).finally(() => {
      sessionsSyncInFlightRef.current = false;
    });
  }, [sessions]);

  // ── Auth listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      if (!nextUser) {
        appOpenTrackedRef.current = null;
        sessionsSyncedRef.current = false;
        setUser(null);
        setSessions([]);
        if (authReadyRef.current) {
          setAuthChecked(true);
        }
        onSignOut?.();
        return;
      }

      authReadyRef.current = true;
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
            setSessions(synced);
            sessionsSyncedRef.current = true;
          })
          .catch(() => { sessionsSyncedRef.current = true; });
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

  const streakQualifiedDateKeys = useMemo(() => {
    const todayKey = dayKeyLocal(new Date());
    const qualifyingDays = new Set(protectedStreakDateKeys);

    for (const [dateKey, minutes] of sessionMinutesByDay.entries()) {
      if (dateKey < STREAK_RULE_V2_START_DATE) {
        qualifyingDays.add(dateKey);
        continue;
      }

      const completedBlocks = completedBlocksByDay.get(dateKey) ?? 0;
      const noteWords = noteWordsByDay.get(dateKey) ?? 0;
      if (dateKey <= todayKey && completedBlocks >= 1 && (minutes >= 30 || noteWords >= 33)) {
        qualifyingDays.add(dateKey);
      }
    }

    return [...qualifyingDays].sort();
  }, [completedBlocksByDay, noteWordsByDay, protectedStreakDateKeys, sessionMinutesByDay]);

  // Defensive: preserve the last non-zero streak so a partial data load
  // (sessions resolved before plannedBlocks) never briefly flashes streak to 0.
  const lastGoodStreakRef = useRef<number>(0);
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
          completedBlocksByDay,
          noteWordsByDay,
          streakQualifiedDateKeys,
        }),
      );
  }, [
    completedBlocksByDay,
    noteWordsByDay,
    streakQualifiedDateKeys,
    sessionMinutesByDay,
    protectedStreakDateKeys,
  ]);

  const lifetimeXpSummary = useMemo<LifetimeXpSummary>(() => {
    const totalXp = xpByDay.reduce((sum, day) => sum + day.totalXp, 0);
    const todayKey = dayKeyLocal(new Date());
    const todayXp = xpByDay.find((day) => day.dateKey === todayKey)?.totalXp ?? 0;
    return getLifetimeXpSummary(totalXp, todayXp);
  }, [xpByDay]);

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
