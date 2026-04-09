"use client";

import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import type { User } from "firebase/auth";

import { resolveAccessibleCalendarTone, type CalendarTone } from "@/lib/calendar-tones";
import { type PlannedBlock } from "@/hooks/usePlannedBlocks";

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
  calendarSectionRef?: React.RefObject<HTMLElement | null>;
  mobileDayTimelineScrollRef?: React.RefObject<HTMLDivElement | null>;
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
  calendarSectionRef,
  mobileDayTimelineScrollRef,
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
    if (!user) return;
    const next = { ...dayTones };
    const accessibleTone = resolveAccessibleCalendarTone(tone, isPro);
    if (accessibleTone) {
      next[dateKey] = accessibleTone;
    } else {
      delete next[dateKey];
    }
    setDayTones(next);
    persistDayTones(user.uid, next);
  }, [dayTones, isPro, persistDayTones, setDayTones, user]);

  const applyMonthTone = useCallback((monthKey: string, tone: CalendarTone | null) => {
    if (!user) return;
    const next = { ...monthTones };
    const accessibleTone = resolveAccessibleCalendarTone(tone, isPro);
    if (accessibleTone) {
      next[monthKey] = accessibleTone;
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

    let frame = 0;
    let timer: number | null = null;
    let cancelled = false;
    let lookupAttempts = 0;
    let outerAttempts = 0;
    let innerAttempts = 0;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scrollBehavior = prefersReducedMotion ? "auto" : "smooth";

    const completeJump = () => {
      if (activatedCalendarEntryTimeoutRef.current !== null) {
        window.clearTimeout(activatedCalendarEntryTimeoutRef.current);
      }
      setActivatedCalendarEntryId(pendingCalendarEntryFocusId);
      activatedCalendarEntryTimeoutRef.current = window.setTimeout(() => {
        setActivatedCalendarEntryId((current) =>
          current === pendingCalendarEntryFocusId ? null : current,
        );
        activatedCalendarEntryTimeoutRef.current = null;
      }, prefersReducedMotion ? 900 : 1800);
      setPendingCalendarEntryFocusId(null);
    };

    const startInnerStage = () => {
      if (cancelled) return;
      const target = document.querySelector<HTMLElement>(
        `[data-calendar-entry-id="${pendingCalendarEntryFocusId}"]`,
      );
      if (!target) {
        lookupAttempts += 1;
        if (lookupAttempts < 36) {
          frame = window.requestAnimationFrame(startInnerStage);
        } else {
          setPendingCalendarEntryFocusId(null);
        }
        return;
      }

      setCalendarPinnedEntryId(null);
      setCalendarHoverEntryId(null);
      const timelineScrollContainer = mobileDayTimelineScrollRef?.current;

      if (!timelineScrollContainer) {
        target.scrollIntoView({
          behavior: scrollBehavior,
          block: "center",
          inline: "nearest",
        });
        completeJump();
        return;
      }

      const settleInnerScroll = () => {
        if (cancelled) return;
        const latestTarget = document.querySelector<HTMLElement>(
          `[data-calendar-entry-id="${pendingCalendarEntryFocusId}"]`,
        );
        if (!latestTarget) {
          lookupAttempts += 1;
          if (lookupAttempts < 36) {
            frame = window.requestAnimationFrame(settleInnerScroll);
          } else {
            setPendingCalendarEntryFocusId(null);
          }
          return;
        }

        const targetRect = latestTarget.getBoundingClientRect();
        const containerRect = timelineScrollContainer.getBoundingClientRect();
        const desiredViewportTop = Math.max(42, timelineScrollContainer.clientHeight * 0.38 - targetRect.height / 2);
        const desiredScrollTop =
          timelineScrollContainer.scrollTop +
          (targetRect.top - containerRect.top) -
          desiredViewportTop;
        const clampedTargetTop = Math.max(0, desiredScrollTop);
        const delta = clampedTargetTop - timelineScrollContainer.scrollTop;

        if (Math.abs(delta) <= 10 || innerAttempts >= 18 || prefersReducedMotion) {
          if (prefersReducedMotion && Math.abs(delta) > 1) {
            timelineScrollContainer.scrollTo({ top: clampedTargetTop, behavior: "auto" });
          }
          completeJump();
          return;
        }

        timelineScrollContainer.scrollTo({
          top: clampedTargetTop,
          behavior: scrollBehavior,
        });
        innerAttempts += 1;
        timer = window.setTimeout(() => {
          frame = window.requestAnimationFrame(settleInnerScroll);
        }, 140);
      };

      frame = window.requestAnimationFrame(settleInnerScroll);
    };

    const stageOuterScheduleScroll = () => {
      if (cancelled) return;
      const scheduleChamber =
        document.getElementById("calendar-day-chamber") ?? calendarSectionRef?.current ?? null;
      const mobileTimelineShell = mobileDayTimelineScrollRef?.current ?? null;
      const outerAnchor = isMobileViewport && mobileTimelineShell ? mobileTimelineShell : scheduleChamber;

      if (!outerAnchor) {
        frame = window.requestAnimationFrame(startInnerStage);
        return;
      }

      if (!isMobileViewport) {
        outerAnchor.scrollIntoView({
          behavior: scrollBehavior,
          block: "start",
          inline: "nearest",
        });
        timer = window.setTimeout(() => {
          frame = window.requestAnimationFrame(startInnerStage);
        }, prefersReducedMotion ? 0 : 220);
        return;
      }

      const settleOuterScroll = () => {
        if (cancelled) return;
        const latestOuterAnchor = mobileDayTimelineScrollRef?.current ?? outerAnchor;
        const anchorRect = latestOuterAnchor.getBoundingClientRect();
        const topBarHeight =
          document.querySelector<HTMLElement>("[class*='topAppBar']")?.getBoundingClientRect().height ?? 0;
        const bottomTabsHeight =
          document.querySelector<HTMLElement>("[class*='bottomTabs']")?.getBoundingClientRect().height ?? 0;
        const topPadding = Math.max(18, topBarHeight + 10);
        const bottomPadding = Math.max(20, bottomTabsHeight + 18);
        const availableViewport = Math.max(120, window.innerHeight - topPadding - bottomPadding);
        const desiredAnchorTop = topPadding + Math.min(36, availableViewport * 0.08);
        const targetWindowTop = Math.max(0, window.scrollY + anchorRect.top - desiredAnchorTop);
        const anchorDelta = anchorRect.top - desiredAnchorTop;

        if (Math.abs(anchorDelta) <= 18 || outerAttempts >= 18 || prefersReducedMotion) {
          if (prefersReducedMotion && Math.abs(anchorDelta) > 1) {
            window.scrollTo({ top: targetWindowTop, behavior: "auto" });
          }
          timer = window.setTimeout(() => {
            frame = window.requestAnimationFrame(startInnerStage);
          }, prefersReducedMotion ? 0 : 90);
          return;
        }

        window.scrollTo({
          top: targetWindowTop,
          behavior: scrollBehavior,
        });
        outerAttempts += 1;
        timer = window.setTimeout(() => {
          frame = window.requestAnimationFrame(settleOuterScroll);
        }, 140);
      };

      frame = window.requestAnimationFrame(settleOuterScroll);
    };

    frame = window.requestAnimationFrame(stageOuterScheduleScroll);

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      window.cancelAnimationFrame(frame);
    };
  }, [
    calendarEntryById,
    calendarView,
    calendarSectionRef,
    isMobileViewport,
    mobileDayTimelineScrollRef,
    pendingCalendarEntryFocusId,
    setActivatedCalendarEntryId,
    setCalendarHoverEntryId,
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
