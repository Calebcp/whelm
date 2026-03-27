"use client";

import { useEffect, useRef, useState } from "react";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { User } from "firebase/auth";

import { getStreakBandanaTier } from "@/lib/streak-bandanas";
import type { StreakCelebrationState, StreakNudgeState } from "@/lib/xp-engine";

const INTRO_SPLASH_MIN_MS = 1500;
const INTRO_SPLASH_MAX_MS = 2200;

function streakNudgeStorageKey(uid: string, dateKey: string) {
  return `whelm:streak-nudges:${uid}:${dateKey}`;
}

function readStreakNudgeSeen(uid: string, dateKey: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(streakNudgeStorageKey(uid, dateKey));
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function markStreakNudgeSeen(uid: string, dateKey: string, slot: string) {
  const next = readStreakNudgeSeen(uid, dateKey);
  next.add(slot);
  window.localStorage.setItem(streakNudgeStorageKey(uid, dateKey), JSON.stringify([...next]));
}

type UseShellLifecycleOptions = {
  authChecked: boolean;
  user: User | null;
  router: AppRouterInstance;
  senseiReaction: string;
  clearSenseiReaction: () => void;
  notificationsBlocked: boolean;
  streakProtectedToday: boolean;
  streakRuleV2ActiveToday: boolean;
  displayStreak: number;
  todayKey: string;
  plannedBlocksHydrated: boolean;
  streakNudge: StreakNudgeState | null;
  streakNudgeDraft: Omit<StreakNudgeState, "id"> | null;
  setStreakNudge: (value: StreakNudgeState | null) => void;
  setSessionReward: (value: null) => void;
  setStreakCelebration: (value: StreakCelebrationState | null | ((current: StreakCelebrationState | null) => StreakCelebrationState | null)) => void;
};

export function useShellLifecycle({
  authChecked,
  user,
  router,
  senseiReaction,
  clearSenseiReaction,
  notificationsBlocked,
  streakProtectedToday,
  streakRuleV2ActiveToday,
  displayStreak,
  todayKey,
  plannedBlocksHydrated,
  streakNudge,
  streakNudgeDraft,
  setStreakNudge,
  setSessionReward,
  setStreakCelebration,
}: UseShellLifecycleOptions) {
  const [showIntroSplash, setShowIntroSplash] = useState(true);
  const [introFinished, setIntroFinished] = useState(false);
  const [introMinElapsed, setIntroMinElapsed] = useState(false);
  const previousStreakProtectedTodayRef = useRef<boolean | null>(null);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    if (!showIntroSplash) return;
    const timeoutId = window.setTimeout(() => {
      setIntroMinElapsed(true);
    }, INTRO_SPLASH_MIN_MS);
    return () => window.clearTimeout(timeoutId);
  }, [showIntroSplash]);

  useEffect(() => {
    if (!showIntroSplash) return;
    if (!introMinElapsed || !introFinished || !authChecked) return;
    setShowIntroSplash(false);
  }, [authChecked, introFinished, introMinElapsed, showIntroSplash]);

  useEffect(() => {
    if (!showIntroSplash) return;
    const timeoutId = window.setTimeout(() => {
      setIntroFinished(true);
    }, INTRO_SPLASH_MAX_MS);
    return () => window.clearTimeout(timeoutId);
  }, [showIntroSplash]);

  useEffect(() => {
    if (!senseiReaction) return;
    const timeoutId = window.setTimeout(() => {
      clearSenseiReaction();
    }, 5000);
    return () => window.clearTimeout(timeoutId);
  }, [clearSenseiReaction, senseiReaction]);

  useEffect(() => {
    if (!authChecked || user) return;

    router.replace("/login");

    const timeoutId = window.setTimeout(() => {
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [authChecked, router, user]);

  useEffect(() => {
    if (streakProtectedToday) {
      setStreakNudge(null);
    }
  }, [setStreakNudge, streakProtectedToday]);

  useEffect(() => {
    if (!notificationsBlocked) return;
    setStreakNudge(null);
    setSessionReward(null);
    setStreakCelebration(null);
  }, [notificationsBlocked, setSessionReward, setStreakCelebration, setStreakNudge]);

  useEffect(() => {
    if (!authChecked || !user) {
      previousStreakProtectedTodayRef.current = streakProtectedToday;
      return;
    }

    const previousProtected = previousStreakProtectedTodayRef.current;
    previousStreakProtectedTodayRef.current = streakProtectedToday;

    if (previousProtected === null) return;
    if (notificationsBlocked || !streakRuleV2ActiveToday) return;
    if (previousProtected || !streakProtectedToday) return;

    setStreakCelebration({
      id: `${todayKey}-${Date.now()}`,
      streakAfter: displayStreak,
      todayLabel,
      tier: getStreakBandanaTier(displayStreak),
    });
  }, [
    authChecked,
    displayStreak,
    notificationsBlocked,
    streakProtectedToday,
    streakRuleV2ActiveToday,
    todayKey,
    todayLabel,
    user,
    setStreakCelebration,
  ]);

  useEffect(() => {
    if (notificationsBlocked) return;
    if (!user || !authChecked || !plannedBlocksHydrated || !streakNudgeDraft) return;
    if (streakNudge) return;

    const now = new Date();
    const hour = now.getHours();
    const slot = hour >= 19 ? "evening" : hour >= 13 ? "midday" : hour >= 9 ? "morning" : null;
    if (!slot) return;

    const seen = readStreakNudgeSeen(user.uid, todayKey);
    if (seen.has(slot)) return;

    setStreakNudge({
      id: `${todayKey}-${slot}`,
      ...streakNudgeDraft,
    });
    markStreakNudgeSeen(user.uid, todayKey, slot);
  }, [
    authChecked,
    notificationsBlocked,
    plannedBlocksHydrated,
    streakNudge,
    streakNudgeDraft,
    todayKey,
    user,
    setStreakNudge,
  ]);

  return {
    showIntroSplash,
    setIntroFinished,
    todayLabel,
  };
}
