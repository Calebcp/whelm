"use client";

import type { ScheduleTabProps } from "@/components/ScheduleTab";
import { useScheduleTabProps } from "@/hooks/useScheduleTabProps";

export type ScheduleShellRefs = Pick<
  ScheduleTabProps,
  | "sectionRef"
  | "calendarMonthRef"
  | "calendarPlannerRef"
  | "calendarHeroRef"
  | "calendarTimelineRef"
  | "mobileDayTimelineScrollRef"
>;

export type ScheduleShellState = Omit<
  ScheduleTabProps,
  | keyof ScheduleShellRefs
  | "onPrevMonth"
  | "onNextMonth"
  | "onSetCalendarView"
  | "onSetCalendarCursor"
  | "onSetCalendarJumpDate"
  | "onCalendarJumpGo"
  | "onToggleMobileCalendarControls"
  | "onSetCalendarAuxPanel"
  | "onGoToStreaks"
  | "onApplyMonthTone"
  | "onSelectCalendarDate"
  | "onSetCalendarHoverEntryId"
  | "onSetCalendarPinnedEntryId"
  | "onOpenPlannedBlockDetail"
  | "onApplyDayTone"
  | "onOpenCalendarBlockComposer"
  | "onCloseBlockComposer"
  | "onScrollCalendarTimelineToNow"
  | "onShowCalendarHoverPreview"
  | "onScheduleCalendarHoverPreviewClear"
  | "onClearCalendarHoverPreviewDelay"
  | "onSetOverlapPickerEntryId"
  | "onOpenNote"
  | "onSetActiveTabHistory"
  | "onCompletePlannedBlock"
  | "onSetPlanTitle"
  | "onSetPlanNoteExpanded"
  | "onSetPlanNote"
  | "onSetPlanTone"
  | "onSetPlanConflictWarning"
  | "onSetPlanTime"
  | "onSetPlanDuration"
  | "onAddPlannedBlock"
  | "onUpdatePlannedBlockTime"
  | "onDeletePlannedBlock"
  | "onReorderPlannedBlocks"
  | "onSetDraggedPlanId"
  | "onSetPlannerSectionsOpen"
  | "onSetMobileAgendaEntriesOpen"
  | "onUpgrade"
>;

export type ScheduleShellHandlers = Pick<
  ScheduleTabProps,
  | "onPrevMonth"
  | "onNextMonth"
  | "onSetCalendarView"
  | "onSetCalendarCursor"
  | "onSetCalendarJumpDate"
  | "onCalendarJumpGo"
  | "onToggleMobileCalendarControls"
  | "onSetCalendarAuxPanel"
  | "onGoToStreaks"
  | "onApplyMonthTone"
  | "onSelectCalendarDate"
  | "onSetCalendarHoverEntryId"
  | "onSetCalendarPinnedEntryId"
  | "onOpenPlannedBlockDetail"
  | "onApplyDayTone"
  | "onOpenCalendarBlockComposer"
  | "onCloseBlockComposer"
  | "onScrollCalendarTimelineToNow"
  | "onShowCalendarHoverPreview"
  | "onScheduleCalendarHoverPreviewClear"
  | "onClearCalendarHoverPreviewDelay"
  | "onSetOverlapPickerEntryId"
  | "onOpenNote"
  | "onSetActiveTabHistory"
  | "onCompletePlannedBlock"
  | "onSetPlanTitle"
  | "onSetPlanNoteExpanded"
  | "onSetPlanNote"
  | "onSetPlanTone"
  | "onSetPlanConflictWarning"
  | "onSetPlanTime"
  | "onSetPlanDuration"
  | "onAddPlannedBlock"
  | "onUpdatePlannedBlockTime"
  | "onDeletePlannedBlock"
  | "onReorderPlannedBlocks"
  | "onSetDraggedPlanId"
  | "onSetPlannerSectionsOpen"
  | "onSetMobileAgendaEntriesOpen"
  | "onUpgrade"
>;

type UseScheduleShellViewModelOptions = {
  refs: ScheduleShellRefs;
  state: ScheduleShellState;
  handlers: ScheduleShellHandlers;
};

export function useScheduleShellViewModel({
  refs,
  state,
  handlers,
}: UseScheduleShellViewModelOptions) {
  return useScheduleTabProps({
    refs,
    view: {
      calendarView: state.calendarView,
      calendarMonthLabel: state.calendarMonthLabel,
      calendarMonthInput: state.calendarMonthInput,
      calendarJumpDate: state.calendarJumpDate,
      selectedCalendarMonthKey: state.selectedCalendarMonthKey,
      mobileCalendarControlsOpen: state.mobileCalendarControlsOpen,
      calendarAuxPanel: state.calendarAuxPanel,
      isMobileViewport: state.isMobileViewport,
      mobileStreakJumpStyle: state.mobileStreakJumpStyle,
      streak: state.streak,
      isPro: state.isPro,
    },
    month: {
      dynamicMonthCalendar: state.dynamicMonthCalendar,
      calendarEntriesByDate: state.calendarEntriesByDate,
      selectedMonthTone: state.selectedMonthTone,
      calendarHoverEntryId: state.calendarHoverEntryId,
      calendarPinnedEntryId: state.calendarPinnedEntryId,
      activeCalendarPreview: state.activeCalendarPreview,
    },
    day: {
      selectedDateKey: state.selectedDateKey,
      isSelectedDateToday: state.isSelectedDateToday,
      selectedDateSummary: state.selectedDateSummary,
      selectedDateFocusedMinutes: state.selectedDateFocusedMinutes,
      selectedDatePlans: state.selectedDatePlans,
      selectedDateEntries: state.selectedDateEntries,
      selectedDateDayTone: state.selectedDateDayTone,
      selectedDateCanAddBlocks: state.selectedDateCanAddBlocks,
      dayPortalComposerOpen: state.dayPortalComposerOpen,
      bandanaColor: state.bandanaColor,
      currentTimeMarker: state.currentTimeMarker,
      dayViewTimeline: state.dayViewTimeline,
      mobileDayTimelineHeight: state.mobileDayTimelineHeight,
      activatedCalendarEntryId: state.activatedCalendarEntryId,
      activeOverlapPickerItem: state.activeOverlapPickerItem,
      activeDayViewPreviewItem: state.activeDayViewPreviewItem,
    },
    planner: {
      planTitle: state.planTitle,
      planNoteExpanded: state.planNoteExpanded,
      planNote: state.planNote,
      planTone: state.planTone,
      planConflictWarning: state.planConflictWarning,
      planTime: state.planTime,
      planDuration: state.planDuration,
      planStatus: state.planStatus,
      editingPlannedBlockId: state.editingPlannedBlockId,
      plannerSectionsOpen: state.plannerSectionsOpen,
      selectedDatePlanGroups: state.selectedDatePlanGroups,
      selectedDateAgendaStateSummary: state.selectedDateAgendaStateSummary,
      mobileAgendaEntriesOpen: state.mobileAgendaEntriesOpen,
      mobileBlockSheetOpen: state.mobileBlockSheetOpen,
      draggedPlanId: state.draggedPlanId,
      plannedBlockById: state.plannedBlockById,
    },
    streak: {
      focusMetricsCalendar: state.focusMetricsCalendar,
      historicalStreaksByDay: state.historicalStreaksByDay,
      calendarCompanionPulse: state.calendarCompanionPulse,
    },
    handlers,
  });
}
