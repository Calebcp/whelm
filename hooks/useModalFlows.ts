"use client";

import { useCallback } from "react";

import { dayKeyLocal } from "@/lib/date-utils";
import type { AppTab } from "@/lib/app-tabs";

type UseModalFlowsOptions = {
  selectedNoteId: string | null;
  selectedDateKey: string;
  sickDaySaveEligible: boolean;
  senseiActionLabel: string;
  senseiActionTab: AppTab;
  dismissSickDaySavePrompt: () => void;
  openStreakSaveQuestionnaire: () => void;
  createWorkspaceNote: () => Promise<unknown>;
  flushSelectedNoteDraft: () => Promise<void>;
  setSelectedNoteId: (value: string | null) => void;
  setMobileNotesEditorOpen: (value: boolean) => void;
  setMobileNotesToolsOpen: (value: "format" | "type" | "color" | null) => void;
  setMobileNotesRecentOpen: (value: boolean) => void;
  setActiveTab: (value: AppTab) => void;
  setCalendarView: (value: "month" | "day") => void;
  setSelectedCalendarDate: (value: string) => void;
  showToast: (message: string, tone?: "success" | "warning" | "error" | "info") => void;
  setDailyPlanningStatus: (value: string) => void;
  setDailyPlanningPreviewOpen: (value: boolean) => void;
  setDailyPlanningOpen: (value: boolean) => void;
  setStreakNudge: (value: null) => void;
  scrollToSection: (target: HTMLElement | null) => void;
  todayTimerRef: { current: HTMLElement | null };
  todaySectionRef: { current: HTMLElement | null };
  notesEditorRef: { current: HTMLElement | null };
  notesSectionRef: { current: HTMLElement | null };
  calendarTimelineRef: { current: HTMLElement | null };
  calendarSectionRef: { current: HTMLElement | null };
};

function normalizePlannableDateKey(dateKey: string) {
  return dateKey < dayKeyLocal(new Date()) ? dayKeyLocal(new Date()) : dateKey;
}

export function useModalFlows({
  selectedNoteId,
  selectedDateKey,
  sickDaySaveEligible,
  senseiActionLabel,
  senseiActionTab,
  dismissSickDaySavePrompt,
  openStreakSaveQuestionnaire,
  createWorkspaceNote,
  flushSelectedNoteDraft,
  setSelectedNoteId,
  setMobileNotesEditorOpen,
  setMobileNotesToolsOpen,
  setMobileNotesRecentOpen,
  setActiveTab,
  setCalendarView,
  setSelectedCalendarDate,
  showToast,
  setDailyPlanningStatus,
  setDailyPlanningPreviewOpen,
  setDailyPlanningOpen,
  setStreakNudge,
  scrollToSection,
  todayTimerRef,
  todaySectionRef,
  notesEditorRef,
  notesSectionRef,
  calendarTimelineRef,
  calendarSectionRef,
}: UseModalFlowsOptions) {
  const openMobileNoteEditor = useCallback(async (noteId: string) => {
    await flushSelectedNoteDraft();
    setSelectedNoteId(noteId);
    setMobileNotesEditorOpen(true);
    setMobileNotesToolsOpen(null);
    setMobileNotesRecentOpen(false);
  }, [
    flushSelectedNoteDraft,
    setMobileNotesEditorOpen,
    setMobileNotesRecentOpen,
    setMobileNotesToolsOpen,
    setSelectedNoteId,
  ]);

  const handleMobileCreateNote = useCallback(async () => {
    await createWorkspaceNote();
    setMobileNotesEditorOpen(true);
    setMobileNotesToolsOpen(null);
    setMobileNotesRecentOpen(false);
  }, [createWorkspaceNote, setMobileNotesEditorOpen, setMobileNotesRecentOpen, setMobileNotesToolsOpen]);

  const handleOpenCurrentMobileNote = useCallback(() => {
    if (!selectedNoteId) return;
    openMobileNoteEditor(selectedNoteId);
  }, [openMobileNoteEditor, selectedNoteId]);

  const handleMobilePlannerOpen = useCallback(() => {
    setActiveTab("calendar");
    setCalendarView("day");
  }, [setActiveTab, setCalendarView]);

  const openTimeBlockFlow = useCallback((dateKey: string) => {
    const nextDateKey = normalizePlannableDateKey(dateKey);
    setSelectedCalendarDate(nextDateKey);
    setActiveTab("today");
    if (nextDateKey !== dateKey) {
      showToast("Past dates stay read-only. Add the block to today or a future day.", "warning");
    }
  }, [setActiveTab, setSelectedCalendarDate, showToast]);

  const openSickDaySaveReview = useCallback(() => {
    dismissSickDaySavePrompt();
    if (sickDaySaveEligible) {
      openStreakSaveQuestionnaire();
      return;
    }
    setActiveTab("mirror");
  }, [dismissSickDaySavePrompt, openStreakSaveQuestionnaire, setActiveTab, sickDaySaveEligible]);

  const openDailyPlanningPreview = useCallback(() => {
    setDailyPlanningStatus("");
    setDailyPlanningPreviewOpen(true);
    setDailyPlanningOpen(true);
  }, [setDailyPlanningOpen, setDailyPlanningPreviewOpen, setDailyPlanningStatus]);

  const handleTodayPrimaryAction = useCallback(() => {
    if (senseiActionLabel === "Start Today") {
      openTimeBlockFlow(dayKeyLocal(new Date()));
      return;
    }
    if (senseiActionLabel === "Protect the Streak") {
      openTimeBlockFlow(selectedDateKey);
      return;
    }
    setActiveTab(senseiActionTab);
  }, [openTimeBlockFlow, selectedDateKey, senseiActionLabel, senseiActionTab, setActiveTab]);

  const handleStreakNudgeAction = useCallback((tab: AppTab) => {
    setStreakNudge(null);
    setActiveTab(tab);
    if (tab === "today") {
      window.setTimeout(() => scrollToSection(todayTimerRef.current ?? todaySectionRef.current), 80);
      return;
    }
    if (tab === "notes") {
      window.setTimeout(() => scrollToSection(notesEditorRef.current ?? notesSectionRef.current), 80);
      return;
    }
    if (tab === "calendar") {
      setCalendarView("day");
      setSelectedCalendarDate(dayKeyLocal(new Date()));
      window.setTimeout(() => scrollToSection(calendarTimelineRef.current ?? calendarSectionRef.current), 80);
    }
  }, [
    calendarSectionRef,
    calendarTimelineRef,
    notesEditorRef,
    notesSectionRef,
    scrollToSection,
    setActiveTab,
    setCalendarView,
    setSelectedCalendarDate,
    setStreakNudge,
    todaySectionRef,
    todayTimerRef,
  ]);

  return {
    openMobileNoteEditor,
    handleMobileCreateNote,
    handleOpenCurrentMobileNote,
    handleMobilePlannerOpen,
    openTimeBlockFlow,
    openSickDaySaveReview,
    openDailyPlanningPreview,
    handleTodayPrimaryAction,
    handleStreakNudgeAction,
  };
}
