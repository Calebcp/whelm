"use client";

import { useMemo } from "react";

import type { ScheduleTabProps } from "@/components/ScheduleTab";

type UseScheduleTabPropsOptions = {
  refs: Pick<
    ScheduleTabProps,
    | "sectionRef"
    | "calendarMonthRef"
    | "calendarPlannerRef"
    | "calendarHeroRef"
    | "calendarTimelineRef"
    | "mobileDayTimelineScrollRef"
  >;
  view: Pick<
    ScheduleTabProps,
    | "calendarView"
    | "calendarMonthLabel"
    | "calendarMonthInput"
    | "calendarJumpDate"
    | "selectedCalendarMonthKey"
    | "mobileCalendarControlsOpen"
    | "calendarAuxPanel"
    | "isMobileViewport"
    | "mobileStreakJumpStyle"
    | "streak"
    | "isPro"
  >;
  month: Pick<
    ScheduleTabProps,
    | "dynamicMonthCalendar"
    | "calendarEntriesByDate"
    | "selectedMonthTone"
    | "calendarHoverEntryId"
    | "calendarPinnedEntryId"
    | "activeCalendarPreview"
  >;
  day: Pick<
    ScheduleTabProps,
    | "selectedDateKey"
    | "isSelectedDateToday"
    | "selectedDateSummary"
    | "selectedDateFocusedMinutes"
    | "selectedDatePlans"
    | "selectedDateEntries"
    | "selectedDateDayTone"
    | "selectedDateCanAddBlocks"
    | "bandanaColor"
    | "currentTimeMarker"
    | "dayViewTimeline"
    | "mobileDayTimelineHeight"
    | "activatedCalendarEntryId"
    | "activeOverlapPickerItem"
    | "activeDayViewPreviewItem"
  >;
  planner: Pick<
    ScheduleTabProps,
    | "plannerSectionsOpen"
    | "selectedDatePlanGroups"
    | "selectedDateAgendaStateSummary"
    | "mobileAgendaEntriesOpen"
    | "draggedPlanId"
    | "plannedBlockById"
  >;
  streak: Pick<
    ScheduleTabProps,
    | "focusMetricsCalendar"
    | "historicalStreaksByDay"
    | "calendarCompanionPulse"
  >;
  handlers: Pick<
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
    | "onScrollCalendarTimelineToNow"
    | "onShowCalendarHoverPreview"
    | "onScheduleCalendarHoverPreviewClear"
    | "onClearCalendarHoverPreviewDelay"
    | "onSetOverlapPickerEntryId"
    | "onOpenNote"
    | "onSetActiveTabHistory"
    | "onCompletePlannedBlock"
    | "onUpdatePlannedBlockTime"
    | "onDeletePlannedBlock"
    | "onReorderPlannedBlocks"
    | "onSetDraggedPlanId"
    | "onSetPlannerSectionsOpen"
    | "onSetMobileAgendaEntriesOpen"
    | "onUpgrade"
  >;
};

export function useScheduleTabProps({
  refs,
  view,
  month,
  day,
  planner,
  streak,
  handlers,
}: UseScheduleTabPropsOptions) {
  return useMemo<ScheduleTabProps>(
    () => ({
      ...refs,
      ...view,
      ...month,
      ...day,
      ...planner,
      ...streak,
      ...handlers,
    }),
    [
      refs.sectionRef,
      refs.calendarMonthRef,
      refs.calendarPlannerRef,
      refs.calendarHeroRef,
      refs.calendarTimelineRef,
      refs.mobileDayTimelineScrollRef,
      view.calendarView,
      view.calendarMonthLabel,
      view.calendarMonthInput,
      view.calendarJumpDate,
      view.selectedCalendarMonthKey,
      view.mobileCalendarControlsOpen,
      view.calendarAuxPanel,
      view.isMobileViewport,
      view.mobileStreakJumpStyle,
      view.streak,
      view.isPro,
      month.dynamicMonthCalendar,
      month.calendarEntriesByDate,
      month.selectedMonthTone,
      month.calendarHoverEntryId,
      month.calendarPinnedEntryId,
      month.activeCalendarPreview,
      day.selectedDateKey,
      day.isSelectedDateToday,
      day.selectedDateSummary,
      day.selectedDateFocusedMinutes,
      day.selectedDatePlans,
      day.selectedDateEntries,
      day.selectedDateDayTone,
      day.selectedDateCanAddBlocks,
      day.bandanaColor,
      day.currentTimeMarker,
      day.dayViewTimeline,
      day.mobileDayTimelineHeight,
      day.activatedCalendarEntryId,
      day.activeOverlapPickerItem,
      day.activeDayViewPreviewItem,
      planner.plannerSectionsOpen,
      planner.selectedDatePlanGroups,
      planner.selectedDateAgendaStateSummary,
      planner.mobileAgendaEntriesOpen,
      planner.draggedPlanId,
      planner.plannedBlockById,
      streak.focusMetricsCalendar,
      streak.historicalStreaksByDay,
      streak.calendarCompanionPulse,
      handlers.onPrevMonth,
      handlers.onNextMonth,
      handlers.onSetCalendarView,
      handlers.onSetCalendarCursor,
      handlers.onSetCalendarJumpDate,
      handlers.onCalendarJumpGo,
      handlers.onToggleMobileCalendarControls,
      handlers.onSetCalendarAuxPanel,
      handlers.onGoToStreaks,
      handlers.onApplyMonthTone,
      handlers.onSelectCalendarDate,
      handlers.onSetCalendarHoverEntryId,
      handlers.onSetCalendarPinnedEntryId,
      handlers.onOpenPlannedBlockDetail,
      handlers.onApplyDayTone,
      handlers.onScrollCalendarTimelineToNow,
      handlers.onShowCalendarHoverPreview,
      handlers.onScheduleCalendarHoverPreviewClear,
      handlers.onClearCalendarHoverPreviewDelay,
      handlers.onSetOverlapPickerEntryId,
      handlers.onOpenNote,
      handlers.onSetActiveTabHistory,
      handlers.onCompletePlannedBlock,
      handlers.onUpdatePlannedBlockTime,
      handlers.onDeletePlannedBlock,
      handlers.onReorderPlannedBlocks,
      handlers.onSetDraggedPlanId,
      handlers.onSetPlannerSectionsOpen,
      handlers.onSetMobileAgendaEntriesOpen,
      handlers.onUpgrade,
    ],
  );
}
