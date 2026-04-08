"use client";

import { useMemo } from "react";

import { resolveAccessibleCalendarTone, type CalendarTone } from "@/lib/calendar-tones";
import { dayKeyLocal } from "@/lib/date-utils";
import type { SessionDoc } from "@/lib/streak";

type CalendarEntrySource = "plan" | "reminder" | "session";

type CalendarEntry = {
  id: string;
  source: CalendarEntrySource;
  dateKey: string;
  timeLabel: string;
  sortTime: string;
  title: string;
  subtitle: string;
  preview: string;
  tone: "Blue" | "Mint" | "Violet" | CalendarTone;
  startMinute: number;
  endMinute: number;
  isCompleted?: boolean;
  noteId?: string;
  planId?: string;
};

type PlannedBlockLike = {
  id: string;
  dateKey: string;
  title: string;
  note: string;
  tone?: CalendarTone;
  durationMinutes: number;
  timeOfDay: string;
  sortOrder: number;
  createdAtISO: string;
  updatedAtISO: string;
  status: "active" | "completed" | "deleted";
  completedAtISO?: string;
  attachmentCount?: number;
};

type WorkspaceNoteLike = {
  id: string;
  title: string;
  body: string;
  reminderAtISO?: string | null;
};

type DayViewItem = CalendarEntry & {
  durationMinutes: number;
  topPct: number;
  heightPct: number;
  overlapIds: string[];
  col: number;
  totalCols: number;
};

type UseCalendarAgendaOptions = {
  isPro: boolean;
  isMobileViewport: boolean;
  selectedDateKey: string;
  selectedDatePlans: PlannedBlockLike[];
  plannedBlocks: PlannedBlockLike[];
  notes: WorkspaceNoteLike[];
  sessions: SessionDoc[];
  sessionMinutesByDay: Map<string, number>;
  dayTones: Record<string, CalendarTone>;
  proHistoryFreeDays: number;
  isDateKeyBeforeToday: (dateKey: string) => boolean;
  isDateKeyWithinRecentWindow: (dateKey: string, days: number) => boolean;
};

function summarizePlainText(value: string, maxChars = 120) {
  const plain = value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  if (plain.length <= maxChars) return plain;
  return `${plain.slice(0, maxChars - 1).trimEnd()}…`;
}

function stripCompletedBlockPrefix(value: string) {
  return value.replace(/^Planned block completed:\s*/i, "").trim();
}

function completedBlockSessionKey(input: {
  dateKey: string;
  timeOfDay: string;
  durationMinutes: number;
  title: string;
}) {
  return [
    input.dateKey,
    input.timeOfDay || "",
    String(Math.max(0, input.durationMinutes)),
    input.title.trim().toLowerCase(),
  ].join("::");
}

function completedSessionMatchesPlanTitle(sessionTitle: string, planTitle: string) {
  const normalizedSessionTitle = sessionTitle.trim().toLowerCase();
  const normalizedPlanTitle = planTitle.trim().toLowerCase();
  return (
    normalizedSessionTitle === normalizedPlanTitle ||
    normalizedSessionTitle.startsWith(`${normalizedPlanTitle} -`)
  );
}

function normalizeTimeLabel(raw: string) {
  if (!raw) return "Any time";
  const parsed = new Date(`2000-01-01T${raw}:00`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function parseTimeToMinutes(raw: string) {
  const [hh, mm] = raw.split(":").map((part) => Number(part));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 9 * 60;
  return Math.min(24 * 60 - 1, Math.max(0, hh * 60 + mm));
}

function calendarDaySummary({
  dateKey,
  entries,
  plannedBlocks,
  focusedMinutes,
}: {
  dateKey: string;
  entries: CalendarEntry[];
  plannedBlocks: PlannedBlockLike[];
  focusedMinutes: number;
}) {
  const date = new Date(`${dateKey}T00:00:00`);
  const label = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const plansCount = plannedBlocks.length;
  const sessionCount = entries.filter((entry) => entry.source === "session").length;
  const reminderCount = entries.filter((entry) => entry.source === "reminder").length;
  return {
    label,
    eyebrow: "Day Chamber",
    title:
      entries.length === 0
        ? `${label} is still open.`
        : `${label} has ${entries.length} active line${entries.length === 1 ? "" : "s"}.`,
    body:
      plansCount > 0
        ? `${plansCount} planned block${plansCount === 1 ? "" : "s"}, ${focusedMinutes} focused minute${focusedMinutes === 1 ? "" : "s"}, ${reminderCount} reminder${reminderCount === 1 ? "" : "s"}.`
        : sessionCount > 0
          ? `${focusedMinutes} focused minute${focusedMinutes === 1 ? "" : "s"} already logged here. Keep the room in motion.`
          : "No plans or sessions are inside this day yet. Start by placing one deliberate block.",
  };
}

function resolveAgendaTimingState(
  dateKey: string,
  startMinute: number,
  endMinute: number,
  completed?: boolean,
) {
  if (completed) return "completed";
  const todayKey = dayKeyLocal(new Date());
  if (dateKey < todayKey) return "overdue";
  if (dateKey > todayKey) return "upcoming";
  const currentMinute = new Date().getHours() * 60 + new Date().getMinutes();
  if (currentMinute >= startMinute && currentMinute < endMinute) return "now";
  if (currentMinute < startMinute) return "next";
  return "overdue";
}

export function useCalendarAgenda({
  isPro,
  isMobileViewport,
  selectedDateKey,
  selectedDatePlans,
  plannedBlocks,
  notes,
  sessions,
  sessionMinutesByDay,
  dayTones,
  proHistoryFreeDays,
  isDateKeyBeforeToday,
  isDateKeyWithinRecentWindow,
}: UseCalendarAgendaOptions) {
  const selectedDateDayTone = resolveAccessibleCalendarTone(dayTones[selectedDateKey] ?? null, isPro);
  const visiblePlanTone = (tone: CalendarTone | null | undefined) => resolveAccessibleCalendarTone(tone, isPro);
  const { plannedBlockById, plannedBlocksByDate } = useMemo(() => {
    const byId = new Map<string, PlannedBlockLike>();
    const byDate = new Map<string, PlannedBlockLike[]>();

    for (const item of plannedBlocks) {
      byId.set(item.id, item);
      if (item.status === "deleted") continue;
      const list = byDate.get(item.dateKey) ?? [];
      list.push(item);
      byDate.set(item.dateKey, list);
    }

    return {
      plannedBlockById: byId,
      plannedBlocksByDate: byDate,
    };
  }, [plannedBlocks]);

  const selectedDatePlanGroups = useMemo(() => {
    const allForDate = plannedBlocksByDate.get(selectedDateKey) ?? [];
    const active: PlannedBlockLike[] = [];
    const completed: PlannedBlockLike[] = [];
    const incomplete: PlannedBlockLike[] = [];

    for (const item of allForDate) {
      if (item.status === "completed") {
        completed.push(item);
        continue;
      }

      if (isDateKeyBeforeToday(item.dateKey)) {
        incomplete.push(item);
        continue;
      }

      active.push(item);
    }

    return { active, completed, incomplete, visible: [...active, ...completed, ...incomplete] };
  }, [isDateKeyBeforeToday, plannedBlocksByDate, selectedDateKey]);

  const calendarEntriesByDate = useMemo(() => {
    const entries = new Map<string, CalendarEntry[]>();
    const completedPlansBySlot = new Map<string, string[]>();

    function pushEntry(dateKey: string, entry: CalendarEntry) {
      const list = entries.get(dateKey) ?? [];
      list.push(entry);
      entries.set(dateKey, list);
    }

    plannedBlocks.forEach((item) => {
      if (item.status === "deleted") return;
      if (!isPro && !isDateKeyWithinRecentWindow(item.dateKey, proHistoryFreeDays)) return;
      if (item.status === "completed") {
        const slotKey = [item.dateKey, item.timeOfDay || "", String(Math.max(0, item.durationMinutes))].join("::");
        const list = completedPlansBySlot.get(slotKey) ?? [];
        list.push(item.title.trim().toLowerCase());
        completedPlansBySlot.set(slotKey, list);
      }
      const startMinute = parseTimeToMinutes(item.timeOfDay || "09:00");
      const endMinute = Math.min(24 * 60, startMinute + Math.max(10, item.durationMinutes));
      pushEntry(item.dateKey, {
        id: `plan-${item.id}`,
        source: "plan",
        dateKey: item.dateKey,
        timeLabel: normalizeTimeLabel(item.timeOfDay),
        sortTime: item.timeOfDay || "23:59",
        title: item.title,
        subtitle:
          item.status === "completed"
            ? `${item.durationMinutes}m focus block • completed`
            : item.note.trim()
              ? `${item.durationMinutes}m focus block • note added`
              : `${item.durationMinutes}m focus block`,
        preview: item.note.trim()
          ? item.note.trim()
          : item.status === "completed"
            ? `Completed block: ${item.title} (${item.durationMinutes} minutes) at ${normalizeTimeLabel(item.timeOfDay)}.`
            : `Planned block: ${item.title} (${item.durationMinutes} minutes) at ${normalizeTimeLabel(item.timeOfDay)}.`,
        tone: visiblePlanTone(item.tone) ?? "Blue",
        startMinute,
        endMinute,
        isCompleted: item.status === "completed",
        planId: item.id,
      });
    });

    notes.forEach((note) => {
      if (!note.reminderAtISO) return;
      const reminderDate = new Date(note.reminderAtISO);
      if (Number.isNaN(reminderDate.getTime())) return;
      const dateKey = dayKeyLocal(reminderDate);
      const notePreview = summarizePlainText(note.body, 160);
      const startMinute = reminderDate.getHours() * 60 + reminderDate.getMinutes();
      pushEntry(dateKey, {
        id: `note-${note.id}-${dateKey}`,
        source: "reminder",
        dateKey,
        timeLabel: reminderDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        sortTime: `${String(reminderDate.getHours()).padStart(2, "0")}:${String(reminderDate.getMinutes()).padStart(2, "0")}`,
        title: note.title || "Untitled note",
        subtitle: notePreview || "Note reminder",
        preview: notePreview || "Open this note to read the full content.",
        tone: "Mint",
        startMinute,
        endMinute: Math.min(24 * 60, startMinute + 20),
        noteId: note.id,
      });
    });

    sessions.forEach((session, index) => {
      const completed = new Date(session.completedAtISO);
      if (Number.isNaN(completed.getTime())) return;
      const dateKey = dayKeyLocal(completed);
      if (!isPro && !isDateKeyWithinRecentWindow(dateKey, proHistoryFreeDays)) return;
      const strippedNote = session.note?.trim() ? stripCompletedBlockPrefix(session.note.trim()) : "";
      const sortTime = `${String(completed.getHours()).padStart(2, "0")}:${String(completed.getMinutes()).padStart(2, "0")}`;
      const completedPlanTitles = completedPlansBySlot.get(
        [dateKey, sortTime, String(Math.max(0, session.minutes))].join("::"),
      );
      if (
        session.note?.trim() &&
        /^Planned block completed:\s*/i.test(session.note) &&
        completedPlanTitles?.some((planTitle) => completedSessionMatchesPlanTitle(strippedNote, planTitle))
      ) {
        return;
      }
      const sessionLabel =
        session.category === "software"
          ? "Software"
          : session.category === "language"
            ? "Language"
            : "Focus";
      const startMinute = completed.getHours() * 60 + completed.getMinutes();
      const duration = Math.max(15, Math.min(180, session.minutes));
      pushEntry(dateKey, {
        id: `session-${index}-${session.completedAtISO}`,
        source: "session",
        dateKey,
        timeLabel: completed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        sortTime,
        title: session.note?.trim() ? strippedNote : `${sessionLabel} session`,
        subtitle: `${session.minutes}m completed`,
        preview: session.note?.trim()
          ? summarizePlainText(strippedNote, 160)
          : `Completed ${session.minutes} minute ${sessionLabel.toLowerCase()} session.`,
        tone: "Violet",
        startMinute,
        endMinute: Math.min(24 * 60, startMinute + duration),
      });
    });

    entries.forEach((list, dateKey) => {
      entries.set(
        dateKey,
        list.sort((a, b) => {
          if (a.sortTime !== b.sortTime) return a.sortTime.localeCompare(b.sortTime);
          const priority = { plan: 0, reminder: 1, session: 2 } as const;
          return priority[a.source] - priority[b.source];
        }),
      );
    });

    return entries;
  }, [isDateKeyWithinRecentWindow, isPro, notes, plannedBlocks, proHistoryFreeDays, sessions]);

  const selectedDateEntries = useMemo(
    () => calendarEntriesByDate.get(selectedDateKey) ?? [],
    [calendarEntriesByDate, selectedDateKey],
  );
  const selectedDateFocusedMinutes = sessionMinutesByDay.get(selectedDateKey) ?? 0;

  const selectedDateSummary = useMemo(
    () =>
      calendarDaySummary({
        dateKey: selectedDateKey,
        entries: selectedDateEntries,
        plannedBlocks: selectedDatePlanGroups.visible,
        focusedMinutes: selectedDateFocusedMinutes,
      }),
    [selectedDateEntries, selectedDateFocusedMinutes, selectedDateKey, selectedDatePlanGroups.visible],
  );

  const isSelectedDateToday = selectedDateKey === dayKeyLocal(new Date());

  const dayViewTimeline = useMemo(() => {
    const defaultStart = isMobileViewport ? 0 : 6 * 60;
    const defaultEnd = isMobileViewport ? 24 * 60 : 22 * 60;
    const withRange = selectedDateEntries.map((entry) => ({
      ...entry,
      startMinute: Math.min(entry.startMinute, entry.endMinute - 5),
      endMinute: Math.max(entry.endMinute, entry.startMinute + 5),
    }));
    const minStart = withRange.length > 0 ? Math.min(...withRange.map((entry) => entry.startMinute)) : defaultStart;
    const maxEnd = withRange.length > 0 ? Math.max(...withRange.map((entry) => entry.endMinute)) : defaultEnd;
    const startMinute = Math.max(0, Math.min(defaultStart, Math.floor(minStart / 60) * 60));
    const endMinute = Math.min(24 * 60, Math.max(defaultEnd, Math.ceil(maxEnd / 60) * 60));
    const totalMinutes = Math.max(60, endMinute - startMinute);

    const positionedItems = withRange.map((entry) => ({
      ...entry,
      durationMinutes: Math.max(5, entry.endMinute - entry.startMinute),
      topPct: ((entry.startMinute - startMinute) / totalMinutes) * 100,
      heightPct: (Math.max(5, entry.endMinute - entry.startMinute) / totalMinutes) * 100,
    }));

    const hourTicks: Array<{ minute: number; label: string }> = [];
    for (let minute = startMinute; minute <= endMinute; minute += 60) {
      const normalizedMinute = minute % (24 * 60);
      const hour = Math.floor(normalizedMinute / 60);
      const suffix = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 === 0 ? 12 : hour % 12;
      hourTicks.push({ minute, label: `${hour12}:00 ${suffix}` });
    }

    const itemsWithOverlaps = positionedItems.map((item) => {
      const overlapIds = positionedItems
        .filter(
          (candidate) =>
            candidate.id !== item.id &&
            candidate.startMinute < item.endMinute &&
            candidate.endMinute > item.startMinute,
        )
        .map((candidate) => candidate.id);
      return { ...item, overlapIds };
    });

    const colMap = new Map<string, number>();
    const totalColsMap = new Map<string, number>();
    const sorted = [...itemsWithOverlaps].sort(
      (a, b) => a.startMinute - b.startMinute || a.id.localeCompare(b.id),
    );
    sorted.forEach((item) => {
      const usedCols = new Set(
        item.overlapIds
          .map((id) => colMap.get(id))
          .filter((col): col is number => col !== undefined),
      );
      let col = 0;
      while (usedCols.has(col)) col += 1;
      colMap.set(item.id, col);
    });
    itemsWithOverlaps.forEach((item) => {
      const allCols = [colMap.get(item.id) ?? 0, ...item.overlapIds.map((id) => colMap.get(id) ?? 0)];
      totalColsMap.set(item.id, Math.max(...allCols) + 1);
    });

    return {
      startMinute,
      endMinute,
      totalMinutes,
      items: itemsWithOverlaps.map((item) => ({
        ...item,
        col: colMap.get(item.id) ?? 0,
        totalCols: totalColsMap.get(item.id) ?? 1,
      })),
      hourTicks,
    };
  }, [isMobileViewport, selectedDateEntries]);

  const mobileDayTimelineHeight = useMemo(() => {
    const hourCount = Math.max(8, Math.ceil(dayViewTimeline.totalMinutes / 60));
    return hourCount * 72;
  }, [dayViewTimeline.totalMinutes]);

  const currentTimeMarker = useMemo(() => {
    if (selectedDateKey !== dayKeyLocal(new Date())) return null;
    const now = new Date();
    const currentMinute = now.getHours() * 60 + now.getMinutes();
    if (currentMinute < dayViewTimeline.startMinute || currentMinute > dayViewTimeline.endMinute) {
      return null;
    }
    return {
      minute: currentMinute,
      topPct: ((currentMinute - dayViewTimeline.startMinute) / dayViewTimeline.totalMinutes) * 100,
      label: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };
  }, [dayViewTimeline.endMinute, dayViewTimeline.startMinute, dayViewTimeline.totalMinutes, selectedDateKey]);

  const calendarEntryById = useMemo(() => {
    const byId = new Map<string, CalendarEntry>();
    calendarEntriesByDate.forEach((items) => {
      items.forEach((entry) => byId.set(entry.id, entry));
    });
    return byId;
  }, [calendarEntriesByDate]);

  const selectedDateAgendaStateSummary = useMemo(() => {
    const plans = selectedDateEntries.filter((entry) => entry.source === "plan");
    let activeNow: CalendarEntry | null | undefined;
    let nextUp: CalendarEntry | null | undefined;
    let overdueCount = 0;

    for (const entry of plans) {
      const state = resolveAgendaTimingState(
        selectedDateKey,
        entry.startMinute,
        entry.endMinute,
        entry.isCompleted,
      );
      if (state === "now" && !activeNow) activeNow = entry;
      if (state === "next" && !nextUp) nextUp = entry;
      if (state === "overdue") overdueCount += 1;
    }

    return {
      activeNow,
      nextUp,
      overdueCount,
      reminderCount: selectedDateEntries.filter((entry) => entry.source === "reminder").length,
      focusMinutes: selectedDateFocusedMinutes,
    };
  }, [selectedDateEntries, selectedDateFocusedMinutes, selectedDateKey]);

  return {
    selectedDatePlanGroups,
    selectedDateDayTone,
    visiblePlanTone,
    plannedBlockById,
    calendarEntriesByDate,
    selectedDateEntries,
    selectedDateFocusedMinutes,
    selectedDateSummary,
    isSelectedDateToday,
    dayViewTimeline,
    mobileDayTimelineHeight,
    currentTimeMarker,
    calendarEntryById,
    selectedDateAgendaStateSummary,
  };
}
