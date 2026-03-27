"use client";

import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import type { User } from "firebase/auth";

import { type TimerSessionContext } from "@/components/Timer";
import { type PlannedBlock } from "@/hooks/usePlannedBlocks";
import {
  trackSessionAbandoned,
  trackSessionCompleted,
  trackSessionStarted,
  trackStreakUpdated,
  trackTaskCompleted,
} from "@/lib/analytics-tracker";
import { dayKeyLocal } from "@/lib/date-utils";
import { evaluateSessionQuality } from "@/lib/session-quality";
import { saveSession } from "@/lib/session-store";
import { computeStreak, type SessionDoc } from "@/lib/streak";
import { getStreakBandanaTier } from "@/lib/streak-bandanas";
import {
  buildDayXpSummaryForDate,
  doesDateQualifyForStreak,
  getLifetimeXpSummary,
  type DayXpSummary,
  type LifetimeXpSummary,
  type SessionRewardState,
} from "@/lib/xp-engine";

type SubjectMode = "language" | "school" | "work" | "general";

type SessionOutcome = {
  source: "timer" | "plan";
  minutesSpent: number;
  nextSessions: SessionDoc[];
  nextStreak: number;
};

type UseSessionsOptions = {
  user: User | null;
  sessions: SessionDoc[];
  setSessions: Dispatch<SetStateAction<SessionDoc[]>>;
  sessionMinutesByDay: Map<string, number>;
  completedBlocksByDay: Map<string, number>;
  noteWordsByDay: Map<string, number>;
  streakQualifiedDateKeys: string[];
  protectedStreakDateKeys: string[];
  xpByDay: DayXpSummary[];
  lifetimeXpSummary: LifetimeXpSummary;
  plannedBlocks: PlannedBlock[];
  persistPlannedBlocks: (nextBlocks: PlannedBlock[]) => Promise<void>;
  sessionReward: SessionRewardState | null;
  setSessionReward: Dispatch<SetStateAction<SessionRewardState | null>>;
  triggerXPPop: (amount: number, x?: number, y?: number) => void;
  getSubjectModeFromText: (text: string) => SubjectMode;
  onSessionOutcome?: (outcome: SessionOutcome) => void;
};

function fireAndForgetTracking(work: Promise<unknown>) {
  void work.catch(() => {
    // Analytics must not block the product workflow.
  });
}

function countSessionsForDate(sessions: SessionDoc[], dateKey: string) {
  return sessions.filter((session) => dayKeyLocal(session.completedAtISO) === dateKey).length;
}

export function useSessions({
  user,
  sessions,
  setSessions,
  sessionMinutesByDay,
  completedBlocksByDay,
  noteWordsByDay,
  streakQualifiedDateKeys,
  protectedStreakDateKeys,
  xpByDay,
  lifetimeXpSummary,
  plannedBlocks,
  persistPlannedBlocks,
  sessionReward,
  setSessionReward,
  triggerXPPop,
  getSubjectModeFromText,
  onSessionOutcome,
}: UseSessionsOptions) {
  const trackStreakChange = useCallback((
    previousLength: number,
    nextLength: number,
    source: "session_completed" | "task_completed" | "sick_day_save",
    linkedSessionId?: string | null,
    streakDate = dayKeyLocal(new Date()),
  ) => {
    if (!user || previousLength === nextLength) return;

    if (nextLength > previousLength) {
      triggerXPPop(15);
    }

    fireAndForgetTracking(
      trackStreakUpdated(user, {
        streakDate,
        previousLength,
        newLength: nextLength,
        updateSource: source,
        linkedSessionId: linkedSessionId ?? null,
      }),
    );
  }, [triggerXPPop, user]);

  const handleSessionStarted = useCallback(async (context: TimerSessionContext) => {
    if (!user) return;

    fireAndForgetTracking(
      trackSessionStarted(user, {
        sessionId: context.sessionId,
        sessionType: context.sessionType,
        subjectMode: context.subjectMode,
        targetMinutes: context.targetMinutes,
      }),
    );
  }, [user]);

  const handleSessionAbandoned = useCallback(async (
    context: TimerSessionContext & {
      elapsedMinutes: number;
      abandonReason: "reset" | "route_change" | "component_unmount" | "unknown";
    },
  ) => {
    if (!user) return;

    const quality = evaluateSessionQuality({
      plannedDurationMinutes: context.targetMinutes,
      actualDurationMinutes: context.elapsedMinutes,
      completionStatus: "abandoned",
      earlyExit: true,
      interruptionCount: context.interruptionCount,
      tasksCompletedCount: 0,
    });

    fireAndForgetTracking(
      trackSessionAbandoned(user, {
        sessionId: context.sessionId,
        sessionType: context.sessionType,
        subjectMode: context.subjectMode,
        elapsedMinutes: context.elapsedMinutes,
        abandonReason: context.abandonReason,
        plannedDurationMinutes: context.targetMinutes,
        interruptionCount: context.interruptionCount,
        qualityScore: quality.score,
        qualityRating: quality.rating,
      }),
    );
  }, [user]);

  const completeSession = useCallback(async (
    note: string,
    minutesSpent: number,
    sessionContext?: TimerSessionContext,
  ) => {
    if (!user) return;

    const todayKey = dayKeyLocal(new Date());
    const previousStreak = computeStreak(sessions, protectedStreakDateKeys);
    const previousTodayXp =
      xpByDay.find((day) => day.dateKey === todayKey)?.totalXp ??
      buildDayXpSummaryForDate({
        dateKey: todayKey,
        sessionMinutesByDay,
        completedBlocksByDay,
        noteWordsByDay,
        streakQualifiedDateKeys,
      }).totalXp;
    const previousTotalXp = lifetimeXpSummary.totalXp;
    const previousLevel = lifetimeXpSummary.currentLevel;
    const now = new Date().toISOString();
    const session: SessionDoc = {
      uid: user.uid,
      completedAtISO: now,
      minutes: minutesSpent,
      category: "misc",
      note: note.trim(),
      noteSavedAtISO: now,
    };

    const nextSessions = await saveSession(user, session);
    setSessions(nextSessions);
    const nextSessionMinutesByDay = new Map(sessionMinutesByDay);
    nextSessionMinutesByDay.set(todayKey, (nextSessionMinutesByDay.get(todayKey) ?? 0) + minutesSpent);
    const todayFocusMinutesAfter = nextSessionMinutesByDay.get(todayKey) ?? 0;
    const todayCompletedBlocksAfter = completedBlocksByDay.get(todayKey) ?? 0;
    const todayNoteWordsAfter = noteWordsByDay.get(todayKey) ?? 0;
    const qualifiesTodayAfter = doesDateQualifyForStreak({
      dateKey: todayKey,
      focusMinutes: todayFocusMinutesAfter,
      completedBlocks: todayCompletedBlocksAfter,
      noteWords: todayNoteWordsAfter,
      todayKey,
      protectedDateKeys: protectedStreakDateKeys,
    });
    const nextQualifiedDateKeys = qualifiesTodayAfter
      ? [...new Set([...streakQualifiedDateKeys, todayKey])].sort()
      : streakQualifiedDateKeys;
    const nextTodayXp = buildDayXpSummaryForDate({
      dateKey: todayKey,
      sessionMinutesByDay: nextSessionMinutesByDay,
      completedBlocksByDay,
      noteWordsByDay,
      streakQualifiedDateKeys: nextQualifiedDateKeys,
    }).totalXp;
    const xpGained = Math.max(0, nextTodayXp - previousTodayXp);
    const nextLevel = getLifetimeXpSummary(previousTotalXp + xpGained, nextTodayXp).currentLevel;
    const nextStreak = computeStreak(nextSessions, protectedStreakDateKeys);
    const previousTier = getStreakBandanaTier(previousStreak);
    const nextTier = getStreakBandanaTier(nextStreak);
    const tierUnlocked =
      nextTier && (previousTier?.minDays ?? 0) < nextTier.minDays ? nextTier : null;

    if (sessionContext) {
      const quality = evaluateSessionQuality({
        plannedDurationMinutes: sessionContext.targetMinutes,
        actualDurationMinutes: minutesSpent,
        completionStatus: "completed",
        earlyExit:
          sessionContext.targetMinutes !== null && minutesSpent < sessionContext.targetMinutes,
        interruptionCount: sessionContext.interruptionCount,
        tasksCompletedCount: 0,
      });
      fireAndForgetTracking(
        trackSessionCompleted(user, {
          sessionId: sessionContext.sessionId,
          sessionType: sessionContext.sessionType,
          subjectMode: sessionContext.subjectMode,
          durationMinutes: minutesSpent,
          plannedDurationMinutes: sessionContext.targetMinutes,
          completionStatus: "completed",
          earlyExit:
            sessionContext.targetMinutes !== null && minutesSpent < sessionContext.targetMinutes,
          interruptionCount: sessionContext.interruptionCount,
          tasksCompletedCount: 0,
          qualityScore: quality.score,
          qualityRating: quality.rating,
          noteAttached: Boolean(note.trim()),
        }),
      );
    }

    trackStreakChange(
      previousStreak,
      nextStreak,
      "session_completed",
      sessionContext?.sessionId ?? null,
    );
    onSessionOutcome?.({
      source: "timer",
      minutesSpent,
      nextSessions,
      nextStreak,
    });
    setSessionReward({
      id: `${Date.now()}`,
      minutesSpent,
      xpGained,
      todayXp: nextTodayXp,
      streakAfter: nextStreak,
      streakDelta: Math.max(0, nextStreak - previousStreak),
      leveledUp: nextLevel > previousLevel,
      tierUnlocked,
    });
    triggerXPPop(20);
  }, [
    completedBlocksByDay,
    lifetimeXpSummary,
    noteWordsByDay,
    onSessionOutcome,
    protectedStreakDateKeys,
    sessionMinutesByDay,
    sessions,
    setSessionReward,
    setSessions,
    streakQualifiedDateKeys,
    trackStreakChange,
    triggerXPPop,
    user,
    xpByDay,
  ]);

  const completePlannedBlock = useCallback(async (item: PlannedBlock) => {
    if (!user) return;

    const previousStreak = computeStreak(sessions, protectedStreakDateKeys);
    const localDateTime = new Date(`${item.dateKey}T${item.timeOfDay}:00`);
    const completedAtISO = Number.isNaN(localDateTime.getTime())
      ? new Date().toISOString()
      : localDateTime.toISOString();
    const session: SessionDoc = {
      uid: user.uid,
      completedAtISO,
      minutes: item.durationMinutes,
      category: "misc",
      note: item.note.trim()
        ? `Planned block completed: ${item.title} - ${item.note.trim()}`
        : `Planned block completed: ${item.title}`,
      noteSavedAtISO: new Date().toISOString(),
    };

    const linkedSessionId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}`;
    const nextSessions = await saveSession(user, session);
    setSessions(nextSessions);
    const quality = evaluateSessionQuality({
      plannedDurationMinutes: item.durationMinutes,
      actualDurationMinutes: item.durationMinutes,
      completionStatus: "completed",
      earlyExit: false,
      interruptionCount: 0,
      tasksCompletedCount: 1,
    });
    fireAndForgetTracking(
      trackSessionCompleted(user, {
        sessionId: linkedSessionId,
        sessionType: "focus",
        subjectMode: getSubjectModeFromText(`${item.title} ${item.note}`),
        durationMinutes: item.durationMinutes,
        plannedDurationMinutes: item.durationMinutes,
        completionStatus: "completed",
        earlyExit: false,
        interruptionCount: 0,
        tasksCompletedCount: 1,
        qualityScore: quality.score,
        qualityRating: quality.rating,
        noteAttached: Boolean(item.note.trim()),
        completedFromTaskId: item.id,
      }),
    );
    fireAndForgetTracking(
      trackTaskCompleted(user, {
        taskId: item.id,
        scheduledDate: item.dateKey,
        durationMinutes: item.durationMinutes,
        subjectMode: getSubjectModeFromText(`${item.title} ${item.note}`),
        linkedSessionId,
      }),
    );

    const nextStreak = computeStreak(nextSessions, protectedStreakDateKeys);
    trackStreakChange(
      previousStreak,
      nextStreak,
      "task_completed",
      linkedSessionId,
      item.dateKey,
    );
    onSessionOutcome?.({
      source: "plan",
      minutesSpent: item.durationMinutes,
      nextSessions,
      nextStreak,
    });
    const updated = plannedBlocks.map((block) =>
      block.id === item.id
        ? {
            ...block,
            status: "completed" as PlannedBlock["status"],
            completedAtISO,
            updatedAtISO: new Date().toISOString(),
          }
        : block,
    );
    void persistPlannedBlocks(updated);
    triggerXPPop(10);
  }, [
    getSubjectModeFromText,
    onSessionOutcome,
    persistPlannedBlocks,
    plannedBlocks,
    protectedStreakDateKeys,
    sessions,
    setSessions,
    trackStreakChange,
    triggerXPPop,
    user,
  ]);

  useEffect(() => {
    if (!sessionReward) return;
    const timeoutId = window.setTimeout(() => {
      setSessionReward((current) => (current?.id === sessionReward.id ? null : current));
    }, 4200);
    return () => window.clearTimeout(timeoutId);
  }, [sessionReward, setSessionReward]);

  return {
    completePlannedBlock,
    completeSession,
    handleSessionAbandoned,
    handleSessionStarted,
  };
}
