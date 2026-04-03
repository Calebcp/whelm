"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { AppTab } from "@/lib/app-tabs";

type DomAnchor = { current: HTMLElement | null };

type Anchors = {
  todaySectionRef: DomAnchor;
  todaySummaryRef: DomAnchor;
  todayTimerRef: DomAnchor;
  calendarSectionRef: DomAnchor;
  calendarHeroRef: DomAnchor;
  calendarMonthRef: DomAnchor;
  calendarTimelineRef: DomAnchor;
  mirrorSectionRef: DomAnchor;
  mirrorEntriesAnchorRef: DomAnchor;
  leaderboardSectionRef: DomAnchor;
  leaderboardPrimaryRef: DomAnchor;
  historySectionRef: DomAnchor;
  historyPrimaryRef: DomAnchor;
  reportsSectionRef: DomAnchor;
  reportsPrimaryRef: DomAnchor;
  streaksSectionRef: DomAnchor;
  streaksPrimaryRef: DomAnchor;
  settingsSectionRef: DomAnchor;
  settingsPrimaryRef: DomAnchor;
  notesSectionRef: DomAnchor;
  notesRecentRef: DomAnchor;
  notesStartRef: DomAnchor;
  notesEditorRef: DomAnchor;
  mobileDayTimelineScrollRef: DomAnchor;
};

type UseTabNavigationOptions = {
  activeTab: AppTab;
  setActiveTab: Dispatch<SetStateAction<AppTab>>;
  isMobileViewport: boolean;
  calendarView: "month" | "day";
  selectedDateKey: string;
  dayViewTimeline: {
    startMinute: number;
    totalMinutes: number;
    items: Array<{ id: string; startMinute: number }>;
  };
  currentTimeMarkerMinute: number | null | undefined;
  anchors: Anchors;
};

export function useTabNavigation({
  activeTab,
  setActiveTab,
  isMobileViewport,
  calendarView,
  selectedDateKey,
  dayViewTimeline,
  currentTimeMarkerMinute,
  anchors,
}: UseTabNavigationOptions) {
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const tabScrollPositionsRef = useRef<Partial<Record<AppTab, number>>>({});
  const lastTabTapRef = useRef<{ key: AppTab | "more"; at: number } | null>(null);
  const guidedRevealSeenRef = useRef<Partial<Record<AppTab, boolean>>>({});
  const previousActiveTabRef = useRef<AppTab | null>(null);
  const dayTimelineMotionRef = useRef<"guide" | "restore">("restore");
  const activeMotionCancelRef = useRef<(() => void) | null>(null);

  function cancelActiveMotion() {
    activeMotionCancelRef.current?.();
    activeMotionCancelRef.current = null;
  }

  function runInterruptibleScroll({
    getPosition,
    setPosition,
    target,
    duration = 500,
    onComplete,
  }: {
    getPosition: () => number;
    setPosition: (next: number) => void;
    target: number;
    duration?: number;
    onComplete?: () => void;
  }) {
    if (typeof window === "undefined") return;

    cancelActiveMotion();

    const start = getPosition();
    const distance = target - start;
    if (Math.abs(distance) < 2) {
      setPosition(target);
      onComplete?.();
      return;
    }

    let frameId: number | null = null;
    let finished = false;
    const startedAt = performance.now();
    const easeInOut = (value: number) =>
      value < 0.5 ? 4 * value * value * value : 1 - ((-2 * value + 2) ** 3) / 2;

    const cleanup = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("wheel", interrupt, listenerOptions);
      window.removeEventListener("touchstart", interrupt, listenerOptions);
      window.removeEventListener("pointerdown", interrupt, listenerOptions);
      window.removeEventListener("keydown", interrupt, listenerOptions);
      if (activeMotionCancelRef.current === interrupt) {
        activeMotionCancelRef.current = null;
      }
    };

    const finish = (complete: boolean) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (complete) {
        setPosition(target);
        onComplete?.();
      }
    };

    const step = (timestamp: number) => {
      if (finished) return;
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const eased = easeInOut(progress);
      setPosition(start + distance * eased);
      if (progress >= 1) {
        finish(true);
        return;
      }
      frameId = window.requestAnimationFrame(step);
    };

    const interrupt = () => finish(false);
    const listenerOptions: AddEventListenerOptions = { passive: true };

    activeMotionCancelRef.current = interrupt;
    window.addEventListener("wheel", interrupt, listenerOptions);
    window.addEventListener("touchstart", interrupt, listenerOptions);
    window.addEventListener("pointerdown", interrupt, listenerOptions);
    window.addEventListener("keydown", interrupt, listenerOptions);
    frameId = window.requestAnimationFrame(step);
  }

  function scrollWindowToY(
    target: number,
    options?: { immediate?: boolean; duration?: number; onComplete?: () => void },
  ) {
    if (typeof window === "undefined") return;
    if (options?.immediate) {
      cancelActiveMotion();
      window.scrollTo({ top: target, behavior: "auto" });
      options.onComplete?.();
      return;
    }

    runInterruptibleScroll({
      getPosition: () => window.scrollY,
      setPosition: (next) => window.scrollTo({ top: next, behavior: "auto" }),
      target,
      duration: options?.duration,
      onComplete: options?.onComplete,
    });
  }

  function scrollElementToY(
    element: HTMLElement,
    target: number,
    options?: { immediate?: boolean; duration?: number; onComplete?: () => void },
  ) {
    if (options?.immediate) {
      cancelActiveMotion();
      element.scrollTop = target;
      options.onComplete?.();
      return;
    }

    runInterruptibleScroll({
      getPosition: () => element.scrollTop,
      setPosition: (next) => {
        element.scrollTop = next;
      },
      target,
      duration: options?.duration,
      onComplete: options?.onComplete,
    });
  }

  function topAnchorForTab(tab: AppTab) {
    switch (tab) {
      case "today":
        return anchors.todaySectionRef.current;
      case "calendar":
        return anchors.calendarSectionRef.current;
      case "leaderboard":
        return anchors.leaderboardSectionRef.current;
      case "mirror":
        return anchors.mirrorSectionRef.current;
      case "notes":
        return anchors.notesSectionRef.current;
      case "history":
        return anchors.historySectionRef.current;
      case "reports":
        return anchors.reportsSectionRef.current;
      case "streaks":
        return anchors.streaksSectionRef.current;
      case "settings":
        return anchors.settingsSectionRef.current;
      default:
        return null;
    }
  }

  function primaryAnchorForTab(tab: AppTab) {
    switch (tab) {
      case "today":
        return anchors.todayTimerRef.current ?? anchors.todaySummaryRef.current;
      case "calendar":
        return anchors.calendarTimelineRef.current ?? anchors.calendarHeroRef.current ?? anchors.calendarMonthRef.current;
      case "leaderboard":
        return anchors.leaderboardPrimaryRef.current ?? anchors.leaderboardSectionRef.current;
      case "mirror":
        return anchors.mirrorEntriesAnchorRef.current ?? anchors.mirrorSectionRef.current;
      case "notes":
        return anchors.notesEditorRef.current ?? anchors.notesRecentRef.current ?? anchors.notesStartRef.current ?? anchors.notesSectionRef.current;
      case "history":
        return anchors.historyPrimaryRef.current ?? anchors.historySectionRef.current;
      case "reports":
        return anchors.reportsPrimaryRef.current ?? anchors.reportsSectionRef.current;
      case "streaks":
        return anchors.streaksPrimaryRef.current ?? anchors.streaksSectionRef.current;
      case "settings":
        return anchors.settingsPrimaryRef.current ?? anchors.settingsSectionRef.current;
      default:
        return null;
    }
  }

  function persistGuidedRevealSeen() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "whelm-guided-tabs-v1",
        JSON.stringify(guidedRevealSeenRef.current),
      );
    } catch {
      // Ignore storage failures in private / constrained webviews.
    }
  }

  const scrollToSection = useCallback((target: HTMLElement | null) => {
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  function scrollTabToTop(tab: AppTab) {
    cancelActiveMotion();
    if (tab === "calendar" && isMobileViewport) {
      const timelineContainer =
        anchors.mobileDayTimelineScrollRef.current ?? anchors.calendarTimelineRef.current;
      if (timelineContainer) {
        scrollElementToY(timelineContainer, 0, { duration: 320 });
      }
    }
    const target = topAnchorForTab(tab);
    if (target) {
      const top = window.scrollY + target.getBoundingClientRect().top;
      scrollWindowToY(top, { duration: 320 });
      return;
    }
    if (typeof window !== "undefined") {
      scrollWindowToY(0, { duration: 320 });
    }
  }

  function getDayTimelineScrollTarget() {
    const container = anchors.mobileDayTimelineScrollRef.current;
    if (!container) return null;

    const targetMinute =
      currentTimeMarkerMinute ??
      dayViewTimeline.items[0]?.startMinute ??
      dayViewTimeline.startMinute;
    const relative =
      (targetMinute - dayViewTimeline.startMinute) / Math.max(1, dayViewTimeline.totalMinutes);
    const contentHeight = container.scrollHeight;
    const viewportHeight = container.clientHeight;
    return Math.max(0, relative * contentHeight - viewportHeight * 0.5);
  }

  const scrollCalendarTimelineToNow = useCallback((options?: { immediate?: boolean; guided?: boolean }) => {
    const container = anchors.mobileDayTimelineScrollRef.current;
    const targetScrollTop = getDayTimelineScrollTarget();
    if (!container || targetScrollTop === null) return;

    if (options?.guided) {
      container.scrollTop = 0;
      scrollElementToY(container, targetScrollTop, { duration: 900 });
      return;
    }

    scrollElementToY(container, targetScrollTop, {
      immediate: options?.immediate ?? false,
      duration: options?.immediate ? 0 : 360,
    });
  }, [anchors.mobileDayTimelineScrollRef, currentTimeMarkerMinute, dayViewTimeline.items, dayViewTimeline.startMinute, dayViewTimeline.totalMinutes]);

  const handleTabSelect = useCallback((tab: AppTab | "more") => {
    const now = Date.now();
    const previousTap = lastTabTapRef.current;
    const isDoubleTap = previousTap && previousTap.key === tab && now - previousTap.at < 360;

    lastTabTapRef.current = { key: tab, at: now };

    if (tab === "more") {
      setMobileMoreOpen(true);
      return;
    }

    if (tab === activeTab) {
      if (isDoubleTap) {
        scrollTabToTop(tab);
      }
      return;
    }

    if (typeof window !== "undefined") {
      tabScrollPositionsRef.current[activeTab] = window.scrollY;
    }
    setMobileMoreOpen(false);
    setActiveTab(tab);
  }, [activeTab, isMobileViewport, setActiveTab]);

  const handleMobileTabSelect = useCallback((tab: AppTab | "more") => {
    handleTabSelect(tab);
  }, [handleTabSelect]);

  const openNotesTab = useCallback(() => {
    setActiveTab("notes");
  }, [setActiveTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("whelm-guided-tabs-v1");
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<Record<AppTab, boolean>>;
      if (parsed && typeof parsed === "object") {
        guidedRevealSeenRef.current = parsed;
      }
    } catch {
      // Ignore invalid or unavailable storage state.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const previousTab = previousActiveTabRef.current;
    const savedTop = tabScrollPositionsRef.current[activeTab];
    const hasSeenGuidedReveal = Boolean(guidedRevealSeenRef.current[activeTab]);
    const shouldGuide = isMobileViewport && savedTop == null && !hasSeenGuidedReveal;

    if (previousTab) {
      tabScrollPositionsRef.current[previousTab] = window.scrollY;
    }
    previousActiveTabRef.current = activeTab;
    dayTimelineMotionRef.current = shouldGuide ? "guide" : "restore";

    const target = shouldGuide ? primaryAnchorForTab(activeTab) : topAnchorForTab(activeTab);
    const timer = window.setTimeout(() => {
      if (savedTop != null) {
        scrollWindowToY(savedTop, { immediate: true });
        return;
      }

      if (shouldGuide) {
        scrollWindowToY(0, { immediate: true });
        if (target) {
          const top = window.scrollY + target.getBoundingClientRect().top;
          scrollWindowToY(top, {
            duration: activeTab === "calendar" ? 760 : 420,
          });
        }
        guidedRevealSeenRef.current[activeTab] = true;
        persistGuidedRevealSeen();
        return;
      }

      scrollWindowToY(0, { immediate: true });
    }, previousTab ? 110 : 180);

    return () => window.clearTimeout(timer);
  }, [activeTab, isMobileViewport]);

  useEffect(() => {
    if (!isMobileViewport || calendarView !== "day") return;
    if (dayTimelineMotionRef.current === "guide" && activeTab === "calendar") {
      const timer = window.setTimeout(() => {
        scrollCalendarTimelineToNow({ guided: true });
      }, 260);
      return () => window.clearTimeout(timer);
    }

    scrollCalendarTimelineToNow({ immediate: true });
  }, [
    activeTab,
    calendarView,
    currentTimeMarkerMinute,
    dayViewTimeline.items,
    dayViewTimeline.startMinute,
    dayViewTimeline.totalMinutes,
    isMobileViewport,
    selectedDateKey,
  ]);

  useEffect(() => {
    return () => {
      cancelActiveMotion();
    };
  }, []);

  return {
    mobileMoreOpen,
    setMobileMoreOpen,
    handleTabSelect,
    handleMobileTabSelect,
    openNotesTab,
    scrollCalendarTimelineToNow,
    scrollToSection,
  };
}
