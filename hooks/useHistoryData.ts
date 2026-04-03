"use client";

import { useCallback, useMemo, useState } from "react";

import { dayKeyLocal } from "@/lib/date-utils";
import type { SessionDoc } from "@/lib/streak";

type SessionHistoryDayGroup = {
  key: string;
  label: string;
  totalMinutes: number;
  items: SessionDoc[];
};

type SessionHistoryWeekGroup = {
  key: string;
  label: string;
  totalMinutes: number;
  days: SessionHistoryDayGroup[];
};

type SessionHistoryMonthGroup = {
  key: string;
  label: string;
  totalMinutes: number;
  weeks: SessionHistoryWeekGroup[];
};

type PlannedBlockLike = {
  id: string;
  dateKey: string;
  title: string;
  note: string;
  durationMinutes: number;
  timeOfDay: string;
  sortOrder: number;
  status: "active" | "completed" | "deleted";
};

type HistorySectionsOpen = {
  completed: boolean;
  incomplete: boolean;
};

type HistoryWindow = "all" | 30 | 90;

type UseHistoryDataOptions = {
  isPro: boolean;
  plannedBlocks: PlannedBlockLike[];
  sessions: SessionDoc[];
  proHistoryFreeDays: number;
  isDateKeyBeforeToday: (dateKey: string) => boolean;
  isDateKeyWithinRecentWindow: (dateKey: string, days: number) => boolean;
  startOfDayLocal: (dateInput?: string | Date) => Date;
  weekStartKeyLocal: (dateInput: string | Date) => string;
  formatHistoryWeekLabel: (dateInput: string | Date) => string;
};

export function useHistoryData({
  isPro,
  plannedBlocks,
  sessions,
  proHistoryFreeDays,
  isDateKeyBeforeToday,
  isDateKeyWithinRecentWindow,
  startOfDayLocal,
  weekStartKeyLocal,
  formatHistoryWeekLabel,
}: UseHistoryDataOptions) {
  const [historySectionsOpen, setHistorySectionsOpen] = useState<HistorySectionsOpen>({
    completed: false,
    incomplete: false,
  });
  const [historyGroupsOpen, setHistoryGroupsOpen] = useState<Record<string, boolean>>({});
  const [historySearch, setHistorySearch] = useState("");
  const [historyWindow, setHistoryWindow] = useState<HistoryWindow>("all");

  const normalizedHistorySearch = historySearch.trim().toLowerCase();

  const historySourceData = useMemo(() => {
    const filteredSessions: SessionDoc[] = [];
    const filteredPlannedBlocks: PlannedBlockLike[] = [];
    let hasLockedBlockHistory = false;

    for (const session of sessions) {
      const sessionDateKey = dayKeyLocal(session.completedAtISO);
      const withinWindow =
        historyWindow === "all" || isDateKeyWithinRecentWindow(sessionDateKey, historyWindow);
      if (!withinWindow) continue;
      if (normalizedHistorySearch) {
        const note = (session.note ?? "").toLowerCase();
        if (!note.includes(normalizedHistorySearch)) continue;
      }
      filteredSessions.push(session);
    }

    for (const item of plannedBlocks) {
      const withinWindow =
        historyWindow === "all" || isDateKeyWithinRecentWindow(item.dateKey, historyWindow);
      if (!withinWindow) continue;
      if (normalizedHistorySearch) {
        const matchesSearch =
          item.title.toLowerCase().includes(normalizedHistorySearch) ||
          item.note.toLowerCase().includes(normalizedHistorySearch);
        if (!matchesSearch) continue;
      }
      if (!isPro && !isDateKeyWithinRecentWindow(item.dateKey, proHistoryFreeDays)) {
        hasLockedBlockHistory = true;
        continue;
      }
      filteredPlannedBlocks.push(item);
    }

    return {
      filteredSessions,
      filteredPlannedBlocks,
      hasLockedBlockHistory,
    };
  }, [
    historyWindow,
    isDateKeyWithinRecentWindow,
    isPro,
    normalizedHistorySearch,
    plannedBlocks,
    proHistoryFreeDays,
    sessions,
  ]);

  const sessionHistoryGroups = useMemo<SessionHistoryMonthGroup[]>(() => {
    const grouped = new Map<
      string,
      {
        monthDate: Date;
        weeks: Map<
          string,
          {
            weekStart: Date;
            days: Map<string, SessionDoc[]>;
          }
        >;
      }
    >();

    for (const session of historySourceData.filteredSessions) {
      const completedAt = new Date(session.completedAtISO);
      const monthKey = `${completedAt.getFullYear()}-${String(completedAt.getMonth() + 1).padStart(2, "0")}`;
      const weekKey = weekStartKeyLocal(completedAt);
      const localDayKey = dayKeyLocal(completedAt);

      if (!grouped.has(monthKey)) {
        grouped.set(monthKey, {
          monthDate: new Date(completedAt.getFullYear(), completedAt.getMonth(), 1),
          weeks: new Map(),
        });
      }

      const monthGroup = grouped.get(monthKey)!;

      if (!monthGroup.weeks.has(weekKey)) {
        monthGroup.weeks.set(weekKey, {
          weekStart: startOfDayLocal(`${weekKey}T00:00:00`),
          days: new Map(),
        });
      }

      const weekGroup = monthGroup.weeks.get(weekKey)!;
      const existingDay = weekGroup.days.get(localDayKey) ?? [];
      existingDay.push(session);
      weekGroup.days.set(localDayKey, existingDay);
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([monthKey, monthGroup]) => {
        const weeks = [...monthGroup.weeks.entries()]
          .sort(([a], [b]) => (a < b ? 1 : -1))
          .map(([weekKey, weekGroup]) => {
            const days = [...weekGroup.days.entries()]
              .sort(([a], [b]) => (a < b ? 1 : -1))
              .map(([dayKey, items]) => ({
                key: `day-${dayKey}`,
                label: new Date(items[0]?.completedAtISO ?? `${dayKey}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                }),
                totalMinutes: items.reduce((sum, item) => sum + item.minutes, 0),
                items: [...items].sort((a, b) => (a.completedAtISO < b.completedAtISO ? 1 : -1)),
              }));

            return {
              key: `week-${weekKey}`,
              label: formatHistoryWeekLabel(weekGroup.weekStart),
              totalMinutes: days.reduce((sum, day) => sum + day.totalMinutes, 0),
              days,
            };
          });

        return {
          key: `month-${monthKey}`,
          label: monthGroup.monthDate.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          }),
          totalMinutes: weeks.reduce((sum, week) => sum + week.totalMinutes, 0),
          weeks,
        };
      });
  }, [
    formatHistoryWeekLabel,
    historySourceData.filteredSessions,
    startOfDayLocal,
    weekStartKeyLocal,
  ]);

  const freeSessionHistoryGroups = useMemo<SessionHistoryMonthGroup[]>(() => {
    return sessionHistoryGroups
      .map((monthGroup) => {
        const weeks = monthGroup.weeks
          .map((weekGroup) => {
            const days = weekGroup.days.filter((dayGroup) =>
              isDateKeyWithinRecentWindow(dayGroup.key.replace(/^day-/, ""), proHistoryFreeDays),
            );

            if (days.length === 0) return null;
            return {
              ...weekGroup,
              totalMinutes: days.reduce((sum, day) => sum + day.totalMinutes, 0),
              days,
            };
          })
          .filter((weekGroup): weekGroup is SessionHistoryWeekGroup => Boolean(weekGroup));

        if (weeks.length === 0) return null;
        return {
          ...monthGroup,
          totalMinutes: weeks.reduce((sum, week) => sum + week.totalMinutes, 0),
          weeks,
        };
      })
      .filter((monthGroup): monthGroup is SessionHistoryMonthGroup => Boolean(monthGroup));
  }, [isDateKeyWithinRecentWindow, proHistoryFreeDays, sessionHistoryGroups]);

  const hasLockedHistoryDays = useMemo(() => {
    const totalDays = sessionHistoryGroups.reduce(
      (sum, monthGroup) =>
        sum +
        monthGroup.weeks.reduce(
          (weekSum, weekGroup) =>
            weekSum +
            weekGroup.days.filter(
              (dayGroup) =>
                !isDateKeyWithinRecentWindow(dayGroup.key.replace(/^day-/, ""), proHistoryFreeDays),
            ).length,
          0,
        ),
      0,
    );
    return totalDays > 0;
  }, [isDateKeyWithinRecentWindow, proHistoryFreeDays, sessionHistoryGroups]);

  const plannedBlockHistory = useMemo(() => {
    const sorted = [...historySourceData.filteredPlannedBlocks]
      .sort((a, b) => {
        if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);
        return a.timeOfDay.localeCompare(b.timeOfDay);
      });
    return {
      completed: sorted.filter((item) => item.status === "completed"),
      incomplete: sorted.filter((item) => item.status === "active" && isDateKeyBeforeToday(item.dateKey)),
    };
  }, [historySourceData.filteredPlannedBlocks, isDateKeyBeforeToday]);

  const hasLockedBlockHistory = isPro ? false : historySourceData.hasLockedBlockHistory;

  const toggleHistorySection = useCallback((key: keyof HistorySectionsOpen) => {
    setHistorySectionsOpen((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  const toggleHistoryGroup = useCallback((key: string) => {
    setHistoryGroupsOpen((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  return {
    historySearch,
    setHistorySearch,
    historyWindow,
    setHistoryWindow,
    historySectionsOpen,
    historyGroupsOpen,
    sessionHistoryGroups,
    freeSessionHistoryGroups,
    hasLockedHistoryDays,
    plannedBlockHistory,
    hasLockedBlockHistory,
    toggleHistorySection,
    toggleHistoryGroup,
  };
}
