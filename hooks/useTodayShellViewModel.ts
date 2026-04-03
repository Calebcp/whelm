"use client";

import { useMemo } from "react";

import type { TodayTabProps } from "@/components/TodayTab";
import type { AppTab } from "@/lib/app-tabs";

export type TodayShellRefs = Pick<
  TodayTabProps,
  | "todaySectionRef"
  | "todayTimerRef"
  | "todaySummaryRef"
>;

export type TodayShellState = Omit<
  TodayTabProps,
  | keyof TodayShellRefs
  | "onOpenSessionNotes"
  | "onSessionStart"
  | "onSessionAbandon"
  | "onSessionComplete"
  | "onToggleMobileTodayOverview"
  | "onTodayPrimaryAction"
  | "onOpenNote"
  | "onCreateWorkspaceNote"
  | "onCopyWeeklyReport"
  | "onUpgrade"
  | "senseiActionTabTitle"
> & {
  senseiActionTab: AppTab;
};

export type TodayShellHandlers = Pick<
  TodayTabProps,
  | "onOpenSessionNotes"
  | "onSessionStart"
  | "onSessionAbandon"
  | "onSessionComplete"
  | "onToggleMobileTodayOverview"
  | "onTodayPrimaryAction"
  | "onOpenNote"
  | "onCreateWorkspaceNote"
  | "onCopyWeeklyReport"
  | "onUpgrade"
>;

type UseTodayShellViewModelOptions = {
  refs: TodayShellRefs;
  state: TodayShellState;
  handlers: TodayShellHandlers;
  getTabTitle: (tab: AppTab) => string;
};

export function useTodayShellViewModel({
  refs,
  state,
  handlers,
  getTabTitle,
}: UseTodayShellViewModelOptions) {
  return useMemo<TodayTabProps>(
    () => ({
      ...refs,
      ...state,
      ...handlers,
      senseiActionTabTitle: getTabTitle(state.senseiActionTab),
    }),
    [
      refs.todaySectionRef,
      refs.todayTimerRef,
      refs.todaySummaryRef,
      state.isMobileViewport,
      state.isPro,
      state.resolvedTheme,
      state.todaySessionNoteCount,
      state.focusMetrics,
      state.streak,
      state.mobileTodayOverviewOpen,
      state.nextPlannedBlock,
      state.dueReminderNotes,
      state.lastSession,
      state.lastSessionHoursAgo,
      state.latestNote,
      state.orderedNotes,
      state.todayActivePlannedBlocksCount,
      state.senseiGuidance,
      state.todayHeroCopy,
      state.companionStageLabel,
      state.nextSenseiMilestone,
      state.senseiReaction,
      state.bandanaColor,
      state.reportCopyStatus,
      state.userEmail,
      state.senseiActionTab,
      handlers.onOpenSessionNotes,
      handlers.onSessionStart,
      handlers.onSessionAbandon,
      handlers.onSessionComplete,
      handlers.onToggleMobileTodayOverview,
      handlers.onTodayPrimaryAction,
      handlers.onOpenNote,
      handlers.onCreateWorkspaceNote,
      handlers.onCopyWeeklyReport,
      handlers.onUpgrade,
      getTabTitle,
    ],
  );
}
