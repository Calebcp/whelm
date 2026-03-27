"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";

import { countWords } from "@/lib/date-utils";
import {
  saveReflectionState,
  type ReflectionState,
  type ReflectionMirrorEntry,
  type ReflectionSickDaySave,
} from "@/lib/reflection-store";
import { computeStreak, type SessionDoc } from "@/lib/streak";

type MirrorSectionsOpen = {
  summary: boolean;
  entries: boolean;
  detail: boolean;
};

type UseReflectionOptions = {
  user: User | null;
  isPro: boolean;
  landingWisdomMinute: number;
  questions: readonly string[];
  sayings: readonly string[];
  minWords: number;
};

export function useReflection({
  user,
  isPro,
  landingWisdomMinute,
  questions,
  sayings,
  minWords,
}: UseReflectionOptions) {
  const [sickDaySaves, setSickDaySaves] = useState<ReflectionSickDaySave[]>([]);
  const [sickDaySaveDismissals, setSickDaySaveDismissals] = useState<string[]>([]);
  const [sickDaySavePromptOpen, setSickDaySavePromptOpen] = useState(false);
  const [sickDaySavePromptPreview, setSickDaySavePromptPreview] = useState(false);
  const [streakSaveQuestionnaireOpen, setStreakSaveQuestionnaireOpen] = useState(false);
  const [streakSaveQuestionnairePreview, setStreakSaveQuestionnairePreview] = useState(false);
  const [mirrorSectionsOpen, setMirrorSectionsOpen] = useState<MirrorSectionsOpen>({
    summary: false,
    entries: false,
    detail: false,
  });
  const [mirrorPrivacyOpen, setMirrorPrivacyOpen] = useState(false);
  const [streakMirrorEntries, setStreakMirrorEntries] = useState<ReflectionMirrorEntry[]>([]);
  const [selectedStreakMirrorId, setSelectedStreakMirrorId] = useState<string | null>(null);
  const [streakMirrorTag, setStreakMirrorTag] = useState<
    "forgot" | "lazy" | "too_busy" | "low_energy" | "disorganized" | "other" | null
  >(null);
  const [streakSaveAnswers, setStreakSaveAnswers] = useState<Record<string, string>>({});
  const [streakSaveStatus, setStreakSaveStatus] = useState("");

  const protectedStreakDateKeys = useMemo(
    () => sickDaySaves.map((save) => save.dateKey),
    [sickDaySaves],
  );

  const streakMirrorVisibleEntries = isPro
    ? streakMirrorEntries
    : streakMirrorEntries.slice(0, 2);
  const selectedStreakMirrorEntry =
    streakMirrorVisibleEntries.find((entry) => entry.id === selectedStreakMirrorId) ??
    streakMirrorVisibleEntries[0] ??
    null;
  const streakMirrorSaying = sayings[landingWisdomMinute % sayings.length] ?? "";

  const applyReflectionState = useCallback((state: ReflectionState) => {
    setStreakMirrorEntries(state.mirrorEntries);
    setSelectedStreakMirrorId((current) => current ?? state.mirrorEntries[0]?.id ?? null);
    setSickDaySaves(state.sickDaySaves);
    setSickDaySaveDismissals(state.sickDaySaveDismissals);
  }, []);

  useEffect(() => {
    if (!user) {
      setSickDaySaves([]);
      setSickDaySaveDismissals([]);
      setSickDaySavePromptOpen(false);
      setSickDaySavePromptPreview(false);
      setStreakSaveQuestionnaireOpen(false);
      setStreakSaveQuestionnairePreview(false);
      setMirrorSectionsOpen({ summary: false, entries: false, detail: false });
      setMirrorPrivacyOpen(false);
      setStreakMirrorEntries([]);
      setSelectedStreakMirrorId(null);
      setStreakMirrorTag(null);
      setStreakSaveAnswers({});
      setStreakSaveStatus("");
    }
  }, [user]);

  useEffect(() => {
    const visible = isPro ? streakMirrorEntries : streakMirrorEntries.slice(0, 2);
    if (visible.length === 0) {
      setSelectedStreakMirrorId(null);
      return;
    }
    if (!selectedStreakMirrorId || !visible.some((entry) => entry.id === selectedStreakMirrorId)) {
      setSelectedStreakMirrorId(visible[0].id);
    }
  }, [isPro, selectedStreakMirrorId, streakMirrorEntries]);

  const persistReflectionState = useCallback(async (nextState: ReflectionState) => {
    if (!user) return;
    applyReflectionState(nextState);
    const result = await saveReflectionState(user, nextState);
    applyReflectionState(result);
  }, [applyReflectionState, user]);

  const handleReflectionSnapshot = useCallback((state: ReflectionState) => {
    applyReflectionState(state);
  }, [applyReflectionState]);

  const dismissSickDaySavePrompt = useCallback(() => {
    setSickDaySavePromptOpen(false);
    setSickDaySavePromptPreview(false);
  }, []);

  const openStreakSaveQuestionnaire = useCallback(() => {
    setStreakSaveAnswers({});
    setStreakMirrorTag(null);
    setStreakSaveStatus("");
    setStreakSaveQuestionnairePreview(false);
    setStreakSaveQuestionnaireOpen(true);
  }, []);

  const openStreakSaveQuestionnairePreview = useCallback(() => {
    setStreakSaveAnswers({});
    setStreakMirrorTag(null);
    setStreakSaveStatus("");
    setStreakSaveQuestionnairePreview(true);
    setStreakSaveQuestionnaireOpen(true);
  }, []);

  const openSickDaySavePromptPreview = useCallback(() => {
    setSickDaySavePromptPreview(true);
    setSickDaySavePromptOpen(true);
  }, []);

  const closeStreakSaveQuestionnaire = useCallback(() => {
    setStreakSaveQuestionnaireOpen(false);
    setStreakSaveQuestionnairePreview(false);
    setStreakMirrorTag(null);
    setStreakSaveStatus("");
  }, []);

  const declineSickDaySave = useCallback((rawYesterdayMissed: boolean, yesterdayKey: string) => {
    if (!user || !rawYesterdayMissed) return;
    const nextDismissals = [...new Set([...sickDaySaveDismissals, yesterdayKey])];
    void persistReflectionState({
      mirrorEntries: streakMirrorEntries,
      sickDaySaves,
      sickDaySaveDismissals: nextDismissals,
    });
    setSickDaySavePromptOpen(false);
  }, [
    persistReflectionState,
    sickDaySaveDismissals,
    sickDaySaves,
    streakMirrorEntries,
    user,
  ]);

  const claimSickDaySave = useCallback((input: {
    sickDaySaveEligible: boolean;
    monthlySaveLimitReached: boolean;
    yesterdayKey: string;
    sessions: SessionDoc[];
    protectedStreakDateKeys: string[];
    onTrackStreakChange?: (
      previousStreak: number,
      nextStreak: number,
      source: "sick_day_save",
      changedDateKey: string,
    ) => void;
    onAfterClaim?: () => void;
  }) => {
    if (streakSaveQuestionnairePreview) {
      closeStreakSaveQuestionnaire();
      return;
    }
    if (!user || !input.sickDaySaveEligible) return;
    const incompleteQuestion = questions.find((question) => {
      const answer = streakSaveAnswers[question]?.trim() ?? "";
      return countWords(answer) < minWords;
    });
    if (incompleteQuestion) {
      setStreakSaveStatus(`Each reflection needs at least ${minWords} words.`);
      return;
    }
    if (!streakMirrorTag) {
      setStreakSaveStatus("Choose the pattern tag that best describes the miss.");
      return;
    }
    if (input.monthlySaveLimitReached) {
      setStreakSaveStatus("This month has already used all 5 streak saves.");
      return;
    }

    const normalizedAnswers = Object.fromEntries(
      questions.map((question) => [question, (streakSaveAnswers[question] ?? "").trim()]),
    );
    const previousStreak = computeStreak(input.sessions, input.protectedStreakDateKeys);
    const nowIso = new Date().toISOString();
    const nextSave: ReflectionSickDaySave = {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`,
      dateKey: input.yesterdayKey,
      claimedAtISO: nowIso,
      reason: "sick",
    };
    const nextSaves = [nextSave, ...sickDaySaves.filter((save) => save.dateKey !== input.yesterdayKey)].sort((a, b) =>
      a.claimedAtISO < b.claimedAtISO ? 1 : -1,
    );
    const nextMirrorEntry: ReflectionMirrorEntry = {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-mirror`,
      dateKey: input.yesterdayKey,
      createdAtISO: nowIso,
      updatedAtISO: nowIso,
      tag: streakMirrorTag,
      answers: normalizedAnswers,
      source: "streak_save",
    };
    const nextMirrorEntries = [nextMirrorEntry, ...streakMirrorEntries].sort((a, b) =>
      a.updatedAtISO < b.updatedAtISO ? 1 : -1,
    );

    void persistReflectionState({
      mirrorEntries: nextMirrorEntries,
      sickDaySaves: nextSaves,
      sickDaySaveDismissals,
    });

    setSelectedStreakMirrorId(nextMirrorEntry.id);
    input.onTrackStreakChange?.(
      previousStreak,
      computeStreak(input.sessions, nextSaves.map((save) => save.dateKey)),
      "sick_day_save",
      input.yesterdayKey,
    );
    setSickDaySavePromptOpen(false);
    setStreakSaveQuestionnaireOpen(false);
    setStreakMirrorTag(null);
    setStreakSaveStatus("");
    input.onAfterClaim?.();
  }, [
    closeStreakSaveQuestionnaire,
    minWords,
    persistReflectionState,
    questions,
    sickDaySaveDismissals,
    sickDaySaves,
    streakMirrorEntries,
    streakMirrorTag,
    streakSaveAnswers,
    streakSaveQuestionnairePreview,
    user,
  ]);

  return {
    sickDaySaves,
    sickDaySaveDismissals,
    protectedStreakDateKeys,
    sickDaySavePromptOpen,
    sickDaySavePromptPreview,
    streakSaveQuestionnaireOpen,
    streakSaveQuestionnairePreview,
    mirrorSectionsOpen,
    mirrorPrivacyOpen,
    streakMirrorEntries,
    selectedStreakMirrorId,
    streakMirrorTag,
    streakSaveAnswers,
    streakSaveStatus,
    streakMirrorVisibleEntries,
    selectedStreakMirrorEntry,
    streakMirrorSaying,
    setSickDaySavePromptOpen,
    setSickDaySavePromptPreview,
    setMirrorSectionsOpen,
    setMirrorPrivacyOpen,
    setSelectedStreakMirrorId,
    setStreakMirrorTag,
    setStreakSaveAnswers,
    handleReflectionSnapshot,
    persistReflectionState,
    dismissSickDaySavePrompt,
    openStreakSaveQuestionnaire,
    openStreakSaveQuestionnairePreview,
    openSickDaySavePromptPreview,
    closeStreakSaveQuestionnaire,
    declineSickDaySave,
    claimSickDaySave,
  };
}
