"use client";

import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type { User } from "firebase/auth";

import { type CalendarTone, type PlannedBlock } from "@/hooks/usePlannedBlocks";

type UseCalendarInteractionsOptions<
  TCalendarEntry extends { id: string },
  TDayViewItem extends { id: string },
> = {
  user: User | null;
  isPro: boolean;
  calendarView: "month" | "day";
  isMobileViewport: boolean;
  selectedDateKey: string;
  selectedPlanDetailId: string | null;
  setSelectedPlanDetailId: Dispatch<SetStateAction<string | null>>;
  plannedBlocks: PlannedBlock[];
  dayTones: Record<string, CalendarTone>;
  setDayTones: Dispatch<SetStateAction<Record<string, CalendarTone>>>;
  monthTones: Record<string, CalendarTone>;
  setMonthTones: Dispatch<SetStateAction<Record<string, CalendarTone>>>;
  calendarEntryById: Map<string, TCalendarEntry>;
  calendarHoverEntryId: string | null;
  setCalendarHoverEntryId: Dispatch<SetStateAction<string | null>>;
  calendarPinnedEntryId: string | null;
  setCalendarPinnedEntryId: Dispatch<SetStateAction<string | null>>;
  overlapPickerEntryId: string | null;
  dayViewTimelineItems: TDayViewItem[];
  pendingCalendarEntryFocusId: string | null;
  setPendingCalendarEntryFocusId: Dispatch<SetStateAction<string | null>>;
  setActivatedCalendarEntryId: Dispatch<SetStateAction<string | null>>;
  setCalendarJumpDate: Dispatch<SetStateAction<string>>;
  persistDayTones: (uid: string, tones: Record<string, CalendarTone>) => void;
  persistMonthTones: (uid: string, tones: Record<string, CalendarTone>) => void;
};

export function useCalendarInteractions<
  TCalendarEntry extends { id: string },
  TDayViewItem extends { id: string },
>({
  user,
  isPro,
  calendarView,
  isMobileViewport,
  selectedDateKey,
  selectedPlanDetailId,
  setSelectedPlanDetailId,
  plannedBlocks,
  dayTones,
  setDayTones,
  monthTones,
  setMonthTones,
  calendarEntryById,
  calendarHoverEntryId,
  setCalendarHoverEntryId,
  calendarPinnedEntryId,
  setCalendarPinnedEntryId,
  overlapPickerEntryId,
  dayViewTimelineItems,
  pendingCalendarEntryFocusId,
  setPendingCalendarEntryFocusId,
  setActivatedCalendarEntryId,
  setCalendarJumpDate,
  persistDayTones,
  persistMonthTones,
}: UseCalendarInteractionsOptions<TCalendarEntry, TDayViewItem>) {
  const activatedCalendarEntryTimeoutRef = useRef<number | null>(null);
  const calendarHoverPreviewTimeoutRef = useRef<number | null>(null);

  const plannedBlockById = useMemo(
    () => new Map(plannedBlocks.map((item) => [item.id, item])),
    [plannedBlocks],
  );
  const selectedPlanDetail = selectedPlanDetailId
    ? plannedBlockById.get(selectedPlanDetailId) ?? null
    : null;

  const activeCalendarPreview = useMemo(() => {
    const id =
      calendarView === "day"
        ? calendarPinnedEntryId ?? (!isMobileViewport ? calendarHoverEntryId : null)
        : calendarPinnedEntryId ?? calendarHoverEntryId;
    if (!id) return null;
    return calendarEntryById.get(id) ?? null;
  }, [
    calendarEntryById,
    calendarHoverEntryId,
    calendarPinnedEntryId,
    calendarView,
    isMobileViewport,
  ]);

  const activeDayViewPreviewItem = useMemo(() => {
    if (calendarView !== "day" || !activeCalendarPreview) return null;
    return dayViewTimelineItems.find((entry) => entry.id === activeCalendarPreview.id) ?? null;
  }, [activeCalendarPreview, calendarView, dayViewTimelineItems]);

  const activeOverlapPickerItem = useMemo(() => {
    if (calendarView !== "day" || !overlapPickerEntryId) return null;
    return dayViewTimelineItems.find((entry) => entry.id === overlapPickerEntryId) ?? null;
  }, [calendarView, dayViewTimelineItems, overlapPickerEntryId]);

  const clearCalendarHoverPreviewDelay = useCallback(() => {
    if (calendarHoverPreviewTimeoutRef.current !== null) {
      window.clearTimeout(calendarHoverPreviewTimeoutRef.current);
      calendarHoverPreviewTimeoutRef.current = null;
    }
  }, []);

  const showCalendarHoverPreview = useCallback((entryId: string) => {
    if (isMobileViewport || calendarPinnedEntryId) return;
    clearCalendarHoverPreviewDelay();
    setCalendarHoverEntryId(entryId);
  }, [calendarPinnedEntryId, clearCalendarHoverPreviewDelay, isMobileViewport, setCalendarHoverEntryId]);

  const scheduleCalendarHoverPreviewClear = useCallback((entryId?: string) => {
    if (isMobileViewport || calendarPinnedEntryId) return;
    clearCalendarHoverPreviewDelay();
    calendarHoverPreviewTimeoutRef.current = window.setTimeout(() => {
      setCalendarHoverEntryId((current) => (entryId && current !== entryId ? current : null));
      calendarHoverPreviewTimeoutRef.current = null;
    }, 120);
  }, [calendarPinnedEntryId, clearCalendarHoverPreviewDelay, isMobileViewport, setCalendarHoverEntryId]);

  const jumpToCalendarSection = useCallback((sectionId: string) => {
    if (sectionId === "calendar-planner") {
      sectionId = "calendar-day-chamber";
    }
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const openPlannedBlockDetail = useCallback((blockId: string) => {
    setSelectedPlanDetailId(blockId);
  }, [setSelectedPlanDetailId]);

  const closePlannedBlockDetail = useCallback(() => {
    setSelectedPlanDetailId(null);
  }, [setSelectedPlanDetailId]);

  const applyDayTone = useCallback((dateKey: string, tone: CalendarTone | null) => {
    if (!user || !isPro) return;
    const next = { ...dayTones };
    if (tone) {
      next[dateKey] = tone;
    } else {
      delete next[dateKey];
    }
    setDayTones(next);
    persistDayTones(user.uid, next);
  }, [dayTones, isPro, persistDayTones, setDayTones, user]);

  const applyMonthTone = useCallback((monthKey: string, tone: CalendarTone | null) => {
    if (!user || !isPro) return;
    const next = { ...monthTones };
    if (tone) {
      next[monthKey] = tone;
    } else {
      delete next[monthKey];
    }
    setMonthTones(next);
    persistMonthTones(user.uid, next);
  }, [isPro, monthTones, persistMonthTones, setMonthTones, user]);

  useEffect(() => {
    if (
      selectedPlanDetailId &&
      (!plannedBlockById.has(selectedPlanDetailId) || plannedBlockById.get(selectedPlanDetailId)?.status === "deleted")
    ) {
      setSelectedPlanDetailId(null);
    }
  }, [plannedBlockById, selectedPlanDetailId, setSelectedPlanDetailId]);

  useEffect(() => {
    setCalendarJumpDate(selectedDateKey);
  }, [selectedDateKey, setCalendarJumpDate]);

  useEffect(() => {
    if (calendarPinnedEntryId && !calendarEntryById.has(calendarPinnedEntryId)) {
      setCalendarPinnedEntryId(null);
    }
    if (calendarHoverEntryId && !calendarEntryById.has(calendarHoverEntryId)) {
      setCalendarHoverEntryId(null);
    }
  }, [
    calendarEntryById,
    calendarHoverEntryId,
    calendarPinnedEntryId,
    setCalendarHoverEntryId,
    setCalendarPinnedEntryId,
  ]);

  useEffect(() => {
    if (!pendingCalendarEntryFocusId || calendarView !== "day") return;
    const entry = calendarEntryById.get(pendingCalendarEntryFocusId);
    if (!entry) return;

    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-calendar-entry-id="${pendingCalendarEntryFocusId}"]`,
      );
      if (!target) return;
      setCalendarPinnedEntryId(pendingCalendarEntryFocusId);
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (activatedCalendarEntryTimeoutRef.current !== null) {
        window.clearTimeout(activatedCalendarEntryTimeoutRef.current);
      }
      setActivatedCalendarEntryId(pendingCalendarEntryFocusId);
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      activatedCalendarEntryTimeoutRef.current = window.setTimeout(() => {
        setActivatedCalendarEntryId((current) =>
          current === pendingCalendarEntryFocusId ? null : current,
        );
        activatedCalendarEntryTimeoutRef.current = null;
      }, prefersReducedMotion ? 900 : 1800);
      setPendingCalendarEntryFocusId(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    calendarEntryById,
    calendarView,
    pendingCalendarEntryFocusId,
    setActivatedCalendarEntryId,
    setCalendarPinnedEntryId,
    setPendingCalendarEntryFocusId,
  ]);

  useEffect(() => {
    return () => {
      if (activatedCalendarEntryTimeoutRef.current !== null) {
        window.clearTimeout(activatedCalendarEntryTimeoutRef.current);
      }
      if (calendarHoverPreviewTimeoutRef.current !== null) {
        window.clearTimeout(calendarHoverPreviewTimeoutRef.current);
      }
    };
  }, []);

  return {
    selectedPlanDetail,
    activeCalendarPreview,
    activeDayViewPreviewItem,
    activeOverlapPickerItem,
    clearCalendarHoverPreviewDelay,
    showCalendarHoverPreview,
    scheduleCalendarHoverPreviewClear,
    jumpToCalendarSection,
    openPlannedBlockDetail,
    closePlannedBlockDetail,
    applyDayTone,
    applyMonthTone,
  };
}
