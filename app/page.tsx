"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useRive } from "@rive-app/react-canvas";
import {
  EmailAuthProvider,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signOut,
  type User,
} from "firebase/auth";

import SenseiFigure, { type SenseiVariant } from "@/components/SenseiFigure";
import Timer, { type TimerSessionContext } from "@/components/Timer";
import WhelmEmote from "@/components/WhelmEmote";
import WhelmRitualScene from "@/components/WhelmRitualScene";
import {
  trackAppOpened,
  trackSessionAbandoned,
  trackSessionCompleted,
  trackSessionStarted,
  trackStreakUpdated,
  trackTaskCompleted,
  trackTaskCreated,
} from "@/lib/analytics-tracker";
import { auth } from "@/lib/firebase";
import {
  loadNotes,
  retryNotesSync,
  saveNotes,
  type WorkspaceNote,
} from "@/lib/notes-store";
import { loadSessions, saveSession } from "@/lib/session-store";
import {
  computeHistoricalStreaks,
  computeStreak,
  computeStreakEndingAtDateKey,
  type SessionDoc,
} from "@/lib/streak";
import {
  getProState,
  restoreFreeTier,
  startProPreview,
} from "@/lib/subscription";
import {
  getScreenTimeCapability,
  openScreenTimeSystemSettings,
  requestScreenTimeAuthorization,
  type ScreenTimeAuthorizationStatus,
} from "@/lib/screentime";
import {
  buildSenseiCompanionState,
  type SenseiCompanionStyle,
} from "@/lib/sensei-companion";
import { evaluateSessionQuality } from "@/lib/session-quality";
import { getStreakBandanaTier, STREAK_BANDANA_TIERS } from "@/lib/streak-bandanas";
import { buildPerformanceNotificationPlan } from "@/lib/performance-notifications";
import type { WhelmEmoteId } from "@/lib/whelm-emotes";
import styles from "./page.module.css";

const FOCUS_TIMER = {
  title: "Multipurpose focus timer",
  actionLabel: "Save Session",
  badgeLabel: "Focus",
  theme: {
    accent: "#145da0",
    accentSoft: "#e7f1fc",
    accentStrong: "#0d3b66",
    ring: "rgba(108, 92, 231, 0.16)",
  },
};

const LANDING_WISDOM_ROTATION = [
  {
    title: "Marcus Aurelius would begin before complaint.",
    body: "What begins scattered usually stays scattered. Give the first clean block to the work that matters most before mood starts negotiating.",
    signatureLine: "Marcus Aurelius: the task in front of you is enough.",
  },
  {
    title: "Confucius would call this rectifying the room.",
    body: "Discipline is stronger when the path is already clear. Prepare the desk, the tab, and the task before you begin.",
    signatureLine: "Confucius: order outside helps order within.",
  },
  {
    title: "Seneca would distrust grand intentions without proof.",
    body: "Do not wait for a perfect wave of energy. Finish one meaningful piece, then let progress pull you forward.",
    signatureLine: "Seneca: lost time is usually surrendered in fragments.",
  },
  {
    title: "Laozi would reduce before he adds.",
    body: "Let fewer things through. A focused day is often just a day with fewer unnecessary openings.",
    signatureLine: "Laozi: to gain clarity, subtract what is needless.",
  },
  {
    title: "Epictetus would ask what still remains in your control.",
    body: "The danger is rarely the interruption itself. The danger is drifting after it. Re-entry is a skill.",
    signatureLine: "Epictetus: reclaim the next action before the mood takes the room.",
  },
  {
    title: "Aristotle would call depth a trained habit.",
    body: "You do not need a dramatic sprint every hour. You need enough calm pressure to stay with the work until it yields.",
    signatureLine: "Aristotle: what you repeat becomes part of you.",
  },
];

const NOTE_COLORS: Array<{ label: string; value: string }> = [
  { label: "Porcelain", value: "#f8fafc" },
  { label: "Cloud", value: "#f1f5f9" },
  { label: "Mist", value: "#e2e8f0" },
  { label: "Stone", value: "#e7e5e4" },
  { label: "Sand", value: "#f5e6c8" },
  { label: "Blush", value: "#ffe4e6" },
  { label: "Rose", value: "#fecdd3" },
  { label: "Cherry", value: "#fecaca" },
  { label: "Apricot", value: "#fed7aa" },
  { label: "Amber", value: "#fde68a" },
  { label: "Lemon", value: "#fef3c7" },
  { label: "Lime", value: "#d9f99d" },
  { label: "Mint", value: "#bbf7d0" },
  { label: "Seafoam", value: "#ccfbf1" },
  { label: "Aqua", value: "#a5f3fc" },
  { label: "Sky", value: "#bae6fd" },
  { label: "Glacier", value: "#dbeafe" },
  { label: "Periwinkle", value: "#c7d2fe" },
  { label: "Lavender", value: "#ddd6fe" },
  { label: "Orchid", value: "#f5d0fe" },
];

const NOTE_FONTS = [
  { label: "Avenir", value: "Avenir Next, Avenir, sans-serif" },
  { label: "Fraunces", value: "Georgia, Times New Roman, serif" },
  { label: "Editorial", value: "Baskerville, Georgia, serif" },
  { label: "Modern Sans", value: "Trebuchet MS, Helvetica Neue, sans-serif" },
  { label: "System", value: "SF Pro Text, Helvetica Neue, Arial, sans-serif" },
  { label: "Mono", value: "Courier New, Menlo, monospace" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Palatino", value: "Palatino, Book Antiqua, serif" },
] as const;

const NOTE_FONT_SIZES = [
  { label: "Small", value: 14, command: "3" },
  { label: "Normal", value: 16, command: "4" },
  { label: "Large", value: 18, command: "5" },
  { label: "XL", value: 22, command: "6" },
] as const;

const NOTE_TEXT_COLORS = [
  { label: "Ink", value: "#102033" },
  { label: "Slate", value: "#334155" },
  { label: "Ocean", value: "#145da0" },
  { label: "Royal", value: "#1d4ed8" },
  { label: "Violet", value: "#6d28d9" },
  { label: "Rosewood", value: "#9f1239" },
  { label: "Forest", value: "#166534" },
  { label: "Amber", value: "#b45309" },
  { label: "Crimson", value: "#b91c1c" },
  { label: "Charcoal", value: "#111827" },
] as const;

const NOTE_HIGHLIGHTS = [
  { label: "Sun", value: "#fef08a" },
  { label: "Peach", value: "#fed7aa" },
  { label: "Mint", value: "#bbf7d0" },
  { label: "Sky", value: "#bae6fd" },
  { label: "Lavender", value: "#ddd6fe" },
  { label: "Rose", value: "#fecdd3" },
] as const;

const MIN_PLANNED_BLOCK_MINUTES = 15;
const MAX_PLANNED_BLOCK_MINUTES = 240;
const MIN_PLANNED_BLOCK_GAP_MINUTES = 15;
const STREAK_SAVE_ACCOUNTABILITY_QUESTIONS = [
  "What specific symptoms or condition made yesterday unrealistic?",
  "What would have made you push through anyway if this had been non-negotiable?",
  "What evidence tells you this was a real sick day instead of drift or avoidance?",
  "What are you doing today to make sure the streak returns to normal behavior?",
  "What is the exact first block you will complete today to justify protecting the run?",
] as const;

type FeedbackCategory = "bug" | "feature" | "other";
type TrendRange = 7 | 30 | 90;
type CalendarView = "month" | "day";
type ThemeMode = "dark" | "light";
type DailyRitualBlockDraft = {
  id: string;
  existingBlockId?: string;
  title: string;
  note: string;
  timeOfDay: string;
  durationMinutes: number;
};
type AppTab =
  | "today"
  | "calendar"
  | "notes"
  | "streaks"
  | "history"
  | "reports"
  | "settings";
type NoteCategory = "personal" | "school" | "work";
type InsightMetric = "focus" | "notes" | "planned" | "reminders";
type SenseiTone = "steady" | "nudge" | "momentum" | "milestone";
type AnalyticsInsightTone = "positive" | "neutral" | "warning";

type AnalyticsInsight = {
  type: string;
  tone: AnalyticsInsightTone;
  title: string;
  body: string;
};

type AnalyticsWeeklySummary = {
  daysCaptured: number;
  activeDays: number;
  totals: {
    focusMinutes: number;
    sessionsStarted: number;
    sessionsCompleted: number;
    sessionsAbandoned: number;
    tasksCompleted: number;
  };
  averages: {
    dailyPerformanceScore: number;
    completionRate: number;
    completedSessionLength: number;
    sessionQualityScore: number | null;
  };
  performanceBands: {
    high: number;
    steady: number;
    recovery: number;
  };
  streak: {
    active: boolean;
    longestAtEndOfDay: number;
  };
  subjectBreakdown: Record<
    "language" | "school" | "work" | "general",
    { focusMinutes: number; sessionsCompleted: number; tasksCompleted: number }
  >;
  days: Array<{
    dateLocal: string;
    dailyPerformanceScore: number;
    dailyPerformanceBand: "high" | "steady" | "recovery";
    focusMinutes: number;
    sessionCompletionRate: number;
  }>;
};

type AnalyticsDailySummary = {
  dateLocal: string;
  dailyPerformanceScore: number;
  dailyPerformanceBand: "high" | "steady" | "recovery";
  sessionCompletionRate: number;
  focusMinutes: number;
  sessionsAbandoned: number;
  taskCompletedCount: number;
  averageSessionQualityScore: number | null;
};

type BestFocusHour = {
  hour: number;
  focusMinutes: number;
  completedSessions: number;
  sharePercent: number;
  averageSessionLength: number;
};

type BestFocusHoursSummary = {
  bestWindow: {
    startHour: number;
    endHour: number;
    label: string;
    focusMinutes: number;
    sharePercent: number;
  } | null;
  hours: BestFocusHour[];
};

type CalendarDay = {
  label: string;
  dateKey: string;
  minutes: number;
  level: 0 | 1 | 2 | 3;
};

type MonthCell = {
  key: string;
  dayNumber: number | null;
  minutes: number;
  level: 0 | 1 | 2 | 3;
  isCurrentMonth: boolean;
};

type StreakMonthCell = {
  key: string;
  dateKey: string | null;
  dayNumber: number | null;
  isCurrentMonth: boolean;
  isToday: boolean;
  streakLength: number;
  streakTierColor: string | null;
  hasSession: boolean;
  isSaved: boolean;
  leftConnected: boolean;
  rightConnected: boolean;
};

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
  tone: "Blue" | "Mint" | "Violet";
  startMinute: number;
  endMinute: number;
  noteId?: string;
  planId?: string;
};

type TrendPoint = {
  label: string;
  minutes: number;
};

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

type PlannedBlock = {
  id: string;
  dateKey: string;
  title: string;
  note: string;
  durationMinutes: number;
  timeOfDay: string;
  sortOrder: number;
  createdAtISO: string;
  status: "active" | "completed";
  completedAtISO?: string;
};

type KpiDetailKey =
  | "totalFocus"
  | "totalSessions"
  | "averageSession"
  | "bestDay"
  | "weeklyProgress";

type SickDaySave = {
  id: string;
  dateKey: string;
  claimedAtISO: string;
  reason: "sick";
};

const INSIGHT_CATEGORY_META: Record<
  NoteCategory,
  { label: string; color: string; description: string }
> = {
  personal: {
    label: "Personal",
    color: "#4f9cf9",
    description: "Lifestyle, habits, and self notes",
  },
  school: {
    label: "School",
    color: "#2cc9a5",
    description: "Classes, study, assignments, and exams",
  },
  work: {
    label: "Work",
    color: "#ffaf45",
    description: "Projects, clients, meetings, and delivery",
  },
};

function createNote(): WorkspaceNote {
  const now = new Date().toISOString();
  return {
    id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`,
    title: "Untitled note",
    body: "",
    color: "#e7e5e4",
    isPinned: false,
    fontFamily: "Avenir Next",
    fontSizePx: 16,
    category: "personal",
    reminderAtISO: "",
    createdAtISO: now,
    updatedAtISO: now,
  };
}

function decodeHtmlEntities(value: string) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function normalizeBodyForEditor(body: string) {
  if (!body) return "";

  let next = body;
  const hasHtmlTags = /<[a-z!/]/i.test(next);
  if (!hasHtmlTags) {
    next = next.replaceAll("\n", "<br/>");
  }

  for (let i = 0; i < 3; i += 1) {
    const decoded = decodeHtmlEntities(next);
    if (decoded === next) break;
    next = decoded;
  }

  return next;
}

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

function dayKeyLocal(dateInput: string | Date) {
  const value = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDayLocal(dateInput: string | Date) {
  const value = typeof dateInput === "string" ? new Date(dateInput) : new Date(dateInput);
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDaysLocal(dateInput: string | Date, days: number) {
  const value = startOfDayLocal(dateInput);
  value.setDate(value.getDate() + days);
  return value;
}

function weekStartKeyLocal(dateInput: string | Date) {
  const value = startOfDayLocal(dateInput);
  const day = value.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + mondayOffset);
  return dayKeyLocal(value);
}

function formatHistoryWeekLabel(dateInput: string | Date) {
  const start = startOfDayLocal(dateInput);
  const end = addDaysLocal(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameMonth && sameYear) {
    return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(undefined, { day: "numeric" })}`;
  }

  if (sameYear) {
    return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }

  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} - ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function formatAnalyticsWindowLabel(startHour: number, endHour: number) {
  const formatHour = (hour: number) => {
    const normalized = hour === 24 ? 12 : hour % 12 === 0 ? 12 : hour % 12;
    const suffix = hour >= 12 && hour < 24 ? "PM" : "AM";
    return `${normalized} ${suffix}`;
  };

  return `${formatHour(startHour)} to ${formatHour(endHour)}`;
}

function formatHourLabel(hour: number) {
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${normalized}${suffix}`;
}

function monthInputFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMonthInput(value: string) {
  const [yearRaw, monthRaw] = value.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex)) return null;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return new Date(year, monthIndex, 1);
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
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

function getPlannedBlockDurationError(minutes: number) {
  if (!Number.isFinite(minutes)) {
    return "Enter a real duration in minutes.";
  }
  if (minutes < MIN_PLANNED_BLOCK_MINUTES) {
    return `Blocks must be at least ${MIN_PLANNED_BLOCK_MINUTES} minutes.`;
  }
  if (minutes > MAX_PLANNED_BLOCK_MINUTES) {
    return `Keep blocks at ${MAX_PLANNED_BLOCK_MINUTES} minutes or less.`;
  }
  return null;
}

function buildBlockSpacingMessage(conflicts: PlannedBlock[]) {
  if (conflicts.length === 0) return "";
  if (conflicts.length === 1) {
    const block = conflicts[0];
    return `Blocks need at least ${MIN_PLANNED_BLOCK_GAP_MINUTES} minutes between them. This is too close to "${block?.title}" at ${normalizeTimeLabel(block?.timeOfDay || "09:00")}.`;
  }
  return `Blocks need at least ${MIN_PLANNED_BLOCK_GAP_MINUTES} minutes between them. This placement is too close to ${conflicts.length} existing blocks.`;
}

function findPlanSpacingConflicts(
  items: PlannedBlock[],
  candidate: {
    dateKey: string;
    timeOfDay: string;
    durationMinutes: number;
    excludeId?: string;
  },
) {
  const nextStartMinute = parseTimeToMinutes(candidate.timeOfDay || "09:00");
  const nextEndMinute = Math.min(
    24 * 60,
    nextStartMinute + Math.max(MIN_PLANNED_BLOCK_MINUTES, candidate.durationMinutes),
  );

  return items.filter((item) => {
    if (item.id === candidate.excludeId) return false;
    if (item.dateKey !== candidate.dateKey) return false;
    if (item.status !== "active") return false;
    const startMinute = parseTimeToMinutes(item.timeOfDay || "09:00");
    const endMinute = Math.min(
      24 * 60,
      startMinute + Math.max(MIN_PLANNED_BLOCK_MINUTES, item.durationMinutes),
    );
    return (
      nextStartMinute < endMinute + MIN_PLANNED_BLOCK_GAP_MINUTES &&
      nextEndMinute + MIN_PLANNED_BLOCK_GAP_MINUTES > startMinute
    );
  });
}

function isDateKeyBeforeToday(dateKey: string) {
  return dateKey < dayKeyLocal(new Date());
}

function buildNextBandanaMilestone(streak: number, countsTodayIfEarnedNow = false) {
  const nextTier = STREAK_BANDANA_TIERS.find((tier) => streak < tier.minDays) ?? null;
  if (!nextTier) return null;

  const remainingDays = nextTier.minDays - streak;
  const daysUntilTarget = Math.max(0, remainingDays - (countsTodayIfEarnedNow ? 1 : 0));
  const targetDate = addDays(startOfDayLocal(new Date()), daysUntilTarget);

  return {
    tier: nextTier,
    remainingDays,
    targetDate,
  };
}

function countSessionsForDate(sessions: SessionDoc[], dateKey: string) {
  return sessions.filter((session) => dayKeyLocal(session.completedAtISO) === dateKey).length;
}

function greetingForDate(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function milestoneForStreak(streak: number) {
  const checkpoints = [7, 30, 100, 365];
  const next = checkpoints.find((checkpoint) => streak < checkpoint) ?? null;
  return next
    ? { next, remaining: Math.max(0, next - streak) }
    : { next: null, remaining: 0 };
}

function buildSenseiGuidance({
  date,
  todaySessions,
  todayMinutes,
  streak,
  dueReminders,
  plannedTodayCount,
}: {
  date: Date;
  todaySessions: number;
  todayMinutes: number;
  streak: number;
  dueReminders: number;
  plannedTodayCount: number;
}) {
  const greeting = `${greetingForDate(date)}.`;
  const milestone = milestoneForStreak(streak);

  if (milestone.next && milestone.remaining <= 1 && streak > 0) {
    return {
      tone: "milestone" as const,
      variant: "applause" as const,
      eyebrow: "Whelm",
      title: `${greeting} One more day to reach ${milestone.next}.`,
      body: "Protect the streak with one deliberate session. The next mark is already in sight.",
    };
  }

  if (todaySessions === 0) {
    return {
      tone: "nudge" as const,
      variant: date.getHours() >= 17 ? ("stressed" as const) : ("wave" as const),
      eyebrow: "Daily Return",
      title: `${greeting} Your training has not begun yet.`,
      body:
        plannedTodayCount > 0
          ? `You already set ${plannedTodayCount} planned block${plannedTodayCount === 1 ? "" : "s"} for today. Begin with the first one.`
          : "Start with a single focused block. Momentum does not need noise, only action.",
    };
  }

  if (todaySessions >= 3 || todayMinutes >= 90) {
    if (date.getHours() >= 20) {
      return {
        tone: "momentum" as const,
        variant: "rest" as const,
        eyebrow: "Recovery",
        title: `${greeting} You have earned a softer landing.`,
        body:
          dueReminders > 0
            ? `Close out ${dueReminders} reminder${dueReminders === 1 ? "" : "s"} cleanly, then let the day end on purpose.`
            : "You did the work already. Protect tomorrow by winding down instead of chasing noise.",
      };
    }

    return {
      tone: "momentum" as const,
      variant: "victory" as const,
      eyebrow: "Momentum",
      title: `${greeting} Your focus is sharpening.`,
      body:
        dueReminders > 0
          ? `You already showed up today. Finish strong and clear ${dueReminders} reminder${dueReminders === 1 ? "" : "s"} before you close the day.`
          : "You have already proven discipline today. Protect the pace and avoid careless context-switching.",
    };
  }

  return {
    tone: "steady" as const,
    variant: date.getHours() < 11 ? ("scholar" as const) : ("anchor" as const),
    eyebrow: "Whelm",
    title: `${greeting} You have started well.`,
    body:
      streak > 0
        ? `Your ${streak}-day streak remains alive. Add another strong session and leave no doubt about today.`
        : "One completed block changes the shape of the day. Stay with it and build the pattern.",
  };
}

function buildSenseiReaction({
  source,
  minutesSpent,
  todaySessions,
  streak,
}: {
  source: "timer" | "plan";
  minutesSpent: number;
  todaySessions: number;
  streak: number;
}) {
  if (todaySessions >= 3) {
    return "Your focus sharpens. The day is beginning to obey you.";
  }

  if (streak > 0 && [7, 30, 100, 365].includes(streak)) {
    return `A strong mark. ${streak} days of discipline is no accident.`;
  }

  if (source === "plan") {
    return "Good. You honored the plan instead of negotiating with it.";
  }

  if (minutesSpent >= 45) {
    return "Good. That was not a casual effort. Keep the standard there.";
  }

  return "Good. Another step forward.";
}

function calendarDaySenseiVariant({
  entries,
  focusedMinutes,
}: {
  entries: CalendarEntry[];
  focusedMinutes: number;
}): SenseiVariant {
  if (entries.length === 0) return "meditate";
  if (focusedMinutes >= 60) return "victory";
  if (entries.some((entry) => entry.source === "reminder")) return "scholar";
  return "neutral";
}

function formatSenseiLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function calendarDaySummary({
  dateKey,
  entries,
  plannedBlocks,
  focusedMinutes,
}: {
  dateKey: string;
  entries: CalendarEntry[];
  plannedBlocks: PlannedBlock[];
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

function summarizeDisciplineScore({
  todayMinutes,
  todaySessions,
  streak,
  weekMinutes,
}: {
  todayMinutes: number;
  todaySessions: number;
  streak: number;
  weekMinutes: number;
}) {
  const timeScore = Math.min(40, Math.round((todayMinutes / 120) * 40));
  const sessionScore = Math.min(20, todaySessions * 5);
  const streakScore = Math.min(25, Math.round((streak / 30) * 25));
  const consistencyScore = Math.min(15, Math.round((weekMinutes / 420) * 15));
  return Math.min(100, timeScore + sessionScore + streakScore + consistencyScore);
}

function focusLevel(minutes: number): 0 | 1 | 2 | 3 {
  if (minutes === 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 75) return 2;
  return 3;
}

function isHexColor(value: string) {
  return /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(value.trim());
}

function inferCategoryFromText(text: string): NoteCategory {
  const value = text.toLowerCase();
  const schoolKeywords = [
    "study",
    "school",
    "class",
    "exam",
    "quiz",
    "assignment",
    "homework",
    "lecture",
    "course",
    "university",
    "college",
    "lab",
  ];
  const workKeywords = [
    "work",
    "client",
    "project",
    "meeting",
    "deadline",
    "email",
    "report",
    "office",
    "business",
    "proposal",
  ];

  if (schoolKeywords.some((keyword) => value.includes(keyword))) return "school";
  if (workKeywords.some((keyword) => value.includes(keyword))) return "work";
  return "personal";
}

function analyticsSubjectModeFromText(text: string): "language" | "school" | "work" | "general" {
  const lowered = text.toLowerCase();

  if (
    [
      "language",
      "spanish",
      "french",
      "japanese",
      "korean",
      "mandarin",
      "vocabulary",
      "grammar",
    ].some((keyword) => lowered.includes(keyword))
  ) {
    return "language";
  }

  const category = inferCategoryFromText(text);
  if (category === "school") return "school";
  if (category === "work") return "work";
  return "general";
}

type NavIconKey = AppTab | "more";
type ProfileAvatarSize = "compact" | "hero";

type ProfileTierTheme = {
  title: string;
  imagePath: string;
};

function getDailyRitualWaveImagePath(tier: string | null | undefined) {
  switch (tier) {
    case "white":
      return "/waving-intro-whelms/wave-white.png";
    case "black":
      return "/waving-intro-whelms/wave-black.png";
    case "blue":
      return "/waving-intro-whelms/wave-blue.png";
    case "purple":
      return "/waving-intro-whelms/wave-purple.png";
    case "green":
      return "/waving-intro-whelms/wave-green.png";
    case "red":
      return "/waving-intro-whelms/wave-red.png";
    case "yellow":
    default:
      return "/waving-intro-whelms/wave-yellow.png";
  }
}

function WhelmNavIcon({ icon }: { icon: NavIconKey }) {
  const svgProps = {
    viewBox: "0 0 64 64",
    "aria-hidden": true as const,
    className: styles.navIconSvg,
  };

  switch (icon) {
    case "today":
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="todayFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A7F6FF" />
              <stop offset="100%" stopColor="#45D4FF" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="22" fill="url(#todayFill)" opacity="0.24" />
          <circle cx="32" cy="32" r="17.5" fill="none" stroke="#1E86FF" strokeWidth="6" />
          <circle cx="32" cy="32" r="8.5" fill="#83EEFF" stroke="#1E86FF" strokeWidth="3" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="calendarFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A3F4FF" />
              <stop offset="100%" stopColor="#48D0FF" />
            </linearGradient>
          </defs>
          <rect x="9" y="12" width="46" height="42" rx="12" fill="url(#calendarFill)" stroke="#1E86FF" strokeWidth="3.5" />
          <rect x="9" y="20" width="46" height="8" rx="4" fill="#1E86FF" opacity="0.9" />
          <rect x="18" y="8" width="6" height="12" rx="3" fill="#C7FBFF" stroke="#1E86FF" strokeWidth="2" />
          <rect x="40" y="8" width="6" height="12" rx="3" fill="#C7FBFF" stroke="#1E86FF" strokeWidth="2" />
          <line x1="19" y1="35" x2="45" y2="35" stroke="#1E86FF" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="19" y1="44" x2="45" y2="44" stroke="#1E86FF" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
        </svg>
      );
    case "notes":
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="notesFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A5F5FF" />
              <stop offset="100%" stopColor="#4DD5FF" />
            </linearGradient>
          </defs>
          <path d="M17 19h30v28a5 5 0 0 1-5 5H22a5 5 0 0 1-5-5V19Z" fill="url(#notesFill)" stroke="#1E86FF" strokeWidth="3.5" />
          <path d="M24 16h16" stroke="#1E86FF" strokeWidth="4" strokeLinecap="round" />
          <path d="m41 12 10 10" stroke="#1E86FF" strokeWidth="4" strokeLinecap="round" />
          <circle cx="47" cy="18" r="8" fill="#FF6262" stroke="#261318" strokeWidth="3" />
          <path d="M44.5 21.5 33 33" stroke="#261318" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      );
    case "streaks":
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="streakFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8FF2FF" />
              <stop offset="100%" stopColor="#39C6FF" />
            </linearGradient>
          </defs>
          <path
            d="M8 33c8-9 18-11 31-11 8 0 13 2 17 4-1 5-4 9-9 11l-5 2 9 10c-5 2-11 0-15-4l-3-4c-3 4-7 7-13 8 2-6 4-10 5-13l-17 3Z"
            fill="url(#streakFill)"
            stroke="#1388F5"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path d="M16 32c8-4 18-6 28-5" stroke="#D8FFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
        </svg>
      );
    case "history":
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="historyFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A0F2FF" />
              <stop offset="100%" stopColor="#46CCFF" />
            </linearGradient>
          </defs>
          <rect x="10" y="10" width="44" height="44" rx="14" fill="url(#historyFill)" stroke="#1E86FF" strokeWidth="3.5" />
          <circle cx="22" cy="32" r="3.5" fill="none" stroke="#1E86FF" strokeWidth="3" />
          <circle cx="32" cy="32" r="3.5" fill="none" stroke="#1E86FF" strokeWidth="3" />
          <circle cx="42" cy="32" r="3.5" fill="none" stroke="#1E86FF" strokeWidth="3" />
        </svg>
      );
    case "reports":
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="reportsFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9AEFFF" />
              <stop offset="100%" stopColor="#41CBFF" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="22" fill="url(#reportsFill)" stroke="#1E86FF" strokeWidth="3.5" />
          <path d="M32 32V10a22 22 0 0 1 22 22H32Z" fill="#7CE8FF" stroke="#1E86FF" strokeWidth="3" strokeLinejoin="round" />
          <path d="M32 32 16.5 47.5A22 22 0 0 1 10 32h22Z" fill="#5AD9FF" stroke="#1E86FF" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="32" cy="32" r="4" fill="#1E86FF" />
        </svg>
      );
    case "settings":
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="settingsFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#99F0FF" />
              <stop offset="100%" stopColor="#3CCBFF" />
            </linearGradient>
          </defs>
          <path
            d="m32 11 4 2 5-1 4 5 5 2-1 5 2 4-2 4 1 5-5 2-4 5-5-1-4 2-4-2-5 1-4-5-5-2 1-5-2-4 2-4-1-5 5-2 4-5 5 1 4-2Z"
            fill="url(#settingsFill)"
            stroke="#1E86FF"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="32" r="9" fill="#CCFCFF" stroke="#1E86FF" strokeWidth="3.5" />
        </svg>
      );
    case "more":
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="moreFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9EF1FF" />
              <stop offset="100%" stopColor="#44D0FF" />
            </linearGradient>
          </defs>
          <rect x="10" y="10" width="44" height="44" rx="14" fill="url(#moreFill)" stroke="#1E86FF" strokeWidth="3.5" />
          <circle cx="22" cy="32" r="3.5" fill="none" stroke="#1E86FF" strokeWidth="3" />
          <circle cx="32" cy="32" r="3.5" fill="none" stroke="#1E86FF" strokeWidth="3" />
          <circle cx="42" cy="32" r="3.5" fill="none" stroke="#1E86FF" strokeWidth="3" />
        </svg>
      );
  }
}

function iconForTab(tab: AppTab) {
  return <WhelmNavIcon icon={tab} />;
}

function iconForNavKey(tab: NavIconKey) {
  return <WhelmNavIcon icon={tab} />;
}

function getProfileTierTheme(
  tier: string | null | undefined,
  isPro = false,
): ProfileTierTheme {
  switch (tier) {
    case "white":
      return {
        title: "White Ascendant",
        imagePath: isPro
          ? "/profile-tiers/premium_profile_white.PNG"
          : "/profile-tiers/white_profile.PNG",
      };
    case "black":
      return {
        title: "Black Resolve",
        imagePath: isPro
          ? "/profile-tiers/premium_profile_black.PNG"
          : "/profile-tiers/black_profile.PNG",
      };
    case "blue":
      return {
        title: "Blue Voltage",
        imagePath: isPro
          ? "/profile-tiers/premium_profile_blue.PNG"
          : "/profile-tiers/blue_profile.PNG",
      };
    case "purple":
      return {
        title: "Purple Pulse",
        imagePath: isPro
          ? "/profile-tiers/premium_profile_purple.PNG"
          : "/profile-tiers/purple_profile.PNG",
      };
    case "green":
      return {
        title: "Green Current",
        imagePath: isPro
          ? "/profile-tiers/premium_profile_green.PNG"
          : "/profile-tiers/green_profile.PNG",
      };
    case "red":
      return {
        title: "Red Return",
        imagePath: isPro
          ? "/profile-tiers/premium_profile_red.PNG"
          : "/profile-tiers/red_profile.PNG",
      };
    case "yellow":
    default:
      return {
        title: "Yellow Spark",
        imagePath: isPro
          ? "/profile-tiers/premium_profile_yellow.PNG"
          : "/profile-tiers/yellow_profile.PNG",
      };
  }
}

function WhelmProfileAvatar({
  tierColor,
  size,
  isPro = false,
}: {
  tierColor: string | null | undefined;
  size: ProfileAvatarSize;
  isPro?: boolean;
}) {
  const theme = getProfileTierTheme(tierColor, isPro);

  return (
    <div
      className={`${styles.profileAvatarCard} ${
        size === "compact" ? styles.profileAvatarCardCompact : styles.profileAvatarCardHero
      }`}
      aria-hidden="true"
    >
      <img src={theme.imagePath} alt="" className={styles.profileAvatarImage} />
    </div>
  );
}

function tabTitle(tab: AppTab) {
  switch (tab) {
    case "today":
      return "Today";
    case "calendar":
      return "Schedule";
    case "notes":
      return "Notes";
    case "streaks":
      return "Streaks";
    case "history":
      return "History";
    case "reports":
      return "Reports";
    case "settings":
      return "Settings";
  }
}

const BANDANA_WORD_COLORS: Record<string, string> = {
  Yellow: "#ffd84d",
  Red: "#ff5353",
  Green: "#43d96b",
  Purple: "#b477ff",
  Blue: "#58c7ff",
  Black: "#8da0bf",
  White: "#f7fbff",
};

function renderBandanaBadgeLabel(label: string | null | undefined) {
  if (!label) return "Start your streak";
  const [firstWord, ...rest] = label.split(" ");
  const tint = BANDANA_WORD_COLORS[firstWord] ?? "#f7fbff";
  return (
    <>
      <span className={styles.streakBadgeWord} style={{ color: tint }}>
        {firstWord}
      </span>{" "}
      {rest.join(" ")}
    </>
  );
}

function plannedBlocksStorageKey(uid: string) {
  return `whelm:planned-focus:${uid}`;
}

function senseiStyleStorageKey(uid: string) {
  return `whelm:sensei-style:${uid}`;
}

function themeModeStorageKey(uid: string) {
  return `whelm:theme-mode:${uid}`;
}

function sickDaySaveStorageKey(uid: string) {
  return `whelm:sick-day-saves:${uid}`;
}

function sickDaySaveDismissalsStorageKey(uid: string) {
  return `whelm:sick-day-save-dismissals:${uid}`;
}

function clearLocalAccountData(uid: string) {
  window.localStorage.removeItem(`whelm:notes:${uid}`);
  window.localStorage.removeItem(`whelm:sessions:${uid}`);
  window.localStorage.removeItem(plannedBlocksStorageKey(uid));
  window.localStorage.removeItem(senseiStyleStorageKey(uid));
  window.localStorage.removeItem(sickDaySaveStorageKey(uid));
  window.localStorage.removeItem(sickDaySaveDismissalsStorageKey(uid));
  window.localStorage.removeItem("whelm-pro-state-v1");
}

function loadPlannedBlocks(uid: string): PlannedBlock[] {
  try {
    const raw = window.localStorage.getItem(plannedBlocksStorageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PlannedBlock[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item.id && item.dateKey && item.title)
      .map((item) => ({
        id: item.id,
        dateKey: item.dateKey,
        title: String(item.title).slice(0, 80),
        note: String((item as Partial<PlannedBlock>).note || "").slice(0, 280),
        durationMinutes: Math.min(
          MAX_PLANNED_BLOCK_MINUTES,
          Math.max(MIN_PLANNED_BLOCK_MINUTES, Number(item.durationMinutes) || 25),
        ),
        timeOfDay: String(item.timeOfDay || "09:00").slice(0, 5),
        sortOrder: Number((item as Partial<PlannedBlock>).sortOrder) || 0,
        createdAtISO: item.createdAtISO || new Date().toISOString(),
        status: (item.status === "completed" ? "completed" : "active") as PlannedBlock["status"],
        completedAtISO:
          item.status === "completed" && item.completedAtISO ? item.completedAtISO : undefined,
      }))
      .sort((a, b) =>
        a.dateKey === b.dateKey
          ? a.sortOrder - b.sortOrder || a.timeOfDay.localeCompare(b.timeOfDay)
          : a.dateKey.localeCompare(b.dateKey),
      )
      .map((item, index) => ({
        ...item,
        sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
      }));
  } catch {
    return [];
  }
}

function savePlannedBlocks(uid: string, items: PlannedBlock[]) {
  window.localStorage.setItem(plannedBlocksStorageKey(uid), JSON.stringify(items));
}

function loadSickDaySaves(uid: string): SickDaySave[] {
  try {
    const raw = window.localStorage.getItem(sickDaySaveStorageKey(uid));
    const parsed = raw ? (JSON.parse(raw) as SickDaySave[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.dateKey && item.claimedAtISO && item.reason === "sick")
      .sort((a, b) => (a.claimedAtISO < b.claimedAtISO ? 1 : -1));
  } catch {
    return [];
  }
}

function saveSickDaySaves(uid: string, saves: SickDaySave[]) {
  window.localStorage.setItem(sickDaySaveStorageKey(uid), JSON.stringify(saves));
}

function loadSickDaySaveDismissals(uid: string) {
  try {
    const raw = window.localStorage.getItem(sickDaySaveDismissalsStorageKey(uid));
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function saveSickDaySaveDismissals(uid: string, dateKeys: string[]) {
  window.localStorage.setItem(sickDaySaveDismissalsStorageKey(uid), JSON.stringify(dateKeys));
}

function notesShellBackground(themeMode: ThemeMode, noteColor?: string) {
  if (noteColor) return { background: noteColor };
  return themeMode === "dark"
    ? { background: "rgba(18, 22, 40, 0.94)" }
    : { background: "#e7e5e4" };
}

function createDailyRitualDrafts(existing: PlannedBlock[]): DailyRitualBlockDraft[] {
  const seeded: DailyRitualBlockDraft[] = existing
    .slice(0, 3)
    .map((item, index) => ({
      id: `existing-${item.id}-${index}`,
      existingBlockId: item.id,
      title: item.title,
      note: item.note,
      timeOfDay: item.timeOfDay,
      durationMinutes: item.durationMinutes,
    }));

  while (seeded.length < 3) {
    const nextIndex = seeded.length;
    seeded.push({
      id: `new-${nextIndex}`,
      title: "",
      note: "",
      timeOfDay: ["09:00", "13:00", "17:00"][nextIndex] || "09:00",
      durationMinutes: 30,
    });
  }

  return seeded;
}

const DESKTOP_PRIMARY_TABS: Array<{ key: AppTab; label: string }> = [
  { key: "calendar", label: "Schedule" },
  { key: "today", label: "Today" },
  { key: "notes", label: "Notes" },
];

const MOBILE_PRIMARY_TABS: Array<{ key: AppTab | "more"; label: string }> = [
  { key: "calendar", label: "Schedule" },
  { key: "today", label: "Today" },
  { key: "notes", label: "Notes" },
  { key: "more", label: "More" },
];

const MOBILE_MORE_TABS: AppTab[] = ["streaks", "history", "reports", "settings"];

const INTRO_SPLASH_MIN_MS = 1500;
const INTRO_SPLASH_MAX_MS = 2200;
function StreakBandana({
  streakDays,
  className,
}: {
  streakDays: number;
  className?: string;
}) {
  const tier = getStreakBandanaTier(streakDays);
  const { RiveComponent } = useRive({
    src: tier ? `/streak/${tier.assetFile}` : "/streak/moveband.riv",
    autoplay: true,
  });

  return (
    <div
      className={[styles.streakBandanaWrap, className].filter(Boolean).join(" ")}
      aria-hidden="true"
      title={tier?.label}
    >
      <RiveComponent className={styles.streakBandanaRive} />
    </div>
  );
}

function DailyRitualWaveIcon({
  className,
  tierColor,
}: {
  className?: string;
  tierColor: string | null | undefined;
}) {
  return (
    <div className={[styles.dailyRitualWaveIcon, className].filter(Boolean).join(" ")} aria-hidden="true">
      <img
        src={getDailyRitualWaveImagePath(tierColor)}
        alt=""
        className={styles.dailyRitualCornerIconImage}
      />
    </div>
  );
}

function DailyRitualSubmitBandana({ className }: { className?: string }) {
  const { RiveComponent } = useRive({
    src: "/streak/white_bandana_submit.riv",
    autoplay: true,
  });

  return (
    <div className={[styles.dailyRitualSubmitBandanaWrap, className].filter(Boolean).join(" ")} aria-hidden="true">
      <RiveComponent className={styles.dailyRitualSubmitBandanaCanvas} />
    </div>
  );
}

function IntroSplash({ onComplete }: { onComplete: () => void }) {
  return (
    <main className={styles.splashScreen}>
      <div className={styles.splashOrb} aria-hidden="true" />
      <div className={styles.splashFrame}>
        <div className={styles.splashAnimationShell}>
          <div className={styles.splashAnimation}>
            <video
              className={styles.splashVideo}
              autoPlay
              muted
              playsInline
              preload="auto"
              aria-label="Whelm intro animation"
              onEnded={onComplete}
            >
              <source src="/intro/twosecappicon.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
        <p className={styles.splashWordmark}>WHELM</p>
        <p className={styles.splashCaption}>Build momentum before the day gets loud.</p>
      </div>
    </main>
  );
}

function SenseiAvatar({
  message,
  variant,
  compact = false,
  emoteVideoSrc,
  autoPlayEmote = false,
}: {
  message: string;
  variant: SenseiVariant;
  compact?: boolean;
  emoteVideoSrc?: string;
  autoPlayEmote?: boolean;
}) {
  return (
    <SenseiFigure
      variant={variant}
      size={compact ? "inline" : "card"}
      message={message}
      className={compact ? styles.senseiAvatarCompact : styles.senseiAvatarPlacement}
      align={compact ? "right" : "center"}
      emoteVideoSrc={emoteVideoSrc}
      autoPlayEmote={autoPlayEmote}
    />
  );
}

function CompanionPulse({
  eyebrow,
  title,
  body,
  variant,
}: {
  eyebrow: string;
  title: string;
  body: string;
  variant: SenseiVariant;
}) {
  return (
    <article className={styles.companionPulse}>
      <div className={styles.companionPulseFigureWrap}>
        <SenseiFigure variant={variant} size="badge" className={styles.companionPulseFigure} />
      </div>
      <div className={styles.companionPulseSpeech}>
        <div className={styles.companionPulseCopy}>
          <p className={styles.sectionLabel}>{eyebrow}</p>
          <h3 className={styles.companionPulseTitle}>{title}</h3>
          <p className={styles.companionPulseBody}>{body}</p>
        </div>
      </div>
    </article>
  );
}

export default function HomePage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [notes, setNotes] = useState<WorkspaceNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [textColorPickerOpen, setTextColorPickerOpen] = useState(false);
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);
  const [editorBodyDraft, setEditorBodyDraft] = useState("");
  const [notesSyncStatus, setNotesSyncStatus] = useState<
    "synced" | "local-only" | "syncing"
  >("syncing");
  const [notesSyncMessage, setNotesSyncMessage] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [showIntroSplash, setShowIntroSplash] = useState(true);
  const [introFinished, setIntroFinished] = useState(false);
  const [introMinElapsed, setIntroMinElapsed] = useState(false);
  const [landingWisdomMinute, setLandingWisdomMinute] = useState(() => Math.floor(Date.now() / 60000));
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [reportCopyStatus, setReportCopyStatus] = useState("");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsWeeklySummary, setAnalyticsWeeklySummary] = useState<AnalyticsWeeklySummary | null>(null);
  const [analyticsDailySummary, setAnalyticsDailySummary] = useState<AnalyticsDailySummary | null>(null);
  const [analyticsInsights, setAnalyticsInsights] = useState<AnalyticsInsight[]>([]);
  const [analyticsBestHours, setAnalyticsBestHours] = useState<BestFocusHoursSummary | null>(null);
  const [analyticsScoreHistory, setAnalyticsScoreHistory] = useState<
    Array<{
      date: string;
      score: number;
      band: "high" | "steady" | "recovery";
      focusMinutes: number;
      completionRate: number;
    }>
  >([]);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [senseiReaction, setSenseiReaction] = useState("");
  const [companionStyle, setCompanionStyle] = useState<SenseiCompanionStyle>("balanced");
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [themePromptOpen, setThemePromptOpen] = useState(false);
  const [dailyPlanningOpen, setDailyPlanningOpen] = useState(false);
  const [dailyPlanningStatus, setDailyPlanningStatus] = useState("");
  const [dailyRitualDrafts, setDailyRitualDrafts] = useState<DailyRitualBlockDraft[]>(() =>
    createDailyRitualDrafts([]),
  );
  const [dailyRitualExpandedId, setDailyRitualExpandedId] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [proSource, setProSource] = useState<"preview" | "store" | "none">("none");
  const [trendRange, setTrendRange] = useState<TrendRange>(7);
  const [activeTab, setActiveTab] = useState<AppTab>("calendar");
  const [insightRange, setInsightRange] = useState<TrendRange>(30);
  const [insightMetric, setInsightMetric] = useState<InsightMetric>("focus");
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [selectedInsightCategory, setSelectedInsightCategory] = useState<NoteCategory | null>(
    null,
  );
  const [notesSearch, setNotesSearch] = useState("");
  const [notesCategoryFilter, setNotesCategoryFilter] = useState<"all" | NoteCategory>("all");
  const [plannedBlocks, setPlannedBlocks] = useState<PlannedBlock[]>([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [calendarCursor, setCalendarCursor] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [streakCalendarCursor, setStreakCalendarCursor] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarHoverEntryId, setCalendarHoverEntryId] = useState<string | null>(null);
  const [calendarPinnedEntryId, setCalendarPinnedEntryId] = useState<string | null>(null);
  const [calendarAuxPanel, setCalendarAuxPanel] = useState<"agenda" | "streak" | "guide">("agenda");
  const [planTitle, setPlanTitle] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [planNoteExpanded, setPlanNoteExpanded] = useState(false);
  const [planDuration, setPlanDuration] = useState(25);
  const [planTime, setPlanTime] = useState("09:00");
  const [planStatus, setPlanStatus] = useState("");
  const [planConflictWarning, setPlanConflictWarning] = useState<{
    conflictIds: string[];
    message: string;
  } | null>(null);
  const [calendarJumpDate, setCalendarJumpDate] = useState<string>(() => dayKeyLocal(new Date()));
  const [kpiDetailOpen, setKpiDetailOpen] = useState<KpiDetailKey | null>(null);
  const [draggedPlanId, setDraggedPlanId] = useState<string | null>(null);
  const [pendingCalendarEntryFocusId, setPendingCalendarEntryFocusId] = useState<string | null>(null);
  const [activatedCalendarEntryId, setActivatedCalendarEntryId] = useState<string | null>(null);
  const [overlapPickerEntryId, setOverlapPickerEntryId] = useState<string | null>(null);
  const [dayPortalComposerOpen, setDayPortalComposerOpen] = useState(false);
  const [plannerSectionsOpen, setPlannerSectionsOpen] = useState({
    active: false,
    completed: false,
    incomplete: false,
  });
  const [historySectionsOpen, setHistorySectionsOpen] = useState({
    completed: false,
    incomplete: false,
  });
  const [historyGroupsOpen, setHistoryGroupsOpen] = useState<Record<string, boolean>>({});
  const [noteUndoItem, setNoteUndoItem] = useState<WorkspaceNote | null>(null);
  const [deletedPlanUndo, setDeletedPlanUndo] = useState<PlannedBlock | null>(null);
  const [screenTimeStatus, setScreenTimeStatus] =
    useState<ScreenTimeAuthorizationStatus>("unsupported");
  const [screenTimeSupported, setScreenTimeSupported] = useState(false);
  const [screenTimeReason, setScreenTimeReason] = useState("");
  const [screenTimeBusy, setScreenTimeBusy] = useState(false);
  const [accountDangerStatus, setAccountDangerStatus] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [sickDaySaves, setSickDaySaves] = useState<SickDaySave[]>([]);
  const [sickDaySaveDismissals, setSickDaySaveDismissals] = useState<string[]>([]);
  const [sickDaySavePromptOpen, setSickDaySavePromptOpen] = useState(false);
  const [sickDaySavePromptPreview, setSickDaySavePromptPreview] = useState(false);
  const [streakSaveQuestionnaireOpen, setStreakSaveQuestionnaireOpen] = useState(false);
  const [streakSaveQuestionnairePreview, setStreakSaveQuestionnairePreview] = useState(false);
  const [streakSaveAnswers, setStreakSaveAnswers] = useState<Record<string, string>>({});
  const [streakSaveStatus, setStreakSaveStatus] = useState("");
  const [dailyPlanningPreviewOpen, setDailyPlanningPreviewOpen] = useState(false);
  const [mobileNotesRecentOpen, setMobileNotesRecentOpen] = useState(false);
  const [mobileNotesEditorOpen, setMobileNotesEditorOpen] = useState(false);
  const [mobileNotesToolsOpen, setMobileNotesToolsOpen] = useState<
    "format" | "type" | "color" | null
  >(null);
  const [mobileBlockSheetOpen, setMobileBlockSheetOpen] = useState(false);
  const reportsInsightToastRef = useRef<string | null>(null);
  const [mobileCalendarControlsOpen, setMobileCalendarControlsOpen] = useState(false);
  const [mobileAgendaEntriesOpen, setMobileAgendaEntriesOpen] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const syncInFlightRef = useRef(false);
  const todaySummaryRef = useRef<HTMLElement | null>(null);
  const todayTimerRef = useRef<HTMLDivElement | null>(null);
  const todayQueueRef = useRef<HTMLElement | null>(null);
  const calendarHeroRef = useRef<HTMLDivElement | null>(null);
  const calendarMonthRef = useRef<HTMLElement | null>(null);
  const calendarStreakRef = useRef<HTMLElement | null>(null);
  const calendarPlannerRef = useRef<HTMLElement | null>(null);
  const calendarTimelineRef = useRef<HTMLDivElement | null>(null);
  const notesStartRef = useRef<HTMLElement | null>(null);
  const notesRecentRef = useRef<HTMLElement | null>(null);
  const notesEditorRef = useRef<HTMLElement | null>(null);
  const appOpenTrackedRef = useRef<string | null>(null);
  const mobileDayTimelineScrollRef = useRef<HTMLDivElement | null>(null);
  const activatedCalendarEntryTimeoutRef = useRef<number | null>(null);
  const calendarHoverPreviewTimeoutRef = useRef<number | null>(null);

  const protectedStreakDateKeys = useMemo(
    () => sickDaySaves.map((save) => save.dateKey),
    [sickDaySaves],
  );
  const streak = computeStreak(sessions, protectedStreakDateKeys);

  const focusMetrics = useMemo(() => {
    const now = new Date();
    const todayKey = dayKeyLocal(now);
    const todayStart = startOfDayLocal(now);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 29);
    const thisMonthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
    const daysInMonth = new Date(
      todayStart.getFullYear(),
      todayStart.getMonth() + 1,
      0,
    ).getDate();

    let todayMinutes = 0;
    let todaySessions = 0;
    let weekMinutes = 0;
    const byDay = new Map<string, number>();

    for (const session of sessions) {
      const sessionDate = new Date(session.completedAtISO);
      const dayKey = dayKeyLocal(sessionDate);
      byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + session.minutes);

      if (dayKey === todayKey) {
        todayMinutes += session.minutes;
        todaySessions += 1;
      }

      if (sessionDate >= weekStart && sessionDate <= now) {
        weekMinutes += session.minutes;
      }
    }

    let activeDaysInMonth = 0;
    for (let i = 0; i < 30; i += 1) {
      const day = new Date(monthStart);
      day.setDate(monthStart.getDate() + i);
      if ((byDay.get(dayKeyLocal(day)) ?? 0) > 0) {
        activeDaysInMonth += 1;
      }
    }

    const calendar: CalendarDay[] = [];
    for (let i = 27; i >= 0; i -= 1) {
      const day = new Date(todayStart);
      day.setDate(todayStart.getDate() - i);
      const dateKey = dayKeyLocal(day);
      const minutes = byDay.get(dateKey) ?? 0;
      const level: CalendarDay["level"] = focusLevel(minutes);
      calendar.push({
        label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        dateKey,
        minutes,
        level,
      });
    }

    const monthCalendar: MonthCell[] = [];
    const leadingSpaces = thisMonthStart.getDay();
    for (let i = 0; i < leadingSpaces; i += 1) {
      monthCalendar.push({
        key: `leading-${i}`,
        dayNumber: null,
        minutes: 0,
        level: 0,
        isCurrentMonth: false,
      });
    }

    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
      const day = new Date(todayStart.getFullYear(), todayStart.getMonth(), dayNumber);
      const dateKey = dayKeyLocal(day);
      const minutes = byDay.get(dateKey) ?? 0;
      monthCalendar.push({
        key: dateKey,
        dayNumber,
        minutes,
        level: focusLevel(minutes),
        isCurrentMonth: true,
      });
    }

    while (monthCalendar.length < 42) {
      monthCalendar.push({
        key: `trailing-${monthCalendar.length}`,
        dayNumber: null,
        minutes: 0,
        level: 0,
        isCurrentMonth: false,
      });
    }

    function buildTrendPoints(days: number): TrendPoint[] {
      const points: TrendPoint[] = [];
      for (let i = days - 1; i >= 0; i -= 1) {
        const day = new Date(todayStart);
        day.setDate(todayStart.getDate() - i);
        const dateKey = dayKeyLocal(day);
        points.push({
          label:
            days <= 7
              ? day.toLocaleDateString(undefined, { weekday: "short" })
              : day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          minutes: byDay.get(dateKey) ?? 0,
        });
      }
      return points;
    }

    const disciplineScore = summarizeDisciplineScore({
      todayMinutes,
      todaySessions,
      streak,
      weekMinutes,
    });

    return {
      todayMinutes,
      todaySessions,
      weekMinutes,
      activeDaysInMonth,
      disciplineScore,
      calendar,
      monthCalendar,
      trendPoints7: buildTrendPoints(7),
      trendPoints30: buildTrendPoints(30),
      trendPoints90: buildTrendPoints(90),
    };
  }, [sessions, streak]);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  );

  const trendPoints = useMemo(() => {
    if (trendRange === 30) return focusMetrics.trendPoints30;
    if (trendRange === 90) return focusMetrics.trendPoints90;
    return focusMetrics.trendPoints7;
  }, [focusMetrics, trendRange]);

  const orderedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return a.updatedAtISO < b.updatedAtISO ? 1 : -1;
      }),
    [notes],
  );

  const filteredNotes = useMemo(() => {
    const query = notesSearch.trim().toLowerCase();
    return orderedNotes.filter((note) => {
      const categoryMatch =
        notesCategoryFilter === "all" || (note.category || "personal") === notesCategoryFilter;
      const textMatch =
        query.length === 0 ||
        note.title.toLowerCase().includes(query) ||
        note.body.toLowerCase().includes(query);
      return categoryMatch && textMatch;
    });
  }, [notesCategoryFilter, notesSearch, orderedNotes]);

  const dueReminderNotes = useMemo(() => {
    const todayKey = dayKeyLocal(new Date());
    return orderedNotes.filter((note) => {
      if (!note.reminderAtISO) return false;
      return dayKeyLocal(note.reminderAtISO) === todayKey;
    });
  }, [orderedNotes]);

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

    for (const session of sessions) {
      const completedAt = new Date(session.completedAtISO);
      const monthKey = `${completedAt.getFullYear()}-${String(completedAt.getMonth() + 1).padStart(2, "0")}`;
      const weekKey = weekStartKeyLocal(completedAt);
      const dayKey = dayKeyLocal(completedAt);

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
      const existingDay = weekGroup.days.get(dayKey) ?? [];
      existingDay.push(session);
      weekGroup.days.set(dayKey, existingDay);
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
                label: new Date(items[0]?.completedAtISO ?? `${dayKey}T00:00:00`).toLocaleDateString(
                  undefined,
                  {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  },
                ),
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
  }, [sessions]);

  const reportMetrics = useMemo(() => {
    const sessionCount = sessions.length;
    const totalMinutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
    const averageSession = sessionCount === 0 ? 0 : Math.round(totalMinutes / sessionCount);
    const bestTrend = [...trendPoints].sort((a, b) => b.minutes - a.minutes)[0];
    const weeklyTarget = 420;
    const weeklyProgress = Math.min(
      100,
      Math.round((focusMetrics.weekMinutes / weeklyTarget) * 100),
    );
    const plannedCompletionCount = sessions.filter((session) =>
      (session.note || "").startsWith("Planned block completed:"),
    ).length;
    const notesUpdated7d = notes.filter((note) => {
      const updated = new Date(note.updatedAtISO);
      const now = new Date();
      const ms = now.getTime() - updated.getTime();
      return ms <= 7 * 24 * 60 * 60 * 1000;
    }).length;
    const notesWithReminders = notes.filter((note) => Boolean(note.reminderAtISO)).length;

    return {
      sessionCount,
      totalMinutes,
      averageSession,
      bestTrendLabel: bestTrend?.label ?? "N/A",
      bestTrendMinutes: bestTrend?.minutes ?? 0,
      weeklyProgress,
      plannedCompletionCount,
      notesUpdated7d,
      notesWithReminders,
    };
  }, [focusMetrics.weekMinutes, notes, sessions, trendPoints]);

  const analyticsDateRange = useMemo(() => {
    const endDate = dayKeyLocal(new Date());
    const startDate = dayKeyLocal(addDaysLocal(new Date(), -(insightRange - 1)));
    return { startDate, endDate };
  }, [insightRange]);

  const analyticsNotificationPlan = useMemo(() => {
    if (!analyticsDailySummary) return null;
    return buildPerformanceNotificationPlan({
      dailyPerformanceScore: analyticsDailySummary.dailyPerformanceScore,
      dailyPerformanceBand: analyticsDailySummary.dailyPerformanceBand,
      sessionCompletionRate: analyticsDailySummary.sessionCompletionRate,
      sessionsAbandoned: analyticsDailySummary.sessionsAbandoned,
      taskCompletedCount: analyticsDailySummary.taskCompletedCount,
      focusMinutes: analyticsDailySummary.focusMinutes,
      averageSessionQualityScore: analyticsDailySummary.averageSessionQualityScore,
    });
  }, [analyticsDailySummary]);

  useEffect(() => {
    if (!user || activeTab !== "reports") return;

    let cancelled = false;
    const currentUser = user;

    async function fetchAnalyticsJson<T>(path: string) {
      const token = await currentUser.getIdToken();
      const response = await fetch(path, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = (await response.json().catch(() => null)) as T | { error?: string } | null;
      if (!response.ok) {
        throw new Error((body as { error?: string } | null)?.error || "Failed to load analytics.");
      }

      return body as T;
    }

    async function loadAnalytics() {
      setAnalyticsLoading(true);
      setAnalyticsError("");

      try {
        const todayKey = dayKeyLocal(new Date());
        const weekStart = weekStartKeyLocal(new Date());

        const [weeklyPayload, dailyPayload, insightsPayload, bestHoursPayload, scoreHistoryPayload] =
          await Promise.all([
            fetchAnalyticsJson<{ summary: AnalyticsWeeklySummary }>(
              `/api/analytics/weekly-summary?uid=${encodeURIComponent(currentUser.uid)}&weekStart=${encodeURIComponent(weekStart)}`,
            ),
            fetchAnalyticsJson<{ summary: AnalyticsDailySummary | null }>(
              `/api/analytics/daily-summary?uid=${encodeURIComponent(currentUser.uid)}&date=${encodeURIComponent(todayKey)}`,
            ),
            fetchAnalyticsJson<{ insights: AnalyticsInsight[] }>(
              `/api/analytics/insights?uid=${encodeURIComponent(currentUser.uid)}&startDate=${encodeURIComponent(
                analyticsDateRange.startDate,
              )}&endDate=${encodeURIComponent(analyticsDateRange.endDate)}&limit=6`,
            ),
            fetchAnalyticsJson<BestFocusHoursSummary>(
              `/api/analytics/best-focus-hours?uid=${encodeURIComponent(currentUser.uid)}&startDate=${encodeURIComponent(
                analyticsDateRange.startDate,
              )}&endDate=${encodeURIComponent(analyticsDateRange.endDate)}`,
            ),
            fetchAnalyticsJson<{
              history: Array<{
                date: string;
                score: number;
                band: "high" | "steady" | "recovery";
                focusMinutes: number;
                completionRate: number;
              }>;
            }>(
              `/api/analytics/performance-score-history?uid=${encodeURIComponent(
                currentUser.uid,
              )}&startDate=${encodeURIComponent(analyticsDateRange.startDate)}&endDate=${encodeURIComponent(
                analyticsDateRange.endDate,
              )}`,
            ),
          ]);

        if (cancelled) return;

        setAnalyticsWeeklySummary(weeklyPayload.summary);
        setAnalyticsDailySummary(dailyPayload.summary);
        setAnalyticsInsights(insightsPayload.insights);
        setAnalyticsBestHours(bestHoursPayload);
        setAnalyticsScoreHistory(scoreHistoryPayload.history);
      } catch (error: unknown) {
        if (cancelled) return;
        setAnalyticsError(error instanceof Error ? error.message : "Failed to load reports.");
      } finally {
        if (!cancelled) {
          setAnalyticsLoading(false);
        }
      }
    }

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [activeTab, analyticsDateRange.endDate, analyticsDateRange.startDate, user]);

  useEffect(() => {
    if (activeTab !== "reports") return;
    const topInsight = analyticsInsights[0];
    if (!topInsight) return;
    if (reportsInsightToastRef.current === topInsight.title) return;
    reportsInsightToastRef.current = topInsight.title;
    setSenseiReaction(topInsight.body);
  }, [activeTab, analyticsInsights]);

  const todayPlannedBlocks = useMemo(
    () => plannedBlocks.filter((item) => item.dateKey === dayKeyLocal(new Date())),
    [plannedBlocks],
  );
  const todayActivePlannedBlocks = useMemo(
    () => todayPlannedBlocks.filter((item) => item.status === "active"),
    [todayPlannedBlocks],
  );
  const claimedBlocksToday = useMemo(
    () => todayPlannedBlocks.filter((item) => item.durationMinutes >= 15),
    [todayPlannedBlocks],
  );
  const dailyPlanningLocked = claimedBlocksToday.length < 3;

  const averageSessionStartHour = useMemo(() => {
    const recentSessions = sessions.slice(0, 14);
    if (recentSessions.length === 0) return null;
    const total = recentSessions.reduce((sum, session) => {
      const date = new Date(session.completedAtISO);
      return sum + date.getHours() + date.getMinutes() / 60;
    }, 0);
    return total / recentSessions.length;
  }, [sessions]);

  const lastSessionHoursAgo = useMemo(() => {
    const iso = sessions[0]?.completedAtISO;
    if (!iso) return null;
    const ms = Date.now() - new Date(iso).getTime();
    return Math.max(0, ms / (1000 * 60 * 60));
  }, [sessions]);

  const comebackDaysAway = useMemo(() => {
    const todayKey = dayKeyLocal(new Date());
    const previousDayKeys = [...new Set(sessions.map((session) => dayKeyLocal(session.completedAtISO)))].filter(
      (key) => key !== todayKey,
    );
    if (focusMetrics.todaySessions === 0 || previousDayKeys.length === 0) return 0;
    const previous = previousDayKeys[0];
    const today = startOfDayLocal(new Date());
    const prior = startOfDayLocal(new Date(`${previous}T00:00:00`));
    const days = Math.round((today.getTime() - prior.getTime()) / (1000 * 60 * 60 * 24)) - 1;
    return Math.max(0, days);
  }, [focusMetrics.todaySessions, sessions]);

  const missedYesterday = useMemo(
    () => focusMetrics.todaySessions === 0 && lastSessionHoursAgo !== null && lastSessionHoursAgo >= 24,
    [focusMetrics.todaySessions, lastSessionHoursAgo],
  );

  const nextSenseiMilestone = useMemo(() => milestoneForStreak(streak), [streak]);
  const senseiActiveTab = activeTab === "streaks" ? "reports" : activeTab;

  const companionState = useMemo(
    () =>
      buildSenseiCompanionState({
        now: new Date(),
        activeTab: senseiActiveTab,
        totalSessions: reportMetrics.sessionCount,
        totalMinutes: reportMetrics.totalMinutes,
        todaySessions: focusMetrics.todaySessions,
        todayMinutes: focusMetrics.todayMinutes,
        weekMinutes: focusMetrics.weekMinutes,
        streak,
        dueReminders: dueReminderNotes.length,
        plannedTodayCount: todayActivePlannedBlocks.length,
        notesCount: notes.length,
        notesUpdated7d: reportMetrics.notesUpdated7d,
        nextMilestone: nextSenseiMilestone.next,
        nextMilestoneRemaining: nextSenseiMilestone.remaining,
        averageStartHour: averageSessionStartHour,
        lastSessionHoursAgo,
        comebackDaysAway,
        missedYesterday,
        companionStyle,
      }),
    [
      averageSessionStartHour,
      comebackDaysAway,
      companionStyle,
      dueReminderNotes.length,
      focusMetrics.weekMinutes,
      focusMetrics.todayMinutes,
      focusMetrics.todaySessions,
      lastSessionHoursAgo,
      missedYesterday,
      nextSenseiMilestone.next,
      nextSenseiMilestone.remaining,
      notes.length,
      reportMetrics.notesUpdated7d,
      reportMetrics.sessionCount,
      reportMetrics.totalMinutes,
      senseiActiveTab,
      streak,
      todayActivePlannedBlocks.length,
    ],
  );

  const senseiGuidance = companionState.hero;
  const landingWisdom = useMemo(() => {
    return LANDING_WISDOM_ROTATION[landingWisdomMinute % LANDING_WISDOM_ROTATION.length];
  }, [landingWisdomMinute]);
  const todayHeroCopy =
    activeTab === "today"
      ? {
          ...senseiGuidance,
          title: landingWisdom.title,
          body: landingWisdom.body,
          signatureLine: landingWisdom.signatureLine,
        }
      : senseiGuidance;

  const insightsChart = useMemo(() => {
    const windowDays = insightRange;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (windowDays - 1));

    const values: Record<NoteCategory, number> = {
      personal: 0,
      school: 0,
      work: 0,
    };
    const colorWeights: Record<NoteCategory, Record<string, number>> = {
      personal: {},
      school: {},
      work: {},
    };

    const inRange = (iso: string) => {
      if (!iso) return false;
      const value = new Date(iso);
      return value >= start && value <= end;
    };

    const addColorWeight = (category: NoteCategory, color: string, weight = 1) => {
      const fallback = INSIGHT_CATEGORY_META[category].color;
      const next = isHexColor(color) ? color : fallback;
      colorWeights[category][next] = (colorWeights[category][next] || 0) + weight;
    };

    notes.forEach((note) => {
      const category = note.category || "personal";
      const colorSourceDate = insightMetric === "reminders" ? note.reminderAtISO : note.updatedAtISO;
      if (!inRange(colorSourceDate)) return;
      addColorWeight(category, note.color || INSIGHT_CATEGORY_META[category].color);
    });

    if (insightMetric === "notes") {
      notes.forEach((note) => {
        if (!inRange(note.updatedAtISO)) return;
        const category = note.category || "personal";
        values[category] += 1;
      });
    } else if (insightMetric === "focus") {
      sessions.forEach((session) => {
        if (!inRange(session.completedAtISO)) return;
        const category = inferCategoryFromText(session.note || "");
        values[category] += session.minutes;
      });
    } else if (insightMetric === "planned") {
      plannedBlocks.forEach((item) => {
        if (!inRange(item.createdAtISO)) return;
        const category = inferCategoryFromText(item.title);
        values[category] += item.durationMinutes;
      });
    } else {
      notes.forEach((note) => {
        if (!note.reminderAtISO || !inRange(note.reminderAtISO)) return;
        const category = note.category || "personal";
        values[category] += 1;
      });
    }

    const dominantColor = (category: NoteCategory) => {
      const entries = Object.entries(colorWeights[category]);
      if (entries.length === 0) return INSIGHT_CATEGORY_META[category].color;
      return entries.sort((a, b) => b[1] - a[1])[0]?.[0] || INSIGHT_CATEGORY_META[category].color;
    };

    const segments = (Object.keys(INSIGHT_CATEGORY_META) as NoteCategory[]).map((key) => ({
      key,
      label: INSIGHT_CATEGORY_META[key].label,
      color: dominantColor(key),
      description: INSIGHT_CATEGORY_META[key].description,
      value: values[key],
    }));

    const total = segments.reduce((sum, segment) => sum + segment.value, 0);
    const ranked = [...segments].sort((a, b) => b.value - a.value);

    let cumulative = 0;
    const activeSegments = ranked.filter((segment) => segment.value > 0);
    const donutGradient =
      total === 0 || activeSegments.length === 0
        ? "conic-gradient(#dbeafe 0 100%)"
        : `conic-gradient(${activeSegments
            .map((segment) => {
              const startPct = (cumulative / total) * 100;
              cumulative += segment.value;
              const endPct = (cumulative / total) * 100;
              return `${segment.color} ${startPct}% ${endPct}%`;
            })
            .join(", ")})`;

    const topCategory = ranked[0];

    return {
      total,
      segments,
      ranked,
      donutGradient,
      topCategory,
      windowLabel: `${windowDays} day window`,
      metricLabel:
        insightMetric === "focus"
          ? "Focus Minutes"
          : insightMetric === "notes"
            ? "Notes Updated"
            : insightMetric === "planned"
              ? "Planned Minutes"
              : "Reminder Count",
      unitSuffix: insightMetric === "focus" || insightMetric === "planned" ? "m" : "",
    };
  }, [insightMetric, insightRange, notes, plannedBlocks, sessions]);

  useEffect(() => {
    if (!selectedInsightCategory) {
      setSelectedInsightCategory(insightsChart.ranked[0]?.key ?? "personal");
      return;
    }
    const stillExists = insightsChart.segments.some(
      (segment) => segment.key === selectedInsightCategory,
    );
    if (!stillExists) {
      setSelectedInsightCategory(insightsChart.ranked[0]?.key ?? "personal");
    }
  }, [insightsChart.ranked, insightsChart.segments, selectedInsightCategory]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const updateViewport = () => setIsMobileViewport(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) {
      setMobileMoreOpen(false);
      setMobileNotesRecentOpen(false);
      setMobileNotesEditorOpen(false);
      setMobileNotesToolsOpen(null);
      setMobileBlockSheetOpen(false);
      return;
    }

    if (!selectedNoteId) {
      setMobileNotesEditorOpen(false);
    }
  }, [isMobileViewport, selectedNoteId]);

  useEffect(() => {
    if (!isMobileViewport || !mobileNotesEditorOpen || !selectedNoteId) return;
    const timeoutId = window.setTimeout(() => {
      scrollToSection(notesEditorRef.current);
      editorRef.current?.focus();
    }, 140);
    return () => window.clearTimeout(timeoutId);
  }, [isMobileViewport, mobileNotesEditorOpen, selectedNoteId]);

  useEffect(() => {
    if (!showIntroSplash) return;
    const timeoutId = window.setTimeout(() => {
      setIntroMinElapsed(true);
    }, INTRO_SPLASH_MIN_MS);
    return () => window.clearTimeout(timeoutId);
  }, [showIntroSplash]);

  useEffect(() => {
    if (!showIntroSplash) return;
    if (!introMinElapsed || !introFinished || !authChecked) return;
    setShowIntroSplash(false);
  }, [authChecked, introFinished, introMinElapsed, showIntroSplash]);

  useEffect(() => {
    if (!showIntroSplash) return;
    const timeoutId = window.setTimeout(() => {
      setIntroFinished(true);
    }, INTRO_SPLASH_MAX_MS);
    return () => window.clearTimeout(timeoutId);
  }, [showIntroSplash]);

  useEffect(() => {
    if (!senseiReaction) return;
    const timeoutId = window.setTimeout(() => {
      setSenseiReaction("");
    }, 5000);
    return () => window.clearTimeout(timeoutId);
  }, [senseiReaction]);

  useEffect(() => {
    const updateMinute = () => setLandingWisdomMinute(Math.floor(Date.now() / 60000));
    let intervalId: number | null = null;
    const timeoutId = window.setTimeout(() => {
      updateMinute();
      intervalId = window.setInterval(updateMinute, 60000);
    }, 60000 - (Date.now() % 60000));

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void getProState().then((state) => {
      if (!active) return;
      setIsPro(state.isPro);
      setProSource(state.source);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void getScreenTimeCapability().then((capability) => {
      if (!active) return;
      setScreenTimeSupported(capability.supported);
      setScreenTimeStatus(capability.status);
      setScreenTimeReason(capability.reason || "");
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      if (!nextUser) {
        appOpenTrackedRef.current = null;
        setUser(null);
        setSessions([]);
        setNotes([]);
        setPlannedBlocks([]);
        setSickDaySaves([]);
        setSickDaySaveDismissals([]);
        setSickDaySavePromptOpen(false);
        setSelectedNoteId(null);
        setSelectedCalendarDate(null);
        setAuthChecked(true);
        router.replace("/login");
        return;
      }

      setUser(nextUser);
      if (appOpenTrackedRef.current !== nextUser.uid) {
        appOpenTrackedRef.current = nextUser.uid;
        fireAndForgetTracking(
          trackAppOpened(nextUser, {
            screenName: "today",
            launchSource: "cold_start",
          }),
        );
      }
      // Unblock the shell immediately after auth; sync data in the background.
      setAuthChecked(true);
      void Promise.all([refreshSessions(nextUser.uid), refreshNotes(nextUser.uid)]).catch(() => {
        // Keep existing local UI visible even if initial cloud sync is slow/unavailable.
      });
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (authChecked) return;
    const timeoutId = window.setTimeout(() => {
      setAuthChecked(true);
    }, 2500);
    return () => window.clearTimeout(timeoutId);
  }, [authChecked]);

  useEffect(() => {
    if (!user) return;
    const loaded = loadPlannedBlocks(user.uid);
    setPlannedBlocks(loaded);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setSickDaySaves(loadSickDaySaves(user.uid));
    setSickDaySaveDismissals(loadSickDaySaveDismissals(user.uid));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setDailyRitualDrafts(createDailyRitualDrafts(claimedBlocksToday));
    setDailyPlanningStatus("");
    if (claimedBlocksToday.length < 3) {
      setDailyPlanningOpen(true);
      setActiveTab("calendar");
      setSelectedCalendarDate(dayKeyLocal(new Date()));
      setCalendarView("day");
    } else {
      setDailyPlanningOpen(false);
    }
  }, [claimedBlocksToday, user]);

  useEffect(() => {
    if (!user) return;
    const stored = window.localStorage.getItem(senseiStyleStorageKey(user.uid));
    if (stored === "gentle" || stored === "balanced" || stored === "strict") {
      setCompanionStyle(stored);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    window.localStorage.setItem(senseiStyleStorageKey(user.uid), companionStyle);
  }, [companionStyle, user]);

  useEffect(() => {
    if (!user) return;
    const stored = window.localStorage.getItem(themeModeStorageKey(user.uid));
    if (stored === "light" || stored === "dark") {
      setThemeMode(stored);
      setThemePromptOpen(false);
      return;
    }
    setThemeMode("dark");
    setThemePromptOpen(true);
  }, [user]);

  useEffect(() => {
    document.body.dataset.theme = themeMode;
    return () => {
      delete document.body.dataset.theme;
    };
  }, [themeMode]);

  useEffect(() => {
    function onOnline() {
      if (!user || notes.length === 0) return;
      void handleRetrySync();
    }

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [notes, user]);

  useEffect(() => {
    if (!user) return;

    const today = startOfDayLocal(new Date());
    const yesterdayDateKey = dayKeyLocal(addDays(today, -1));
    const dayBeforeYesterdayDateKey = dayKeyLocal(addDays(today, -2));
    const protectedDateKeys = sickDaySaves.map((save) => save.dateKey);
    const yesterdayAlreadyProtected = protectedDateKeys.includes(yesterdayDateKey);
    const yesterdayMissed = !sessions.some(
      (session) => dayKeyLocal(session.completedAtISO) === yesterdayDateKey,
    );
    const priorRun = computeStreakEndingAtDateKey(
      sessions,
      dayBeforeYesterdayDateKey,
      protectedDateKeys,
    );
    const latestClaim = sickDaySaves.length > 0 ? new Date(sickDaySaves[0].claimedAtISO) : null;
    const onCooldown = latestClaim !== null && latestClaim >= addDays(today, -30);
    const dismissed = sickDaySaveDismissals.includes(yesterdayDateKey);

    if (yesterdayMissed && !yesterdayAlreadyProtected && priorRun > 0 && !onCooldown && !dismissed) {
      setSickDaySavePromptOpen(true);
    }
  }, [sessions, sickDaySaveDismissals, sickDaySaves, user]);

  useEffect(() => {
    async function pullLatest() {
      if (!user || syncInFlightRef.current) return;
      if (selectedNote && editorBodyDraft !== selectedNote.body) return;

      syncInFlightRef.current = true;
      try {
        await Promise.all([refreshSessions(user.uid), refreshNotes(user.uid)]);
      } finally {
        syncInFlightRef.current = false;
      }
    }

    const intervalId = window.setInterval(() => {
      void pullLatest();
    }, 15000);

    function onFocus() {
      void pullLatest();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void pullLatest();
      }
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [editorBodyDraft, selectedNote, user]);

  useEffect(() => {
    setColorPickerOpen(false);
    setTextColorPickerOpen(false);
    setHighlightPickerOpen(false);
  }, [selectedNoteId]);

  useEffect(() => {
    const nextHtml = selectedNote ? normalizeBodyForEditor(selectedNote.body) : "";
    setEditorBodyDraft(nextHtml);
  }, [selectedNote, selectedNoteId]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (document.activeElement === editorRef.current) return;

    if (editorRef.current.innerHTML !== editorBodyDraft) {
      editorRef.current.innerHTML = editorBodyDraft;
    }
  }, [editorBodyDraft, selectedNoteId]);

  async function refreshSessions(uid: string) {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== uid) {
      throw new Error("Your login session is missing. Sign in again.");
    }

    setSessions(await loadSessions(currentUser));
  }

  async function refreshNotes(uid: string) {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== uid) {
      throw new Error("Your login session is missing. Sign in again.");
    }

    const result = await loadNotes(currentUser);
    setNotes(result.notes);
    setSelectedNoteId((current) => current ?? result.notes[0]?.id ?? null);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }

  function fireAndForgetTracking(work: Promise<unknown>) {
    void work.catch(() => {
      // Analytics must not block the product workflow.
    });
  }

  function trackStreakChange(
    previousLength: number,
    nextLength: number,
    source: "session_completed" | "task_completed" | "sick_day_save",
    linkedSessionId?: string | null,
    streakDate = dayKeyLocal(new Date()),
  ) {
    if (!user || previousLength === nextLength) return;

    fireAndForgetTracking(
      trackStreakUpdated(user, {
        streakDate,
        previousLength,
        newLength: nextLength,
        updateSource: source,
        linkedSessionId: linkedSessionId ?? null,
      }),
    );
  }

  async function handleSessionStarted(context: TimerSessionContext) {
    if (!user) return;

    fireAndForgetTracking(
      trackSessionStarted(user, {
        sessionId: context.sessionId,
        sessionType: context.sessionType,
        subjectMode: context.subjectMode,
        targetMinutes: context.targetMinutes,
      }),
    );
  }

  async function handleSessionAbandoned(
    context: TimerSessionContext & {
      elapsedMinutes: number;
      abandonReason: "reset" | "route_change" | "component_unmount" | "unknown";
    },
  ) {
    if (!user) return;

    const quality = evaluateSessionQuality({
      plannedDurationMinutes: context.targetMinutes,
      actualDurationMinutes: context.elapsedMinutes,
      completionStatus: "abandoned",
      earlyExit: true,
      interruptionCount: context.interruptionCount,
      tasksCompletedCount: 0,
    });

    fireAndForgetTracking(
      trackSessionAbandoned(user, {
        sessionId: context.sessionId,
        sessionType: context.sessionType,
        subjectMode: context.subjectMode,
        elapsedMinutes: context.elapsedMinutes,
        abandonReason: context.abandonReason,
        plannedDurationMinutes: context.targetMinutes,
        interruptionCount: context.interruptionCount,
        qualityScore: quality.score,
        qualityRating: quality.rating,
      }),
    );
  }

  async function completeSession(
    note: string,
    minutesSpent: number,
    sessionContext?: TimerSessionContext,
  ) {
    if (!user) return;

    const previousStreak = computeStreak(sessions, protectedStreakDateKeys);
    const now = new Date().toISOString();
    const session: SessionDoc = {
      uid: user.uid,
      completedAtISO: now,
      minutes: minutesSpent,
      category: "misc",
      note: note.trim(),
      noteSavedAtISO: now,
    };

    const nextSessions = await saveSession(user, session);
    setSessions(nextSessions);
    if (sessionContext) {
      const quality = evaluateSessionQuality({
        plannedDurationMinutes: sessionContext.targetMinutes,
        actualDurationMinutes: minutesSpent,
        completionStatus: "completed",
        earlyExit:
          sessionContext.targetMinutes !== null && minutesSpent < sessionContext.targetMinutes,
        interruptionCount: sessionContext.interruptionCount,
        tasksCompletedCount: 0,
      });
      fireAndForgetTracking(
        trackSessionCompleted(user, {
          sessionId: sessionContext.sessionId,
          sessionType: sessionContext.sessionType,
          subjectMode: sessionContext.subjectMode,
          durationMinutes: minutesSpent,
          plannedDurationMinutes: sessionContext.targetMinutes,
          completionStatus: "completed",
          earlyExit:
            sessionContext.targetMinutes !== null && minutesSpent < sessionContext.targetMinutes,
          interruptionCount: sessionContext.interruptionCount,
          tasksCompletedCount: 0,
          qualityScore: quality.score,
          qualityRating: quality.rating,
          noteAttached: Boolean(note.trim()),
        }),
      );
    }
    trackStreakChange(
      previousStreak,
      computeStreak(nextSessions, protectedStreakDateKeys),
      "session_completed",
      sessionContext?.sessionId ?? null,
    );
    setSenseiReaction(
      buildSenseiReaction({
        source: "timer",
        minutesSpent,
        todaySessions: countSessionsForDate(nextSessions, dayKeyLocal(new Date())),
        streak: computeStreak(nextSessions, protectedStreakDateKeys),
      }),
    );
  }

  async function createWorkspaceNote() {
    if (!user) return null;

    const nextNote = createNote();
    const nextNotes = [nextNote, ...notes];
    setNotes(nextNotes);
    setSelectedNoteId(nextNote.id);
    setActiveTab("notes");
    const result = await saveNotes(user, nextNotes);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
    return nextNote.id;
  }

  async function updateSelectedNote(
    patch: Partial<
      Pick<
        WorkspaceNote,
        | "title"
        | "body"
        | "color"
        | "isPinned"
        | "fontFamily"
        | "fontSizePx"
        | "category"
        | "reminderAtISO"
      >
    >,
  ) {
    if (!user || !selectedNote) return;

    const now = new Date().toISOString();
    const nextNotes = notes.map((note) =>
      note.id === selectedNote.id ? { ...note, ...patch, updatedAtISO: now } : note,
    );
    setNotes(nextNotes);
    const result = await saveNotes(user, nextNotes);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }

  async function togglePinned(noteId: string) {
    if (!user) return;
    const target = notes.find((note) => note.id === noteId);
    if (!target) return;

    const now = new Date().toISOString();
    const nextNotes = notes.map((note) =>
      note.id === noteId
        ? { ...note, isPinned: !note.isPinned, updatedAtISO: now }
        : note,
    );
    setNotes(nextNotes);
    const result = await saveNotes(user, nextNotes);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }

  useEffect(() => {
    if (!selectedNote) return;
    if (editorBodyDraft === selectedNote.body) return;

    const timeoutId = window.setTimeout(() => {
      void updateSelectedNote({ body: editorBodyDraft });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [editorBodyDraft, selectedNote]);

  function captureEditorDraft() {
    if (!editorRef.current) return;
    setEditorBodyDraft(editorRef.current.innerHTML);
  }

  function saveEditorSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
      return;
    }

    savedSelectionRef.current = range.cloneRange();
  }

  function restoreEditorSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const savedRange = savedSelectionRef.current;
    if (!editor || !selection || !savedRange) return false;
    if (!editor.contains(savedRange.startContainer) || !editor.contains(savedRange.endContainer)) {
      return false;
    }

    editor.focus();
    selection.removeAllRanges();
    selection.addRange(savedRange);
    return true;
  }

  function applyEditorCommand(command: string, value?: string) {
    if (!selectedNote) return;
    if (!restoreEditorSelection()) {
      editorRef.current?.focus();
    }
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);
    saveEditorSelection();
    captureEditorDraft();
  }

  function applyHighlightColor(value: string) {
    if (!selectedNote) return;
    if (!restoreEditorSelection()) {
      editorRef.current?.focus();
    }
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("hiliteColor", false, value);
    document.execCommand("backColor", false, value);
    saveEditorSelection();
    captureEditorDraft();
  }

  async function deleteNote(noteId: string) {
    if (!user) return;
    const deleted = notes.find((note) => note.id === noteId) || null;
    const nextNotes = notes.filter((note) => note.id !== noteId);
    setNotes(nextNotes);
    setSelectedNoteId((current) => (current === noteId ? nextNotes[0]?.id ?? null : current));
    const result = await saveNotes(user, nextNotes);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
    setNoteUndoItem(deleted);
    window.setTimeout(() => setNoteUndoItem(null), 5000);
  }

  async function undoDeleteNote() {
    if (!user || !noteUndoItem) return;
    const restored = [noteUndoItem, ...notes];
    setNotes(restored);
    setSelectedNoteId(noteUndoItem.id);
    const result = await saveNotes(user, restored);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
    setNoteUndoItem(null);
  }

  async function handleRetrySync() {
    if (!user) return;
    setNotesSyncStatus("syncing");
    const result = await retryNotesSync(user, notes);

    if (result.synced) {
      setNotesSyncStatus("synced");
      setNotesSyncMessage("");
    } else {
      setNotesSyncStatus("local-only");
      setNotesSyncMessage(result.message ?? "Retry failed.");
    }
  }

  async function submitFeedback() {
    if (!user || feedbackSubmitting) return;

    const message = feedbackMessage.trim();
    if (!message) {
      setFeedbackStatus("Please write a short message before sending.");
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackStatus("");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email ?? "",
          displayName: user.displayName ?? "",
          category: feedbackCategory,
          message,
          pagePath: window.location.pathname,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(body?.error || "Failed to submit feedback.");
      }

      setFeedbackMessage("");
      setFeedbackStatus("Thanks. Feedback submitted.");
      window.setTimeout(() => {
        setFeedbackOpen(false);
        setFeedbackStatus("");
      }, 900);
    } catch (error: unknown) {
      setFeedbackStatus(
        error instanceof Error ? error.message : "Failed to submit feedback.",
      );
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  async function copyWeeklyReport() {
    const userLabel = user?.displayName || user?.email || "WHELM user";
    const report = [
      "Whelm Weekly Report",
      `Focus today: ${focusMetrics.todayMinutes}m`,
      `Focus this week: ${focusMetrics.weekMinutes}m`,
      `Sessions today: ${focusMetrics.todaySessions}`,
      `Discipline score: ${focusMetrics.disciplineScore}/100`,
      `Current streak: ${streak} day${streak === 1 ? "" : "s"}`,
      `Active days (30d): ${focusMetrics.activeDaysInMonth}/30`,
      `User: ${userLabel}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(report);
      setReportCopyStatus("Copied");
    } catch {
      setReportCopyStatus("Copy failed");
    } finally {
      window.setTimeout(() => setReportCopyStatus(""), 1200);
    }
  }

  async function handleRestoreFreeTier() {
    const next = await restoreFreeTier();
    setIsPro(next.isPro);
    setProSource(next.source);
  }

  async function handleStartProPreview() {
    const next = await startProPreview();
    setIsPro(next.isPro);
    setProSource(next.source);
  }

  async function handleRequestScreenTimeAuth() {
    try {
      setScreenTimeBusy(true);
      const status = await requestScreenTimeAuthorization();
      setScreenTimeStatus(status);
      setScreenTimeReason(
        status === "approved"
          ? "Screen Time permission granted."
          : "Screen Time permission was not approved.",
      );
    } catch (error) {
      setScreenTimeReason(
        error instanceof Error ? error.message : "Unable to request Screen Time permission.",
      );
    } finally {
      setScreenTimeBusy(false);
    }
  }

  async function handleDeleteAccount() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setAccountDangerStatus("No signed-in account found.");
      return;
    }

    const confirmed = window.confirm(
      "Delete your Whelm account and all associated app data? This cannot be undone.",
    );
    if (!confirmed) return;

    const secondConfirmed = window.confirm(
      "Final confirmation: permanently delete this account, your notes, your sessions, and your local Whelm data?",
    );
    if (!secondConfirmed) return;

    setDeletingAccount(true);
    setAccountDangerStatus("");

    try {
      const email = currentUser.email?.trim();
      if (!email) {
        throw new Error("This account is missing an email address for deletion confirmation.");
      }

      const password = window.prompt(
        "Enter your password to permanently delete this account.",
      );

      if (password === null) {
        return;
      }

      if (!password.trim()) {
        throw new Error("Enter your password to delete your account.");
      }

      try {
        await reauthenticateWithCredential(
          currentUser,
          EmailAuthProvider.credential(email, password),
        );
      } catch (reauthError: unknown) {
        const reauthMessage =
          reauthError instanceof Error ? reauthError.message : "Reauthentication failed.";

        if (
          reauthMessage.includes("invalid-credential") ||
          reauthMessage.includes("wrong-password")
        ) {
          throw new Error("Incorrect password. Enter the same password you use to log in.");
        }

        throw reauthError;
      }

      const runDeletion = async () => {
        const token = await currentUser.getIdToken(true);
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const deleteNotesResponse = await fetch(
          `/api/notes?uid=${encodeURIComponent(currentUser.uid)}`,
          {
            method: "DELETE",
            headers,
          },
        );

        if (!deleteNotesResponse.ok) {
          const body = (await deleteNotesResponse.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error || "Failed to delete saved notes.");
        }

        const deleteSessionsResponse = await fetch(
          `/api/sessions?uid=${encodeURIComponent(currentUser.uid)}`,
          {
            method: "DELETE",
            headers,
          },
        );

        if (!deleteSessionsResponse.ok) {
          const body = (await deleteSessionsResponse.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error || "Failed to delete saved sessions.");
        }

        clearLocalAccountData(currentUser.uid);
        await deleteUser(currentUser);
      };

      try {
        await runDeletion();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to delete account.";
        const needsRecentLogin =
          message.includes("requires-recent-login") ||
          message.includes("auth/requires-recent-login");

        if (!needsRecentLogin) {
          throw error;
        }

        await runDeletion();
      }

      router.replace("/login");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to delete account.";
      if (
        message.includes("requires-recent-login") ||
        message.includes("auth/requires-recent-login")
      ) {
        setAccountDangerStatus(
          "Reauthentication failed. Log in again, then retry account deletion.",
        );
      } else if (
        message.includes("invalid-credential") ||
        message.includes("wrong-password")
      ) {
        setAccountDangerStatus(
          "Incorrect password. Enter the same password you use to log in.",
        );
      } else {
        setAccountDangerStatus(message);
      }
    } finally {
      setDeletingAccount(false);
    }
  }

  async function handleOpenScreenTimeSettings() {
    try {
      setScreenTimeBusy(true);
      await openScreenTimeSystemSettings();
    } catch (error) {
      setScreenTimeReason(
        error instanceof Error ? error.message : "Unable to open iOS settings.",
      );
    } finally {
      setScreenTimeBusy(false);
    }
  }

  function openUpgradeFlow() {
    setPaywallOpen(true);
  }

  function openNotesTab() {
    setActiveTab("notes");
  }

  function scrollToSection(target: HTMLElement | null) {
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openMobileNoteEditor(noteId: string) {
    setSelectedNoteId(noteId);
    setMobileNotesEditorOpen(true);
    setMobileNotesToolsOpen(null);
    setMobileNotesRecentOpen(false);
  }

  async function handleMobileCreateNote() {
    await createWorkspaceNote();
    setMobileNotesEditorOpen(true);
    setMobileNotesToolsOpen(null);
    setMobileNotesRecentOpen(false);
  }

  function handleOpenCurrentMobileNote() {
    if (!selectedNoteId) return;
    openMobileNoteEditor(selectedNoteId);
  }

  function handleMobilePlannerOpen() {
    setActiveTab("calendar");
    setCalendarView("day");
    setMobileBlockSheetOpen(true);
    setPlanStatus("");
  }

  function openCalendarBlockComposer() {
    setPlanStatus("");
    setPlanConflictWarning(null);
    setActiveTab("calendar");
    setCalendarView("day");
    if (isMobileViewport) {
      setMobileBlockSheetOpen(true);
      return;
    }
    setDayPortalComposerOpen(true);
  }

  function openPrefilledBlockComposer(options: {
    dateKey: string;
    title: string;
    note: string;
    timeOfDay: string;
    durationMinutes: number;
  }) {
    setSelectedCalendarDate(options.dateKey);
    setPlanTitle(options.title);
    setPlanNote(options.note);
    setPlanNoteExpanded(Boolean(options.note));
    setPlanTime(options.timeOfDay);
    setPlanDuration(options.durationMinutes);
    setPlanStatus("");
    setPlanConflictWarning(null);
    setActiveTab("calendar");
    setCalendarView("day");
    if (isMobileViewport) {
      setMobileBlockSheetOpen(true);
      return;
    }
    setDayPortalComposerOpen(true);
  }

  function openTimeBlockFlow(dateKey: string) {
    setSelectedCalendarDate(dateKey);
    setActiveTab("calendar");
    setCalendarView("day");
    setMobileBlockSheetOpen(true);
    setPlanStatus("");
    setPlanConflictWarning(null);
  }

  function openSickDaySaveReview() {
    setSickDaySavePromptOpen(false);
    setSickDaySavePromptPreview(false);
    setActiveTab("streaks");
  }

  function dismissSickDaySavePrompt() {
    setSickDaySavePromptOpen(false);
    setSickDaySavePromptPreview(false);
  }

  function declineSickDaySave() {
    if (!user || !rawYesterdayMissed) return;
    const nextDismissals = [...new Set([...sickDaySaveDismissals, yesterdayKey])];
    setSickDaySaveDismissals(nextDismissals);
    saveSickDaySaveDismissals(user.uid, nextDismissals);
    setSickDaySavePromptOpen(false);
  }

  function openStreakSaveQuestionnaire() {
    setStreakSaveAnswers({});
    setStreakSaveStatus("");
    setStreakSaveQuestionnairePreview(false);
    setStreakSaveQuestionnaireOpen(true);
  }

  function openStreakSaveQuestionnairePreview() {
    setStreakSaveAnswers({});
    setStreakSaveStatus("");
    setStreakSaveQuestionnairePreview(true);
    setStreakSaveQuestionnaireOpen(true);
  }

  function openSickDaySavePromptPreview() {
    setSickDaySavePromptPreview(true);
    setSickDaySavePromptOpen(true);
  }

  function closeStreakSaveQuestionnaire() {
    setStreakSaveQuestionnaireOpen(false);
    setStreakSaveQuestionnairePreview(false);
    setStreakSaveStatus("");
  }

  function openDailyPlanningPreview() {
    setDailyPlanningStatus("");
    setDailyPlanningPreviewOpen(true);
    setDailyPlanningOpen(true);
  }

  function closeDailyPlanningPreview() {
    setDailyPlanningPreviewOpen(false);
    setDailyPlanningOpen(false);
    setDailyPlanningStatus("");
  }

  function claimSickDaySave() {
    if (streakSaveQuestionnairePreview) {
      closeStreakSaveQuestionnaire();
      return;
    }
    if (!user || !sickDaySaveEligible) return;
    const incompleteQuestion = STREAK_SAVE_ACCOUNTABILITY_QUESTIONS.find(
      (question) => !streakSaveAnswers[question]?.trim(),
    );
    if (incompleteQuestion) {
      setStreakSaveStatus("Answer all 5 accountability questions before using a streak save.");
      return;
    }

    const previousStreak = computeStreak(sessions, protectedStreakDateKeys);
    const nextSave: SickDaySave = {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`,
      dateKey: yesterdayKey,
      claimedAtISO: new Date().toISOString(),
      reason: "sick",
    };
    const nextSaves = [nextSave, ...sickDaySaves.filter((save) => save.dateKey !== yesterdayKey)].sort((a, b) =>
      a.claimedAtISO < b.claimedAtISO ? 1 : -1,
    );
    setSickDaySaves(nextSaves);
    saveSickDaySaves(user.uid, nextSaves);
    trackStreakChange(
      previousStreak,
      computeStreak(sessions, nextSaves.map((save) => save.dateKey)),
      "sick_day_save",
      null,
      yesterdayKey,
    );
    setSickDaySavePromptOpen(false);
    setStreakSaveQuestionnaireOpen(false);
    setStreakSaveStatus("");
    setActiveTab("streaks");
  }

  function handleTodayPrimaryAction() {
    if (senseiGuidance.actionLabel === "Start Today") {
      openTimeBlockFlow(dayKeyLocal(new Date()));
      return;
    }

    if (senseiGuidance.actionLabel === "Protect the Streak") {
      openTimeBlockFlow(selectedDateKey);
      return;
    }

    setActiveTab(senseiGuidance.actionTab as AppTab);
  }

  function handleMobileTabSelect(tab: AppTab | "more") {
    if (tab === "more") {
      setMobileMoreOpen(true);
      return;
    }

    setMobileMoreOpen(false);
    setActiveTab(tab);
  }

  function convertNoteToPlannedBlock(note: WorkspaceNote) {
    const reminderDate = note.reminderAtISO ? new Date(note.reminderAtISO) : null;
    const dateKey = reminderDate ? dayKeyLocal(reminderDate) : selectedDateKey;
    const timeOfDay = reminderDate
      ? `${String(reminderDate.getHours()).padStart(2, "0")}:${String(
          reminderDate.getMinutes(),
        ).padStart(2, "0")}`
      : "09:00";

    openPrefilledBlockComposer({
      dateKey,
      title: note.title || "Untitled note task",
      note: summarizePlainText(note.body, 280),
      timeOfDay,
      durationMinutes: 25,
    });
  }

  const selectedDateKey = selectedCalendarDate || dayKeyLocal(new Date());
  const calendarMonthLabel = calendarCursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const calendarMonthInput = monthInputFromDate(calendarCursor);
  const sessionMinutesByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of sessions) {
      const key = dayKeyLocal(session.completedAtISO);
      map.set(key, (map.get(key) ?? 0) + session.minutes);
    }
    return map;
  }, [sessions]);
  const historicalStreaksByDay = useMemo(
    () => computeHistoricalStreaks(sessions, protectedStreakDateKeys),
    [protectedStreakDateKeys, sessions],
  );
  const dynamicMonthCalendar = useMemo<MonthCell[]>(() => {
    const monthStart = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
    const daysInMonth = new Date(
      calendarCursor.getFullYear(),
      calendarCursor.getMonth() + 1,
      0,
    ).getDate();
    const leadingSpaces = monthStart.getDay();
    const cells: MonthCell[] = [];

    for (let i = 0; i < leadingSpaces; i += 1) {
      cells.push({
        key: `leading-${i}`,
        dayNumber: null,
        minutes: 0,
        level: 0,
        isCurrentMonth: false,
      });
    }

    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
      const day = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), dayNumber);
      const dateKey = dayKeyLocal(day);
      const minutes = sessionMinutesByDay.get(dateKey) ?? 0;
      cells.push({
        key: dateKey,
        dayNumber,
        minutes,
        level: focusLevel(minutes),
        isCurrentMonth: true,
      });
    }

    while (cells.length % 7 !== 0 || cells.length < 35) {
      cells.push({
        key: `trailing-${cells.length}`,
        dayNumber: null,
        minutes: 0,
        level: 0,
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [calendarCursor, sessionMinutesByDay]);
  const streakMonthLabel = streakCalendarCursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const streakMonthCalendar = useMemo<StreakMonthCell[]>(() => {
    const monthStart = new Date(
      streakCalendarCursor.getFullYear(),
      streakCalendarCursor.getMonth(),
      1,
    );
    const daysInMonth = new Date(
      streakCalendarCursor.getFullYear(),
      streakCalendarCursor.getMonth() + 1,
      0,
    ).getDate();
    const cells: StreakMonthCell[] = [];
    const leadingSpaces = monthStart.getDay();
    const todayKey = dayKeyLocal(new Date());

    for (let i = 0; i < leadingSpaces; i += 1) {
      cells.push({
        key: `streak-leading-${i}`,
        dateKey: null,
        dayNumber: null,
        isCurrentMonth: false,
        isToday: false,
        streakLength: 0,
        streakTierColor: null,
        hasSession: false,
        isSaved: false,
        leftConnected: false,
        rightConnected: false,
      });
    }

    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
      const day = new Date(
        streakCalendarCursor.getFullYear(),
        streakCalendarCursor.getMonth(),
        dayNumber,
      );
      const dateKey = dayKeyLocal(day);
      const isFutureDate = dateKey > todayKey;
      const streakLength = isFutureDate ? 0 : (historicalStreaksByDay.get(dateKey) ?? 0);
      cells.push({
        key: dateKey,
        dateKey,
        dayNumber,
        isCurrentMonth: true,
        isToday: dateKey === todayKey,
        streakLength,
        streakTierColor: isFutureDate ? null : (getStreakBandanaTier(streakLength)?.color ?? null),
        hasSession: !isFutureDate && sessionMinutesByDay.has(dateKey),
        isSaved:
          !isFutureDate &&
          protectedStreakDateKeys.includes(dateKey) &&
          !sessionMinutesByDay.has(dateKey),
        leftConnected: false,
        rightConnected: false,
      });
    }

    while (cells.length < 42) {
      cells.push({
        key: `streak-trailing-${cells.length}`,
        dateKey: null,
        dayNumber: null,
        isCurrentMonth: false,
        isToday: false,
        streakLength: 0,
        streakTierColor: null,
        hasSession: false,
        isSaved: false,
        leftConnected: false,
        rightConnected: false,
      });
    }

    return cells.map((cell, index, items) => {
      if (!cell.dateKey || cell.streakLength <= 0) return cell;

      const previous = items[index - 1];
      const next = items[index + 1];
      const sameWeekAsPrevious = previous ? Math.floor((index - 1) / 7) === Math.floor(index / 7) : false;
      const sameWeekAsNext = next ? Math.floor((index + 1) / 7) === Math.floor(index / 7) : false;

      return {
        ...cell,
        leftConnected: Boolean(previous?.dateKey) && (previous?.streakLength ?? 0) > 0 && sameWeekAsPrevious,
        rightConnected: Boolean(next?.dateKey) && (next?.streakLength ?? 0) > 0 && sameWeekAsNext,
      };
    });
  }, [historicalStreaksByDay, sessionMinutesByDay, streakCalendarCursor]);
  const selectedDatePlanGroups = useMemo(() => {
    const sameDate = plannedBlocks
      .filter((item) => item.dateKey === selectedDateKey)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.timeOfDay.localeCompare(b.timeOfDay));
    return {
      active: sameDate.filter((item) => item.status === "active" && !isDateKeyBeforeToday(item.dateKey)),
      completed: sameDate.filter((item) => item.status === "completed"),
      incomplete: sameDate.filter((item) => item.status === "active" && isDateKeyBeforeToday(item.dateKey)),
      visible: sameDate.filter(
        (item) => item.status === "completed" || !isDateKeyBeforeToday(item.dateKey),
      ),
    };
  }, [plannedBlocks, selectedDateKey]);
  const selectedDatePlans = selectedDatePlanGroups.active;
  const plannedBlockById = useMemo(
    () => new Map(plannedBlocks.map((item) => [item.id, item])),
    [plannedBlocks],
  );
  const plannedBlockHistory = useMemo(() => {
    const sorted = [...plannedBlocks].sort((a, b) => {
      if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);
      return a.timeOfDay.localeCompare(b.timeOfDay);
    });
    return {
      completed: sorted.filter((item) => item.status === "completed"),
      incomplete: sorted.filter((item) => item.status === "active" && isDateKeyBeforeToday(item.dateKey)),
    };
  }, [plannedBlocks]);
  const calendarEntriesByDate = useMemo(() => {
    const entries = new Map<string, CalendarEntry[]>();

    function pushEntry(dateKey: string, entry: CalendarEntry) {
      const list = entries.get(dateKey) ?? [];
      list.push(entry);
      entries.set(dateKey, list);
    }

    plannedBlocks.forEach((item) => {
      if (item.status !== "active" || isDateKeyBeforeToday(item.dateKey)) return;
      const startMinute = parseTimeToMinutes(item.timeOfDay || "09:00");
      const endMinute = Math.min(24 * 60, startMinute + Math.max(10, item.durationMinutes));
      pushEntry(item.dateKey, {
        id: `plan-${item.id}`,
        source: "plan",
        dateKey: item.dateKey,
        timeLabel: normalizeTimeLabel(item.timeOfDay),
        sortTime: item.timeOfDay || "23:59",
        title: item.title,
        subtitle: item.note.trim()
          ? `${item.durationMinutes}m focus block • note added`
          : `${item.durationMinutes}m focus block`,
        preview: item.note.trim()
          ? item.note.trim()
          : `Planned block: ${item.title} (${item.durationMinutes} minutes) at ${normalizeTimeLabel(
              item.timeOfDay,
            )}.`,
        tone: "Blue",
        startMinute,
        endMinute,
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
        sortTime: `${String(reminderDate.getHours()).padStart(2, "0")}:${String(
          reminderDate.getMinutes(),
        ).padStart(2, "0")}`,
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
        sortTime: `${String(completed.getHours()).padStart(2, "0")}:${String(
          completed.getMinutes(),
        ).padStart(2, "0")}`,
        title: session.note?.trim()
          ? stripCompletedBlockPrefix(session.note.trim())
          : `${sessionLabel} session`,
        subtitle: `${session.minutes}m completed`,
        preview: session.note?.trim()
          ? summarizePlainText(stripCompletedBlockPrefix(session.note), 160)
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
  }, [notes, plannedBlocks, sessions]);
  const selectedDateEntries = (calendarEntriesByDate.get(selectedDateKey) ?? []).filter(
    (entry) => entry.source !== "session",
  );
  const selectedDateFocusedMinutes = sessionMinutesByDay.get(selectedDateKey) ?? 0;
  const selectedDateSummary = useMemo(
    () =>
      calendarDaySummary({
        dateKey: selectedDateKey,
        entries: selectedDateEntries,
        plannedBlocks: selectedDatePlans,
        focusedMinutes: selectedDateFocusedMinutes,
      }),
    [selectedDateEntries, selectedDateFocusedMinutes, selectedDateKey, selectedDatePlans],
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
    for (
      let minute = startMinute;
      minute <= endMinute;
      minute += 60
    ) {
      const normalizedMinute = minute % (24 * 60);
      const hour = Math.floor(normalizedMinute / 60);
      const suffix = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 === 0 ? 12 : hour % 12;
      hourTicks.push({ minute, label: `${hour12}:00 ${suffix}` });
    }

    return {
      startMinute,
      endMinute,
      totalMinutes,
      items: positionedItems.map((item) => {
        const overlapIds = positionedItems
          .filter(
            (candidate) =>
              candidate.id !== item.id &&
              candidate.startMinute < item.endMinute &&
              candidate.endMinute > item.startMinute,
          )
          .map((candidate) => candidate.id);
        return {
          ...item,
          overlapIds,
        };
      }),
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
    if (
      currentMinute < dayViewTimeline.startMinute ||
      currentMinute > dayViewTimeline.endMinute
    ) {
      return null;
    }
    return {
      minute: currentMinute,
      topPct:
        ((currentMinute - dayViewTimeline.startMinute) / dayViewTimeline.totalMinutes) * 100,
      label: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };
  }, [dayViewTimeline.endMinute, dayViewTimeline.startMinute, dayViewTimeline.totalMinutes, selectedDateKey]);
  useEffect(() => {
    if (!isMobileViewport || calendarView !== "day") return;
    const container = mobileDayTimelineScrollRef.current;
    if (!container) return;

    const targetMinute =
      currentTimeMarker?.minute ??
      dayViewTimeline.items[0]?.startMinute ??
      dayViewTimeline.startMinute;
    const relative =
      (targetMinute - dayViewTimeline.startMinute) / Math.max(1, dayViewTimeline.totalMinutes);
    const contentHeight = container.scrollHeight;
    const viewportHeight = container.clientHeight;
    const targetScrollTop = Math.max(0, relative * contentHeight - viewportHeight * 0.32);

    container.scrollTop = targetScrollTop;
  }, [
    calendarView,
    currentTimeMarker?.minute,
    dayViewTimeline.items,
    dayViewTimeline.startMinute,
    dayViewTimeline.totalMinutes,
    isMobileViewport,
    selectedDateKey,
  ]);
  const calendarEntryById = useMemo(() => {
    const byId = new Map<string, CalendarEntry>();
    calendarEntriesByDate.forEach((items) => {
      items.forEach((entry) => byId.set(entry.id, entry));
    });
    return byId;
  }, [calendarEntriesByDate]);
  const activeCalendarPreview = useMemo(() => {
    const id =
      calendarView === "day"
        ? calendarPinnedEntryId ?? (!isMobileViewport ? calendarHoverEntryId : null)
        : calendarPinnedEntryId ?? calendarHoverEntryId;
    if (!id) return null;
    return calendarEntryById.get(id) ?? null;
  }, [calendarEntryById, calendarHoverEntryId, calendarPinnedEntryId, calendarView, isMobileViewport]);
  const activeDayViewPreviewItem = useMemo(() => {
    if (calendarView !== "day" || !activeCalendarPreview) return null;
    return dayViewTimeline.items.find((entry) => entry.id === activeCalendarPreview.id) ?? null;
  }, [activeCalendarPreview, calendarView, dayViewTimeline.items]);
  const activeOverlapPickerItem = useMemo(() => {
    if (calendarView !== "day" || !overlapPickerEntryId) return null;
    return dayViewTimeline.items.find((entry) => entry.id === overlapPickerEntryId) ?? null;
  }, [calendarView, dayViewTimeline.items, overlapPickerEntryId]);

  function clearCalendarHoverPreviewDelay() {
    if (calendarHoverPreviewTimeoutRef.current !== null) {
      window.clearTimeout(calendarHoverPreviewTimeoutRef.current);
      calendarHoverPreviewTimeoutRef.current = null;
    }
  }

  function showCalendarHoverPreview(entryId: string) {
    if (isMobileViewport || calendarPinnedEntryId) return;
    clearCalendarHoverPreviewDelay();
    setCalendarHoverEntryId(entryId);
  }

  function scheduleCalendarHoverPreviewClear(entryId?: string) {
    if (isMobileViewport || calendarPinnedEntryId) return;
    clearCalendarHoverPreviewDelay();
    calendarHoverPreviewTimeoutRef.current = window.setTimeout(() => {
      setCalendarHoverEntryId((current) => (entryId && current !== entryId ? current : null));
      calendarHoverPreviewTimeoutRef.current = null;
    }, 120);
  }

  useEffect(() => {
    setCalendarJumpDate(selectedDateKey);
  }, [selectedDateKey]);

  useEffect(() => {
    setPlanConflictWarning(null);
  }, [planDuration, planTime, planTitle, planNote, selectedDateKey]);

  useEffect(() => {
    if (calendarPinnedEntryId && !calendarEntryById.has(calendarPinnedEntryId)) {
      setCalendarPinnedEntryId(null);
    }
    if (calendarHoverEntryId && !calendarEntryById.has(calendarHoverEntryId)) {
      setCalendarHoverEntryId(null);
    }
  }, [calendarEntryById, calendarHoverEntryId, calendarPinnedEntryId]);

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
      activatedCalendarEntryTimeoutRef.current = window.setTimeout(
        () => {
          setActivatedCalendarEntryId((current) =>
            current === pendingCalendarEntryFocusId ? null : current,
          );
          activatedCalendarEntryTimeoutRef.current = null;
        },
        prefersReducedMotion ? 900 : 1800,
      );
      setPendingCalendarEntryFocusId(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [calendarEntryById, calendarView, pendingCalendarEntryFocusId]);

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

  const kpiDetailContent = useMemo<
    Record<KpiDetailKey, { title: string; summary: string; bullets: string[] }>
  >(
    () => ({
      totalFocus: {
        title: "Total Focus",
        summary: `${reportMetrics.totalMinutes} focused minutes logged so far.`,
        bullets: [
          "Use this to track overall lifetime momentum.",
          "Raise this by adding one extra focus block daily.",
          "Large total focus usually correlates with stronger retention.",
        ],
      },
      totalSessions: {
        title: "Total Sessions",
        summary: `${reportMetrics.sessionCount} saved sessions in your history.`,
        bullets: [
          "More sessions means more behavior repetition.",
          "Short sessions are fine if they happen consistently.",
          "Aim for a stable daily session count first.",
        ],
      },
      averageSession: {
        title: "Average Session Length",
        summary: `Current average is ${reportMetrics.averageSession} minutes per session.`,
        bullets: [
          "This reveals your natural deep-work capacity.",
          "If this drops, reduce context switching.",
          "For many users, 20–40 minutes is a healthy range.",
        ],
      },
      bestDay: {
        title: "Best Day",
        summary: `${reportMetrics.bestTrendLabel} had your top focus at ${reportMetrics.bestTrendMinutes} minutes.`,
        bullets: [
          "Review what worked on that day and repeat it.",
          "Use that day as your benchmark for next week.",
          "Great best-days come from fewer switches and clearer priorities.",
        ],
      },
      weeklyProgress: {
        title: "Weekly Progress",
        summary: `${reportMetrics.weeklyProgress}% of your 420-minute weekly target is complete.`,
        bullets: [
          "420 minutes per week equals 60 minutes per day.",
          "Progress bars turn planning into a clear finish line.",
          "Use calendar planning to close weekly gaps earlier.",
        ],
      },
    }),
    [reportMetrics],
  );

  function addPlannedBlock() {
    if (!user) return false;
    const title = planTitle.trim();
    const note = planNote.trim();
    if (!title) {
      setPlanStatus("Write a task title first.");
      return false;
    }

    const durationError = getPlannedBlockDurationError(planDuration);
    if (durationError) {
      setPlanStatus(durationError);
      return false;
    }

    const nextDuration = planDuration;
    const nextTime = planTime || "09:00";
    const conflicts = findPlanSpacingConflicts(selectedDatePlans, {
      dateKey: selectedDateKey,
      timeOfDay: nextTime,
      durationMinutes: nextDuration,
    });
    if (conflicts.length > 0) {
      setPlanConflictWarning({
        conflictIds: conflicts.map((item) => item.id),
        message: buildBlockSpacingMessage(conflicts),
      });
      setPlanStatus("");
      return false;
    }

    const next: PlannedBlock = {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`,
      dateKey: selectedDateKey,
      title,
      note,
      durationMinutes: nextDuration,
      timeOfDay: nextTime,
      sortOrder:
        selectedDatePlans.length === 0
          ? 0
          : Math.max(...selectedDatePlans.map((item) => item.sortOrder)) + 1,
      createdAtISO: new Date().toISOString(),
      status: "active",
    };
    const updated = [...plannedBlocks, next];
    setPlannedBlocks(updated);
    savePlannedBlocks(user.uid, updated);
    fireAndForgetTracking(
      trackTaskCreated(user, {
        taskId: next.id,
        scheduledDate: next.dateKey,
        durationMinutes: next.durationMinutes,
        subjectMode: analyticsSubjectModeFromText(`${next.title} ${next.note}`),
        source: "manual",
      }),
    );
    setPlanTitle("");
    setPlanNote("");
    setPlanNoteExpanded(false);
    setPlanConflictWarning(null);
    setPlanStatus("Planned block added.");
    window.setTimeout(() => setPlanStatus(""), 1200);
    setSelectedCalendarDate(selectedDateKey);
    setCalendarView("day");
    setActiveTab("calendar");
    setPendingCalendarEntryFocusId(`plan-${next.id}`);
    return true;
  }

  function deletePlannedBlock(id: string) {
    if (!user) return;
    const removed = plannedBlocks.find((item) => item.id === id) || null;
    if (!removed) return;
    const nextClaimedCount = claimedBlocksToday.filter((item) => item.id !== id).length;
    if (
      removed.dateKey === dayKeyLocal(new Date()) &&
      removed.durationMinutes >= 15 &&
      nextClaimedCount < 3
    ) {
      const confirmed = window.confirm(
        "Removing this block will reopen today's lock because you will fall below 3 required blocks. Continue?",
      );
      if (!confirmed) return;
      setDailyPlanningOpen(true);
      setDailyPlanningStatus("Today needs 3 active blocks. Replace the removed block to unlock the workspace again.");
    }
    const updated = plannedBlocks.filter((item) => item.id !== id);
    setPlannedBlocks(updated);
    savePlannedBlocks(user.uid, updated);
    setDeletedPlanUndo(removed);
    window.setTimeout(() => setDeletedPlanUndo(null), 5000);
  }

  function undoDeletePlannedBlock() {
    if (!user || !deletedPlanUndo) return;
    const updated = [...plannedBlocks, deletedPlanUndo];
    setPlannedBlocks(updated);
    savePlannedBlocks(user.uid, updated);
    setDeletedPlanUndo(null);
  }

  function updatePlannedBlockTime(id: string, timeOfDay: string) {
    if (!user) return;
    const block = plannedBlocks.find((item) => item.id === id);
    if (!block) return;
    const conflicts = findPlanSpacingConflicts(plannedBlocks, {
      dateKey: block.dateKey,
      timeOfDay,
      durationMinutes: block.durationMinutes,
      excludeId: id,
    });
    if (conflicts.length > 0) {
      setPlanStatus(buildBlockSpacingMessage(conflicts));
      return;
    }
    const updated = plannedBlocks.map((item) =>
      item.id === id ? { ...item, timeOfDay } : item,
    );
    setPlannedBlocks(updated);
    savePlannedBlocks(user.uid, updated);
    setPlanStatus("");
  }

  function reorderPlannedBlocks(sourceId: string, targetId: string) {
    if (!user || sourceId === targetId) return;

    const sameDate = plannedBlocks
      .filter((item) => item.dateKey === selectedDateKey)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.timeOfDay.localeCompare(b.timeOfDay));

    const sourceIndex = sameDate.findIndex((item) => item.id === sourceId);
    const targetIndex = sameDate.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const reordered = [...sameDate];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const withOrder = reordered.map((item, index) => ({
      ...item,
      sortOrder: index,
    }));

    const untouched = plannedBlocks.filter((item) => item.dateKey !== selectedDateKey);
    const updated = [...untouched, ...withOrder];
    setPlannedBlocks(updated);
    savePlannedBlocks(user.uid, updated);
  }

  async function completePlannedBlock(item: PlannedBlock) {
    if (!user) return;

    const previousStreak = computeStreak(sessions, protectedStreakDateKeys);
    const localDateTime = new Date(`${item.dateKey}T${item.timeOfDay}:00`);
    const completedAtISO = Number.isNaN(localDateTime.getTime())
      ? new Date().toISOString()
      : localDateTime.toISOString();

    const session: SessionDoc = {
      uid: user.uid,
      completedAtISO,
      minutes: item.durationMinutes,
      category: "misc",
      note: item.note.trim()
        ? `Planned block completed: ${item.title} - ${item.note.trim()}`
        : `Planned block completed: ${item.title}`,
      noteSavedAtISO: new Date().toISOString(),
    };

    const linkedSessionId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}`;
    const nextSessions = await saveSession(user, session);
    setSessions(nextSessions);
    const quality = evaluateSessionQuality({
      plannedDurationMinutes: item.durationMinutes,
      actualDurationMinutes: item.durationMinutes,
      completionStatus: "completed",
      earlyExit: false,
      interruptionCount: 0,
      tasksCompletedCount: 1,
    });
    fireAndForgetTracking(
      trackSessionCompleted(user, {
        sessionId: linkedSessionId,
        sessionType: "focus",
        subjectMode: analyticsSubjectModeFromText(`${item.title} ${item.note}`),
        durationMinutes: item.durationMinutes,
        plannedDurationMinutes: item.durationMinutes,
        completionStatus: "completed",
        earlyExit: false,
        interruptionCount: 0,
        tasksCompletedCount: 1,
        qualityScore: quality.score,
        qualityRating: quality.rating,
        noteAttached: Boolean(item.note.trim()),
        completedFromTaskId: item.id,
      }),
    );
    fireAndForgetTracking(
      trackTaskCompleted(user, {
        taskId: item.id,
        scheduledDate: item.dateKey,
        durationMinutes: item.durationMinutes,
        subjectMode: analyticsSubjectModeFromText(`${item.title} ${item.note}`),
        linkedSessionId,
      }),
    );
    trackStreakChange(
      previousStreak,
      computeStreak(nextSessions, protectedStreakDateKeys),
      "task_completed",
      linkedSessionId,
      item.dateKey,
    );
    setSenseiReaction(
      buildSenseiReaction({
        source: "plan",
        minutesSpent: item.durationMinutes,
        todaySessions: countSessionsForDate(nextSessions, dayKeyLocal(new Date())),
        streak: computeStreak(nextSessions, protectedStreakDateKeys),
      }),
    );
    const updated = plannedBlocks.map((block) =>
      block.id === item.id
        ? {
            ...block,
            status: "completed" as PlannedBlock["status"],
            completedAtISO,
          }
        : block,
    );
    setPlannedBlocks(updated);
    savePlannedBlocks(user.uid, updated);
    setPlanStatus("Session saved from plan.");
    window.setTimeout(() => setPlanStatus(""), 1200);
  }

  function selectCalendarDate(dateKey: string) {
    const parsed = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return;
    setCalendarHoverEntryId(null);
    setCalendarPinnedEntryId(null);
    setSelectedCalendarDate(dateKey);
    setCalendarJumpDate(dateKey);
    setCalendarCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    setCalendarView("day");
    setDayPortalComposerOpen(false);
    setOverlapPickerEntryId(null);
  }

  function jumpToToday() {
    const today = new Date();
    const key = dayKeyLocal(today);
    selectCalendarDate(key);
  }

  function jumpToCalendarSection(sectionId: string) {
    if (sectionId === "calendar-planner" && calendarView === "day") {
      openCalendarBlockComposer();
      sectionId = "calendar-day-chamber";
    }
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applyThemeMode(nextMode: ThemeMode) {
    setThemeMode(nextMode);
    if (user) {
      window.localStorage.setItem(themeModeStorageKey(user.uid), nextMode);
    }
    setThemePromptOpen(false);
  }

  function updateDailyRitualDraft(
    draftId: string,
    patch: Partial<Pick<DailyRitualBlockDraft, "title" | "note" | "timeOfDay" | "durationMinutes">>,
  ) {
    setDailyRitualDrafts((current) =>
      current.map((draft) => (draft.id === draftId ? { ...draft, ...patch } : draft)),
    );
  }

  function submitDailyRitual() {
    if (dailyPlanningPreviewOpen) {
      closeDailyPlanningPreview();
      return;
    }
    if (!user) return;
    const todayKey = dayKeyLocal(new Date());
    const invalidDraft = dailyRitualDrafts.find((draft) => {
      if (draft.existingBlockId) return false;
      return (
        !draft.title.trim() ||
        !draft.timeOfDay ||
        getPlannedBlockDurationError(draft.durationMinutes) !== null
      );
    });

    if (invalidDraft) {
      setDailyPlanningStatus(
        "Place 3 real blocks for today. Each one needs a title, time, and a reasonable duration.",
      );
      return;
    }

    const newBlocks = dailyRitualDrafts
      .filter((draft) => !draft.existingBlockId)
      .map((draft, index) => ({
        id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-${index}`,
        dateKey: todayKey,
        title: draft.title.trim(),
        note: draft.note.trim(),
        durationMinutes: draft.durationMinutes,
        timeOfDay: draft.timeOfDay,
        sortOrder: claimedBlocksToday.length + index,
        createdAtISO: new Date().toISOString(),
        status: "active" as const,
      }));

    const spacingConflicts: PlannedBlock[] = [];
    const candidatePool = plannedBlocks.filter(
      (item) => item.dateKey === todayKey && item.status === "active",
    );
    for (const block of newBlocks) {
      const conflicts = findPlanSpacingConflicts([...candidatePool, ...newBlocks], {
        dateKey: block.dateKey,
        timeOfDay: block.timeOfDay,
        durationMinutes: block.durationMinutes,
        excludeId: block.id,
      });
      if (conflicts.length > 0) {
        spacingConflicts.push(...conflicts);
        break;
      }
    }

    if (spacingConflicts.length > 0) {
      setDailyPlanningStatus(buildBlockSpacingMessage(spacingConflicts));
      return;
    }

    if (claimedBlocksToday.length + newBlocks.length < 3) {
      setDailyPlanningStatus("Three blocks are required before Whelm unlocks.");
      return;
    }

    const updated = [...plannedBlocks, ...newBlocks];
    setPlannedBlocks(updated);
    savePlannedBlocks(user.uid, updated);
    newBlocks.forEach((block) => {
      fireAndForgetTracking(
        trackTaskCreated(user, {
          taskId: block.id,
          scheduledDate: block.dateKey,
          durationMinutes: block.durationMinutes,
          subjectMode: analyticsSubjectModeFromText(`${block.title} ${block.note}`),
          source: "daily_ritual",
        }),
      );
    });
    setDailyPlanningStatus("");
    setDailyPlanningOpen(false);
    setActiveTab("calendar");
    setSelectedCalendarDate(todayKey);
    setCalendarView("day");
  }

  useEffect(() => {
    if (dailyRitualDrafts.length === 0) {
      setDailyRitualExpandedId(null);
      return;
    }
    setDailyRitualExpandedId((current) => {
      if (current && dailyRitualDrafts.some((draft) => draft.id === current)) return current;
      const firstOpen = dailyRitualDrafts.find((draft) => !draft.existingBlockId)?.id;
      return firstOpen ?? dailyRitualDrafts[0]?.id ?? null;
    });
  }, [dailyRitualDrafts]);

  if (showIntroSplash) {
    return <IntroSplash onComplete={() => setIntroFinished(true)} />;
  }

  if (!authChecked) {
    return (
      <main className={styles.pageShell}>
        <div className={styles.loadingCard}>
          <p className={styles.loadingLabel}>Preparing your WHELM session...</p>
          <button
            type="button"
            className={styles.secondaryPlanButton}
            onClick={() => setAuthChecked(true)}
          >
            Continue now
          </button>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const lastSession = sessions[0];
  const latestNote = orderedNotes[0] ?? null;
  const nextPlannedBlock = todayActivePlannedBlocks[0] ?? null;
  const mobileMoreActive = MOBILE_MORE_TABS.includes(activeTab);
  const recentNotes = filteredNotes.slice(0, 4);
  const todayKey = dayKeyLocal(new Date());
  const yesterdayKey = dayKeyLocal(addDays(startOfDayLocal(new Date()), -1));
  const dayBeforeYesterdayKey = dayKeyLocal(addDays(startOfDayLocal(new Date()), -2));
  const todaySessionNoteCount = sessions.filter((session) => {
    return dayKeyLocal(session.completedAtISO) === todayKey && Boolean(session.note?.trim());
  }).length;
  const hasEarnedToday = sessionMinutesByDay.has(todayKey) || protectedStreakDateKeys.includes(todayKey);
  const yesterdaySave = sickDaySaves.find((save) => save.dateKey === yesterdayKey) ?? null;
  const rawYesterdayMissed =
    !sessionMinutesByDay.has(yesterdayKey) && !protectedStreakDateKeys.includes(yesterdayKey);
  const priorRunBeforeYesterday = computeStreakEndingAtDateKey(
    sessions,
    dayBeforeYesterdayKey,
    protectedStreakDateKeys,
  );
  const latestSickSaveClaim =
    sickDaySaves.length > 0 ? new Date(sickDaySaves[0].claimedAtISO) : null;
  const recentSickSaveUsed =
    latestSickSaveClaim !== null &&
    latestSickSaveClaim >= addDays(startOfDayLocal(new Date()), -30);
  const sickDaySaveEligible =
    rawYesterdayMissed &&
    priorRunBeforeYesterday > 0 &&
    !yesterdaySave &&
    !recentSickSaveUsed &&
    !sickDaySaveDismissals.includes(yesterdayKey);
  const sickDaySaveCooldownUntil = recentSickSaveUsed
    ? addDays(latestSickSaveClaim as Date, 30)
    : null;
  const rescuedRunDisplay =
    !sessionMinutesByDay.has(todayKey) && yesterdaySave ? priorRunBeforeYesterday + 1 : 0;
  const displayStreak = streak > 0 ? streak : rescuedRunDisplay;
  const streakBandanaTier = getStreakBandanaTier(displayStreak);
  const profileTierTheme = getProfileTierTheme(streakBandanaTier?.color, isPro);
  const profileDisplayName =
    user.displayName?.trim() ||
    user.email?.split("@")[0]?.trim() ||
    "Whelm user";
  const nextBandanaMilestone = buildNextBandanaMilestone(displayStreak, !hasEarnedToday);
  const longestStreak = Math.max(0, ...Array.from(historicalStreaksByDay.values()));
  const lifetimeFocusMinutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
  const todayCompletedBlocksCount = plannedBlocks.filter(
    (item) => item.dateKey === todayKey && item.status === "completed",
  ).length;
  const streakMinutesLeft = Math.max(0, 30 - focusMetrics.todayMinutes);
  const streakProtectedToday = todayCompletedBlocksCount >= 1 && focusMetrics.todayMinutes >= 30;
  const streakStatusLine = streakProtectedToday
    ? "Today protected."
    : todayCompletedBlocksCount >= 1
      ? `1 block done, ${streakMinutesLeft}m left.`
      : focusMetrics.todayMinutes >= 30
        ? "30m reached. Complete 1 block."
        : "Claim today before it claims you.";
  const maxTrendMinutes = Math.max(30, ...trendPoints.map((point) => point.minutes));
  const trendPath = trendPoints
    .map((point, index) => {
      const x = (index / Math.max(1, trendPoints.length - 1)) * 100;
      const y = 100 - (point.minutes / maxTrendMinutes) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  const maxAnalyticsScore = Math.max(100, ...analyticsScoreHistory.map((entry) => entry.score));
  const analyticsScorePath = analyticsScoreHistory
    .map((entry, index) => {
      const x = (index / Math.max(1, analyticsScoreHistory.length - 1)) * 100;
      const y = 100 - (entry.score / maxAnalyticsScore) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  const analyticsTopHours = analyticsBestHours?.hours.slice(0, 4) ?? [];
  const analyticsTopSubjects = analyticsWeeklySummary
    ? (Object.entries(analyticsWeeklySummary.subjectBreakdown) as Array<
        [
          "language" | "school" | "work" | "general",
          { focusMinutes: number; sessionsCompleted: number; tasksCompleted: number },
        ]
      >)
        .map(([key, value]) => ({
          key,
          label:
            key === "general"
              ? "General"
              : key.charAt(0).toUpperCase() + key.slice(1),
          ...value,
        }))
        .sort((a, b) => b.focusMinutes - a.focusMinutes)
    : [];
  const analyticsTopSubjectMinutes = Math.max(1, ...analyticsTopSubjects.map((subject) => subject.focusMinutes));
  const streakHeroEmoteId: WhelmEmoteId =
    streak >= 100 ? "whelm.proud" : streak >= 50 ? "whelm.ready" : "whelm.encourage";
  const streakMilestoneTitle = nextBandanaMilestone
    ? `You'll reach ${nextBandanaMilestone.tier.label.replace(" Bandana", "")} on ${nextBandanaMilestone.targetDate.toLocaleDateString(
        undefined,
        { month: "long", day: "numeric" },
      )}.`
    : "You've reached the highest bandana tier.";
  const streakMilestoneBody = nextBandanaMilestone
    ? nextBandanaMilestone.remainingDays === 0
      ? "Protect today and earn the next bandana tier."
      : `${nextBandanaMilestone.remainingDays} more day${
          nextBandanaMilestone.remainingDays === 1 ? "" : "s"
        } of protection unlock the next color.`
    : "White bandana is the summit. Keep the run alive and deepen the legacy.";

  return (
    <main
      className={`${styles.pageShell} ${
        themeMode === "light" ? styles.themeLight : styles.themeDark
      }`}
    >
      <div className={styles.pageFrame}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>WHELM</p>
            <h1 className={styles.title}>Enter Whelm Flow.</h1>
            <p className={styles.subtitle}>
              Plan the line, protect the streak, and keep the day under command.
            </p>
          </div>
          <div className={styles.headerActions}>
            <span className={styles.headerTag}>Whelm Flow</span>
            <span className={styles.headerTag}>No drift</span>
            <span className={styles.headerTag}>Daily command</span>
          </div>
        </header>

        <nav className={styles.tabRail}>
          {DESKTOP_PRIMARY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`${styles.tabButton} ${activeTab === tab.key ? styles.tabButtonActive : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className={styles.tabIcon}>{iconForTab(tab.key)}</span>
              <span>{tab.label}</span>
            </button>
          ))}
          <button
            type="button"
            className={`${styles.tabButton} ${mobileMoreActive || mobileMoreOpen ? styles.tabButtonActive : ""}`}
            onClick={() => setMobileMoreOpen(true)}
          >
            <span className={styles.tabIcon}>{iconForNavKey("more")}</span>
            <span>More</span>
          </button>
        </nav>

        <section className={styles.screen}>
          <div className={styles.topAppBar}>
            <div>
              <p className={styles.topAppBarLabel}>Whelm Flow</p>
              <h2 className={styles.topAppBarTitle}>{tabTitle(activeTab)}</h2>
            </div>
            <div className={styles.topAppBarRight}>
              <span className={styles.topAppBarDate}>
                {new Date().toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <button
                type="button"
                className={`${styles.profileDockButton} ${
                  isMobileViewport ? styles.profileDockButtonMobile : styles.profileDockButtonDesktop
                }`}
                onClick={() => setProfileOpen(true)}
              >
                <WhelmProfileAvatar tierColor={streakBandanaTier?.color} size="compact" isPro={isPro} />
                <span className={styles.profileDockCopy}>
                  {!isMobileViewport ? <small>Profile</small> : null}
                  <strong>{profileDisplayName}</strong>
                </span>
              </button>
              {!isMobileViewport ? (
                <button
                  type="button"
                  className={styles.topAppBarAction}
                  onClick={() => setMobileMoreOpen(true)}
                >
                  More
                </button>
              ) : null}
            </div>
          </div>

          {activeTab === "today" && (
            <>
              {isMobileViewport && <section className={styles.mobileTodayStack}>
                <article className={styles.mobileSummaryCard} ref={todaySummaryRef}>
                  <div className={styles.mobileSummaryHeader}>
                    <div>
                      <p className={styles.sectionLabel}>Whelm Flow</p>
                      <p className={styles.accountMeta}>Act before analysis. Protect the run and keep momentum visible.</p>
                    </div>
                    <button
                      type="button"
                      className={styles.reportButton}
                      onClick={handleTodayPrimaryAction}
                    >
                      {senseiGuidance.actionLabel}
                    </button>
                  </div>
                  <div className={styles.mobileSummaryGrid}>
                    <div className={styles.mobileSummaryItem}>
                      <span className={styles.mobileSummaryLabel}>Focus</span>
                      <strong>{focusMetrics.todayMinutes}m</strong>
                    </div>
                    <div className={styles.mobileSummaryItem}>
                      <span className={styles.mobileSummaryLabel}>Sessions</span>
                      <strong>{focusMetrics.todaySessions}</strong>
                    </div>
                    <div className={styles.mobileSummaryItem}>
                      <span className={styles.mobileSummaryLabel}>Streak</span>
                      <strong>{streak}d</strong>
                    </div>
                  </div>
                </article>

                <div className={styles.mobileTimerWrap} ref={todayTimerRef}>
                  <Timer
                    minutes={30}
                    title={FOCUS_TIMER.title}
                    actionLabel={FOCUS_TIMER.actionLabel}
                    theme={FOCUS_TIMER.theme}
                    appearance={themeMode}
                    sessionNoteCount={todaySessionNoteCount}
                    onOpenSessionNotes={() => setActiveTab("history")}
                    streakMinimumMinutes={30}
                    onSessionStart={handleSessionStarted}
                    onSessionAbandon={handleSessionAbandoned}
                    onComplete={(note, minutesSpent, sessionContext) =>
                      completeSession(note, minutesSpent, sessionContext)
                    }
                  />
                </div>
              </section>}

              <section className={styles.statsGrid}>
                <article className={styles.statCard}>
                  <span className={styles.statLabel}>Discipline Score</span>
                  <strong className={styles.statValue}>
                    {focusMetrics.disciplineScore}
                    <span className={styles.statSuffix}>/100</span>
                  </strong>
                </article>
                <article className={styles.statCard}>
                  <span className={styles.statLabel}>Focus Today</span>
                  <strong className={styles.statValue}>{focusMetrics.todayMinutes}m</strong>
                </article>
                <article className={styles.statCard}>
                  <span className={styles.statLabel}>Current Streak</span>
                  <strong className={styles.statValue}>
                    {streak} day{streak === 1 ? "" : "s"}
                  </strong>
                </article>
                <article className={styles.statCard}>
                  <span className={styles.statLabel}>Focus Week</span>
                  <strong className={styles.statValueSmall}>{focusMetrics.weekMinutes} minutes</strong>
                </article>
              </section>

              {!isPro && (
                <section className={styles.adStrip}>
                  <p className={styles.adBadge}>Whelm Pro</p>
                  <p className={styles.adCopy}>
                    Advanced analytics and premium discipline tools are coming soon.
                  </p>
                  <button type="button" className={styles.inlineUpgrade} onClick={openUpgradeFlow}>
                    See what&apos;s coming
                  </button>
                </section>
              )}

              <section className={styles.mainGrid}>
                <article
                  className={`${styles.card} ${styles.senseiCard} ${styles[`senseiCard${senseiGuidance.tone[0].toUpperCase()}${senseiGuidance.tone.slice(1)}`]}`}
                >
                  <div className={styles.senseiRitualBackdrop}>
                    <WhelmRitualScene variant="orb" />
                  </div>
                  <div className={styles.senseiCardHeader}>
                    <SenseiAvatar
                      message={todayHeroCopy.eyebrow}
                      variant="neutral"
                      emoteVideoSrc="/emotes/welcomeemoting.mp4"
                      autoPlayEmote
                    />
                    <div className={styles.senseiDialogueStack}>
                      <div className={styles.senseiSpeechPanel}>
                        <p className={styles.senseiSpeechEyebrow}>Whelm</p>
                        <p className={styles.senseiGreeting}>{todayHeroCopy.title}</p>
                        <p className={styles.senseiMessage}>{todayHeroCopy.body}</p>
                        <p className={styles.senseiSignature}>"{todayHeroCopy.signatureLine}"</p>
                      </div>
                    </div>
                  </div>
                  <div className={styles.senseiMetrics}>
                    <span className={styles.senseiMetricPill}>
                      Presence: {formatSenseiLabel(companionState.stage)}
                    </span>
                    <span className={styles.senseiMetricPill}>
                      Stance: {formatSenseiLabel(senseiGuidance.ritual)}
                    </span>
                    <span className={styles.senseiMetricPill}>
                      Tone: {formatSenseiLabel(senseiGuidance.voiceMode)}
                    </span>
                    <span className={styles.senseiMetricPill}>
                      Today: {focusMetrics.todaySessions} session
                      {focusMetrics.todaySessions === 1 ? "" : "s"}
                    </span>
                    <span className={styles.senseiMetricPill}>Streak: {streak}d</span>
                    <span className={styles.senseiMetricPill}>
                      Ready: {todayActivePlannedBlocks.length}
                    </span>
                    {nextSenseiMilestone.next ? (
                      <span className={styles.senseiMetricPill}>
                        Next mark: {nextSenseiMilestone.next} ({nextSenseiMilestone.remaining} left)
                      </span>
                    ) : (
                      <span className={styles.senseiMetricPill}>Legend tier unlocked</span>
                    )}
                  </div>
                  <div className={styles.senseiActionRow}>
                    <button
                      type="button"
                      className={styles.reportButton}
                      onClick={handleTodayPrimaryAction}
                    >
                      {senseiGuidance.actionLabel}
                    </button>
                    <span className={styles.accountMeta}>
                      Whelm is directing your next move toward {tabTitle(senseiGuidance.actionTab as AppTab)}.
                    </span>
                  </div>
                  {senseiReaction && <p className={styles.senseiReaction}>{senseiReaction}</p>}
                </article>

                <div className={styles.leftColumn}>
                  <Timer
                    minutes={30}
                    title={FOCUS_TIMER.title}
                    actionLabel={FOCUS_TIMER.actionLabel}
                    theme={FOCUS_TIMER.theme}
                    appearance={themeMode}
                    sessionNoteCount={todaySessionNoteCount}
                    onOpenSessionNotes={() => setActiveTab("history")}
                    streakMinimumMinutes={30}
                    onSessionStart={handleSessionStarted}
                    onSessionAbandon={handleSessionAbandoned}
                    onComplete={(note, minutesSpent, sessionContext) =>
                      completeSession(note, minutesSpent, sessionContext)
                    }
                  />

                  <article className={styles.card}>
                    <div className={styles.cardHeader}>
                      <div>
                        <p className={styles.sectionLabel}>Command Center</p>
                        <h2 className={styles.cardTitle}>Whelm Flow board</h2>
                      </div>
                      <button type="button" className={styles.reportButton} onClick={() => void copyWeeklyReport()}>
                        {reportCopyStatus || "Copy weekly report"}
                      </button>
                    </div>
                    <ul className={styles.commandList}>
                      <li>
                        <strong>{focusMetrics.todaySessions}</strong> sessions completed
                      </li>
                      <li>
                        <strong>{focusMetrics.todayMinutes}m</strong> focused
                      </li>
                      <li>
                        Last session:{" "}
                        <strong>
                          {lastSession
                            ? new Date(lastSession.completedAtISO).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : "not started"}
                        </strong>
                      </li>
                      <li>
                        <strong>{orderedNotes.filter((note) => note.isPinned).length}</strong> pinned notes
                      </li>
                    </ul>
                  </article>
                </div>

                <aside className={styles.rightColumn}>
                  <article className={styles.card}>
                    <p className={styles.sectionLabel}>Quick Notes</p>
                    <h2 className={styles.cardTitle}>Capture fast</h2>
                    <div className={styles.quickNoteList}>
                      {orderedNotes.slice(0, 4).map((note) => (
                        <button
                          key={note.id}
                          type="button"
                          className={styles.quickNoteItem}
                            onClick={() => {
                              setSelectedNoteId(note.id);
                              openNotesTab();
                            }}
                          style={{ backgroundColor: note.color || "#f8fafc" }}
                        >
                          <strong>{note.title || "Untitled note"}</strong>
                          <span>{new Date(note.updatedAtISO).toLocaleDateString()}</span>
                        </button>
                      ))}
                      {orderedNotes.length === 0 && (
                        <p className={styles.emptyText}>No notes yet. Create your first note.</p>
                      )}
                    </div>
                    <button type="button" className={styles.newNoteButton} onClick={createWorkspaceNote}>
                      + Add Note
                    </button>
                  </article>

                  <article className={styles.card}>
                    <p className={styles.sectionLabel}>Due Today</p>
                    <h2 className={styles.cardTitle}>Note reminders</h2>
                    {dueReminderNotes.length === 0 ? (
                      <p className={styles.emptyText}>No note reminders due today.</p>
                    ) : (
                      <div className={styles.reminderList}>
                        {dueReminderNotes.slice(0, 5).map((note) => (
                          <button
                            key={note.id}
                            type="button"
                            className={styles.reminderItem}
                            onClick={() => {
                              setSelectedNoteId(note.id);
                              openNotesTab();
                            }}
                          >
                            <strong>{note.title || "Untitled note"}</strong>
                            <span>
                              {new Date(note.reminderAtISO || "").toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </article>

                  <article className={styles.card}>
                    <p className={styles.sectionLabel}>Plan</p>
                    <p className={styles.accountMeta}>
                      {isPro ? "Whelm Pro" : "Whelm Free"}
                    </p>
                    <p className={styles.accountMeta}>{user.email}</p>
                    {!isPro && (
                      <button type="button" className={styles.inlineUpgrade} onClick={openUpgradeFlow}>
                        Whelm Pro coming soon
                      </button>
                    )}
                  </article>
                </aside>
              </section>
            </>
          )}

          {activeTab === "calendar" && (
            <section className={styles.calendarGrid}>
              <article
                className={`${styles.card} ${calendarView === "month" ? styles.calendarPrimaryExpanded : ""}`}
                ref={calendarMonthRef}
              >
                <div className={styles.calendarPrimaryHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Primary View</p>
                    <h2 className={styles.cardTitle}>Command board</h2>
                  </div>
                  {isMobileViewport && (
                    <button
                      type="button"
                      className={styles.mobileStreakJump}
                      onClick={() => {
                        setMobileMoreOpen(false);
                        setActiveTab("streaks");
                      }}
                    >
                      <span className={styles.mobileStreakJumpLabel}>Streak</span>
                      <strong>{streak}d</strong>
                    </button>
                  )}
                </div>
                {!isMobileViewport && (
                  <p className={styles.accountMeta}>
                    Start here first. Whelm stays nearby, but the calendar leads the page.
                  </p>
                )}
                <div className={styles.calendarToolbar}>
                  <div className={styles.calendarNav}>
                    <button
                      type="button"
                      className={styles.secondaryPlanButton}
                      onClick={() => setCalendarCursor((current) => shiftMonth(current, -1))}
                    >
                      Prev
                    </button>
                    <strong className={styles.calendarMonthLabel}>{calendarMonthLabel}</strong>
                    <button
                      type="button"
                      className={styles.secondaryPlanButton}
                      onClick={() => setCalendarCursor((current) => shiftMonth(current, 1))}
                    >
                      Next
                    </button>
                  </div>
                  <div className={styles.compactToolbarRow}>
                    <div className={styles.calendarViewSwitch}>
                      <button
                        type="button"
                        className={`${styles.calendarViewButton} ${
                          calendarView === "month" ? styles.calendarViewButtonActive : ""
                        }`}
                        onClick={() => setCalendarView("month")}
                      >
                        Month
                      </button>
                      <button
                        type="button"
                        className={`${styles.calendarViewButton} ${
                          calendarView === "day" ? styles.calendarViewButtonActive : ""
                        }`}
                        onClick={() => setCalendarView("day")}
                      >
                        Day
                      </button>
                    </div>
                    <div className={styles.mobileInlineActions}>
                      {isMobileViewport && calendarView !== "day" && (
                        <button
                          type="button"
                          className={styles.calendarSectionButton}
                          onClick={() => setMobileCalendarControlsOpen((open) => !open)}
                        >
                          {mobileCalendarControlsOpen ? "Hide controls" : "Jump"}
                        </button>
                      )}
                    </div>
                  </div>
                  {(!isMobileViewport || mobileCalendarControlsOpen) && (
                    <div className={styles.calendarJumpRow}>
                      <label className={isMobileViewport ? styles.mobileControlField : styles.planLabel}>
                        <span>{isMobileViewport ? "Month" : "Month / Year"}</span>
                        <input
                          type="month"
                          className={styles.planControl}
                          value={calendarMonthInput}
                          onChange={(event) => {
                            const next = parseMonthInput(event.target.value);
                            if (!next) return;
                            setCalendarCursor(next);
                          }}
                        />
                      </label>
                      <label className={isMobileViewport ? styles.mobileControlField : styles.planLabel}>
                        <span>{isMobileViewport ? "Date" : "Jump to date"}</span>
                        <input
                          type="date"
                          className={styles.planControl}
                          value={calendarJumpDate}
                          onChange={(event) => setCalendarJumpDate(event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className={styles.planAddButton}
                        onClick={() => {
                          if (!calendarJumpDate) return;
                          selectCalendarDate(calendarJumpDate);
                        }}
                      >
                        Go
                      </button>
                    </div>
                  )}
                  {!isMobileViewport && (
                    <div className={styles.calendarSectionNav}>
                      <button
                        type="button"
                        className={styles.calendarSectionButton}
                        onClick={() => setCalendarAuxPanel("guide")}
                      >
                        Guide
                      </button>
                      <button
                        type="button"
                        className={styles.calendarSectionButton}
                        onClick={() => setCalendarAuxPanel("streak")}
                      >
                        Streak
                      </button>
                      <button
                        type="button"
                        className={styles.calendarSectionButton}
                        onClick={() => setCalendarAuxPanel("agenda")}
                      >
                        Agenda
                      </button>
                    </div>
                  )}
                </div>
                {calendarView === "month" ? (
                  <>
                    <div id="calendar-main-view" className={styles.calendarHeader}>
                      <span>Sun</span>
                      <span>Mon</span>
                      <span>Tue</span>
                      <span>Wed</span>
                      <span>Thu</span>
                      <span>Fri</span>
                      <span>Sat</span>
                    </div>
                    <div className={styles.monthGrid}>
                      {dynamicMonthCalendar.map((day) => (
                        <button
                          type="button"
                          key={day.key}
                          className={`${styles.monthDayCell} ${styles[`streakLevel${day.level}`]} ${
                            day.dayNumber && day.key === selectedDateKey ? styles.monthDayCellSelected : ""
                          }`}
                          disabled={!day.dayNumber}
                          title={
                            day.dayNumber
                              ? `${day.dayNumber}: ${day.minutes}m focus, ${
                                  (calendarEntriesByDate.get(day.key) ?? []).length
                                } entries`
                              : "Outside current month"
                          }
                          onClick={() => {
                            if (!day.dayNumber) return;
                            selectCalendarDate(day.key);
                          }}
                        >
                          {day.dayNumber && (
                            <>
                              <div className={styles.monthDayHead}>
                                <span className={styles.monthDayNumber}>{day.dayNumber}</span>
                                <span className={styles.monthDayMinutes}>{day.minutes}m</span>
                              </div>
                              <div className={styles.monthEntries}>
                                {(calendarEntriesByDate.get(day.key) ?? []).slice(0, 2).map((entry) => (
                                  <button
                                    key={entry.id}
                                    type="button"
                                    className={`${styles.monthEntryChip} ${
                                      styles[`monthEntry${entry.tone}`]
                                    }`}
                                    onMouseEnter={() => setCalendarHoverEntryId(entry.id)}
                                    onMouseLeave={() => setCalendarHoverEntryId((current) =>
                                      current === entry.id ? null : current,
                                    )}
                                    onFocus={() => setCalendarHoverEntryId(entry.id)}
                                    onBlur={() => setCalendarHoverEntryId((current) =>
                                      current === entry.id ? null : current,
                                    )}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      selectCalendarDate(day.key);
                                      setCalendarPinnedEntryId((current) =>
                                        current === entry.id ? null : entry.id,
                                      );
                                    }}
                                  >
                                    {entry.timeLabel} {entry.title}
                                  </button>
                                ))}
                                {(calendarEntriesByDate.get(day.key) ?? []).length > 2 && (
                                  <span className={styles.monthMoreChip}>
                                    +{(calendarEntriesByDate.get(day.key) ?? []).length - 2} more
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                    <div className={styles.dayViewShell}>
                    <div id="calendar-day-chamber" className={styles.dayPortalCard}>
                      <div className={styles.dayPortalBody}>
                        <div className={styles.dayPortalCopy}>
                          <div className={styles.dayPortalHeader}>
                            <div>
                              <p className={styles.sectionLabel}>
                                {isSelectedDateToday ? "Today Chamber" : selectedDateSummary.eyebrow}
                              </p>
                              <h3 className={styles.dayPortalTitle}>{selectedDateSummary.title}</h3>
                            </div>
                            <div className={styles.dayPortalActions}>
                              <button
                                type="button"
                                className={`${styles.planAddButton} ${styles.dayPortalBlockButton}`}
                                onClick={openCalendarBlockComposer}
                              >
                                + Block
                              </button>
                              <button
                                type="button"
                                className={styles.secondaryPlanButton}
                                onClick={() => setCalendarView("month")}
                              >
                                Back to month
                              </button>
                              {isMobileViewport && (
                                <button
                                  type="button"
                                  className={styles.calendarSectionButton}
                                  onClick={() => setMobileCalendarControlsOpen((open) => !open)}
                                >
                                  Jump
                                </button>
                              )}
                            </div>
                          </div>
                          {!isMobileViewport && (
                            <p className={styles.dayPortalMeta}>{selectedDateSummary.body}</p>
                          )}
                          {!isMobileViewport && (
                            <div className={styles.dayPortalStats}>
                              <span className={styles.dayPortalPill}>
                                Focus: {selectedDateFocusedMinutes}m
                              </span>
                              <span className={styles.dayPortalPill}>
                                Plans: {selectedDatePlans.length}
                              </span>
                              <span className={styles.dayPortalPill}>
                                Entries: {selectedDateEntries.length}
                              </span>
                            </div>
                          )}
                          {!isMobileViewport && dayPortalComposerOpen && (
                            <div id="calendar-planner" className={styles.dayPortalComposer}>
                              <div className={styles.dayPortalComposerHeader}>
                                <div>
                                  <p className={styles.sectionLabel}>Add Block</p>
                                  <p className={styles.accountMeta}>
                                    Place the next block without leaving the day view.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  className={styles.secondaryPlanButton}
                                  onClick={() => setDayPortalComposerOpen(false)}
                                >
                                  Close
                                </button>
                              </div>
                              <input
                                value={planTitle}
                                onChange={(event) => setPlanTitle(event.target.value)}
                                placeholder="Task title (e.g. Deep work sprint)"
                                className={styles.planInput}
                              />
                              <div className={styles.planNoteRow}>
                                <button
                                  type="button"
                                  className={styles.planNoteToggle}
                                  onClick={() => setPlanNoteExpanded((current) => !current)}
                                >
                                  {planNoteExpanded || planNote ? "Hide note" : "+ Note"}
                                </button>
                              </div>
                              {planNoteExpanded && (
                                <textarea
                                  value={planNote}
                                  onChange={(event) => setPlanNote(event.target.value.slice(0, 280))}
                                  placeholder="Optional note, intention, or instruction for this block"
                                  className={styles.planNoteInput}
                                />
                              )}
                              {planConflictWarning && (
                                <div className={styles.planConflictBanner}>
                                  <p className={styles.planConflictText}>{planConflictWarning.message}</p>
                                  <div className={styles.planConflictActions}>
                                    <button
                                      type="button"
                                      className={styles.secondaryPlanButton}
                                      onClick={() => setPlanConflictWarning(null)}
                                    >
                                      Close
                                    </button>
                                  </div>
                                </div>
                              )}
                              <div className={styles.planFormRow}>
                                <label className={styles.planLabel}>
                                  Time
                                  <input
                                    type="time"
                                    value={planTime}
                                    onChange={(event) => setPlanTime(event.target.value)}
                                    className={styles.planControl}
                                  />
                                </label>
                                <label className={styles.planLabel}>
                                  Minutes
                                  <input
                                    type="number"
                                    min={MIN_PLANNED_BLOCK_MINUTES}
                                    max={MAX_PLANNED_BLOCK_MINUTES}
                                    value={planDuration}
                                    onChange={(event) => {
                                      const next = Number(event.target.value);
                                      if (Number.isFinite(next)) {
                                        setPlanDuration(next);
                                      }
                                    }}
                                    className={styles.planControl}
                                  />
                                </label>
                                <button
                                  type="button"
                                  className={`${styles.planAddButton} ${styles.blockActionButton}`}
                                  onClick={() => {
                                    const added = addPlannedBlock();
                                    if (added) {
                                      setDayPortalComposerOpen(false);
                                    }
                                  }}
                                >
                                  Add Block
                                </button>
                              </div>
                              {planStatus && <p className={styles.accountMeta}>{planStatus}</p>}
                            </div>
                          )}
                        </div>
                        {!isMobileViewport && (
                          <SenseiAvatar
                            message={
                              selectedDateEntries.length === 0
                                ? "Quiet room. Set the tone."
                                : "You entered the day. Now shape it."
                            }
                            variant={calendarDaySenseiVariant({
                              entries: selectedDateEntries,
                              focusedMinutes: selectedDateFocusedMinutes,
                            })}
                            compact
                          />
                        )}
                      </div>
                    </div>
                    <div
                      id="calendar-timeline"
                      className={isMobileViewport ? styles.dayViewScrollShell : undefined}
                      ref={isMobileViewport ? mobileDayTimelineScrollRef : undefined}
                    >
                      <div className={styles.dayViewGrid} ref={calendarTimelineRef}>
                        <div
                          className={styles.dayViewTicks}
                          style={isMobileViewport ? { height: `${mobileDayTimelineHeight}px` } : undefined}
                        >
                          {dayViewTimeline.hourTicks.map((tick) => (
                            <span key={tick.minute}>{tick.label}</span>
                          ))}
                          {currentTimeMarker && (
                            <span
                              className={styles.dayViewNowLabel}
                              style={{ top: `${currentTimeMarker.topPct}%` }}
                            >
                              {currentTimeMarker.label}
                            </span>
                          )}
                        </div>
                        <div
                          className={styles.dayViewTrack}
                          style={isMobileViewport ? { height: `${mobileDayTimelineHeight}px` } : undefined}
                          onClick={() => {
                            setCalendarPinnedEntryId(null);
                            setOverlapPickerEntryId(null);
                          }}
                        >
                          {dayViewTimeline.hourTicks.map((tick) => (
                            <div
                              key={tick.minute}
                              className={styles.dayViewRow}
                              style={{
                                top: `${((tick.minute - dayViewTimeline.startMinute) / dayViewTimeline.totalMinutes) * 100}%`,
                              }}
                            />
                          ))}
                          {currentTimeMarker && (
                            <div
                              className={styles.dayViewNowLine}
                              style={{ top: `${currentTimeMarker.topPct}%` }}
                            >
                              <span className={styles.dayViewNowDot} />
                            </div>
                          )}
                          {dayViewTimeline.items.map((entry) => (
                            <button
                              type="button"
                              key={`timeline-${entry.id}`}
                              data-calendar-entry-id={entry.id}
                              className={`${styles.dayViewEvent} ${styles[`dayViewEvent${entry.tone}`]} ${
                                isMobileViewport ? styles.dayViewEventMobile : ""
                              } ${entry.durationMinutes < 40 ? styles.dayViewEventCompact : ""} ${
                                activatedCalendarEntryId === entry.id ? styles.dayViewEventActivated : ""
                              }`}
                              style={{
                                top: `${entry.topPct}%`,
                                height: `${entry.heightPct}%`,
                              }}
                              onMouseEnter={() => showCalendarHoverPreview(entry.id)}
                              onMouseLeave={() => scheduleCalendarHoverPreviewClear(entry.id)}
                              onFocus={() => showCalendarHoverPreview(entry.id)}
                              onBlur={() => scheduleCalendarHoverPreviewClear(entry.id)}
                              onClick={(event) => {
                                event.stopPropagation();
                                clearCalendarHoverPreviewDelay();
                                setCalendarPinnedEntryId((current) => (current === entry.id ? null : entry.id))
                              }}
                            >
                              <span className={styles.dayViewEventTime}>{entry.timeLabel}</span>
                              <strong>{entry.title}</strong>
                              {entry.overlapIds.length > 0 && (
                                <span
                                  className={styles.dayViewOverlapHandle}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    clearCalendarHoverPreviewDelay();
                                    setCalendarHoverEntryId(null);
                                    setCalendarPinnedEntryId(null);
                                    setOverlapPickerEntryId((current) =>
                                      current === entry.id ? null : entry.id,
                                    );
                                  }}
                                >
                                  {entry.overlapIds.slice(0, 3).map((overlapId, index) => {
                                    const overlapEntry = dayViewTimeline.items.find((item) => item.id === overlapId);
                                    if (!overlapEntry) return null;
                                    return (
                                      <span
                                        key={overlapId}
                                        className={`${styles.dayViewOverlapSlice} ${
                                          styles[`dayViewOverlapSlice${overlapEntry.tone}`]
                                        }`}
                                        style={{ right: `${index * 8}px` }}
                                      />
                                    );
                                  })}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                        {activeOverlapPickerItem && activeOverlapPickerItem.overlapIds.length > 0 && (
                          <div
                            className={`${styles.overlapPicker} ${
                              activeOverlapPickerItem.topPct + activeOverlapPickerItem.heightPct / 2 > 55
                                ? styles.overlapPickerAbove
                                : styles.overlapPickerBelow
                            }`}
                            style={
                              activeOverlapPickerItem.topPct + activeOverlapPickerItem.heightPct / 2 > 55
                                ? {
                                    bottom: `calc(${100 - activeOverlapPickerItem.topPct + 2}%)`,
                                  }
                                : {
                                    top: `calc(${
                                      Math.min(
                                        92,
                                        activeOverlapPickerItem.topPct + activeOverlapPickerItem.heightPct + 2,
                                      )
                                    }%)`,
                                  }
                            }
                            onClick={(event) => event.stopPropagation()}
                          >
                            <p className={styles.overlapPickerLabel}>Overlapping blocks</p>
                            <div className={styles.overlapPickerList}>
                              {[activeOverlapPickerItem.id, ...activeOverlapPickerItem.overlapIds].map((optionId) => {
                                const option = dayViewTimeline.items.find((item) => item.id === optionId);
                                if (!option) return null;
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    className={styles.overlapPickerItem}
                                    onClick={() => {
                                      setOverlapPickerEntryId(null);
                                      setCalendarPinnedEntryId(option.id);
                                      showCalendarHoverPreview(option.id);
                                    }}
                                  >
                                    <span
                                      className={`${styles.overlapPickerSwatch} ${
                                        styles[`dayViewOverlapSlice${option.tone}`]
                                      }`}
                                    />
                                    <span>{option.timeLabel}</span>
                                    <strong>{option.title}</strong>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {!isMobileViewport && activeCalendarPreview && activeDayViewPreviewItem && (
                          <div
                            className={`${styles.calendarEntryPopover} ${
                              calendarPinnedEntryId ? styles.calendarEntryPopoverPinned : ""
                            } ${
                              activeDayViewPreviewItem.topPct + activeDayViewPreviewItem.heightPct / 2 > 55
                                ? styles.calendarEntryPopoverAbove
                                : styles.calendarEntryPopoverBelow
                            }`}
                            style={
                              activeDayViewPreviewItem.topPct + activeDayViewPreviewItem.heightPct / 2 > 55
                                ? {
                                    bottom: `calc(${100 - activeDayViewPreviewItem.topPct + 2}%)`,
                                  }
                                : {
                                    top: `calc(${
                                      Math.min(
                                        92,
                                        activeDayViewPreviewItem.topPct + activeDayViewPreviewItem.heightPct + 2,
                                      )
                                    }%)`,
                                  }
                            }
                            onMouseEnter={() => {
                              if (!calendarPinnedEntryId) {
                                showCalendarHoverPreview(activeCalendarPreview.id);
                              }
                            }}
                            onMouseLeave={() => {
                              if (!calendarPinnedEntryId) {
                                scheduleCalendarHoverPreviewClear(activeCalendarPreview.id);
                              }
                            }}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div>
                              <p className={styles.calendarEntryPreviewLabel}>
                                {new Date(`${activeCalendarPreview.dateKey}T00:00:00`).toLocaleDateString(
                                  undefined,
                                  { weekday: "short", month: "short", day: "numeric" },
                                )}{" "}
                                • {activeCalendarPreview.timeLabel}
                              </p>
                              <h3 className={styles.calendarEntryPreviewTitle}>
                                {activeCalendarPreview.title}
                              </h3>
                              <p className={styles.calendarEntryPreviewBody}>
                                {activeCalendarPreview.preview}
                              </p>
                            </div>
                            <div className={styles.calendarEntryPreviewActions}>
                              {activeCalendarPreview.source === "reminder" && activeCalendarPreview.noteId && (
                                <button
                                  type="button"
                                  className={styles.secondaryPlanButton}
                                  onClick={() => {
                                    setSelectedNoteId(activeCalendarPreview.noteId ?? null);
                                    openNotesTab();
                                  }}
                                >
                                  Open note
                                </button>
                              )}
                              {activeCalendarPreview.source === "plan" && activeCalendarPreview.planId && (
                                <button
                                  type="button"
                                  className={styles.planCompleteButton}
                                  onClick={() => {
                                    const plan = plannedBlockById.get(activeCalendarPreview.planId ?? "");
                                    if (!plan) return;
                                    void completePlannedBlock(plan);
                                  }}
                                >
                                  Complete
                                </button>
                              )}
                              {activeCalendarPreview.source === "session" && (
                                <button
                                  type="button"
                                  className={styles.secondaryPlanButton}
                                  onClick={() => setActiveTab("history")}
                                >
                                  View history
                                </button>
                              )}
                              <button
                                type="button"
                                className={styles.secondaryPlanButton}
                                onClick={() => setCalendarPinnedEntryId(null)}
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {isMobileViewport && activeCalendarPreview && (
                      <div className={styles.calendarEntryPreview}>
                        <div>
                          <p className={styles.calendarEntryPreviewLabel}>
                            {new Date(`${activeCalendarPreview.dateKey}T00:00:00`).toLocaleDateString(
                              undefined,
                              { weekday: "short", month: "short", day: "numeric" },
                            )}{" "}
                            • {activeCalendarPreview.timeLabel}
                          </p>
                          <h3 className={styles.calendarEntryPreviewTitle}>
                            {activeCalendarPreview.title}
                          </h3>
                          <p className={styles.calendarEntryPreviewBody}>
                            {activeCalendarPreview.preview}
                          </p>
                        </div>
                        <div className={styles.calendarEntryPreviewActions}>
                          {activeCalendarPreview.source === "reminder" && activeCalendarPreview.noteId && (
                            <button
                              type="button"
                              className={styles.secondaryPlanButton}
                              onClick={() => {
                                setSelectedNoteId(activeCalendarPreview.noteId ?? null);
                                openNotesTab();
                              }}
                            >
                              Open note
                            </button>
                          )}
                          {activeCalendarPreview.source === "plan" && activeCalendarPreview.planId && (
                            <button
                              type="button"
                              className={styles.planCompleteButton}
                              onClick={() => {
                                const plan = plannedBlockById.get(activeCalendarPreview.planId ?? "");
                                if (!plan) return;
                                void completePlannedBlock(plan);
                              }}
                            >
                              Complete
                            </button>
                          )}
                          {activeCalendarPreview.source === "session" && (
                            <button
                              type="button"
                              className={styles.secondaryPlanButton}
                              onClick={() => setActiveTab("history")}
                            >
                              View history
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.secondaryPlanButton}
                            onClick={() => setCalendarPinnedEntryId(null)}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {calendarView !== "day" && activeCalendarPreview && (
                  <div className={styles.calendarEntryPreview}>
                    <div>
                      <p className={styles.calendarEntryPreviewLabel}>
                        {new Date(`${activeCalendarPreview.dateKey}T00:00:00`).toLocaleDateString(
                          undefined,
                          { weekday: "short", month: "short", day: "numeric" },
                        )}{" "}
                        • {activeCalendarPreview.timeLabel}
                      </p>
                      <h3 className={styles.calendarEntryPreviewTitle}>
                        {activeCalendarPreview.title}
                      </h3>
                      <p className={styles.calendarEntryPreviewBody}>
                        {activeCalendarPreview.preview}
                      </p>
                    </div>
                    <div className={styles.calendarEntryPreviewActions}>
                      {activeCalendarPreview.source === "reminder" && activeCalendarPreview.noteId && (
                        <button
                          type="button"
                          className={styles.secondaryPlanButton}
                          onClick={() => {
                            setSelectedNoteId(activeCalendarPreview.noteId ?? null);
                            openNotesTab();
                          }}
                        >
                          Open note
                        </button>
                      )}
                      {activeCalendarPreview.source === "plan" && activeCalendarPreview.planId && (
                        <button
                          type="button"
                          className={styles.planCompleteButton}
                          onClick={() => {
                            const plan = plannedBlockById.get(activeCalendarPreview.planId ?? "");
                            if (!plan) return;
                            void completePlannedBlock(plan);
                          }}
                        >
                          Complete
                        </button>
                      )}
                      {activeCalendarPreview.source === "session" && (
                        <button
                          type="button"
                          className={styles.secondaryPlanButton}
                          onClick={() => setActiveTab("history")}
                        >
                          View history
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.secondaryPlanButton}
                        onClick={() => setCalendarPinnedEntryId(null)}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </article>

              {!isMobileViewport && (
              <article className={`${styles.card} ${styles.calendarAuxCard}`} ref={calendarPlannerRef}>
                <div className={styles.calendarAuxTabs}>
                  <button
                    type="button"
                    className={`${styles.calendarAuxTab} ${
                      calendarAuxPanel === "agenda" ? styles.calendarAuxTabActive : ""
                    }`}
                    onClick={() => setCalendarAuxPanel("agenda")}
                  >
                    Agenda
                  </button>
                  <button
                    type="button"
                    className={`${styles.calendarAuxTab} ${
                      calendarAuxPanel === "streak" ? styles.calendarAuxTabActive : ""
                    }`}
                    onClick={() => setCalendarAuxPanel("streak")}
                  >
                    Streak
                  </button>
                  <button
                    type="button"
                    className={`${styles.calendarAuxTab} ${
                      calendarAuxPanel === "guide" ? styles.calendarAuxTabActive : ""
                    }`}
                    onClick={() => setCalendarAuxPanel("guide")}
                  >
                    Guide
                  </button>
                </div>

                {calendarAuxPanel === "guide" && (
                  <div ref={calendarHeroRef}>
                    <CompanionPulse {...companionState.pulses.calendar} />
                  </div>
                )}

                {calendarAuxPanel === "streak" && (
                  <>
                    <p className={styles.sectionLabel}>Last 4 Weeks</p>
                    <h2 className={styles.cardTitle}>Streak heatmap</h2>
                    <div className={styles.streakGrid}>
                      {focusMetrics.calendar.map((day, index, days) => {
                        const previous = days[index - 1];
                        const next = days[index + 1];
                        const historicalStreakLength = historicalStreaksByDay.get(day.dateKey) ?? 0;
                        const streakDay = historicalStreakLength > 0;
                        const leftConnected =
                          streakDay &&
                          index % 14 !== 0 &&
                          (historicalStreaksByDay.get(previous?.dateKey ?? "") ?? 0) > 0;
                        const rightConnected =
                          streakDay &&
                          index % 14 !== 13 &&
                          (historicalStreaksByDay.get(next?.dateKey ?? "") ?? 0) > 0;

                        return (
                          <div
                            key={day.dateKey}
                            className={[
                              styles.streakCell,
                              styles[`streakLevel${day.level}`],
                              streakDay ? styles.streakCellRun : "",
                              leftConnected ? styles.streakCellConnectLeft : "",
                              rightConnected ? styles.streakCellConnectRight : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            title={`${day.label}: ${day.minutes}m`}
                          >
                            {streakDay ? <StreakBandana streakDays={historicalStreakLength} /> : null}
                          </div>
                        );
                      })}
                    </div>
                    <div className={styles.streakLegend}>
                      <span>No focus</span>
                      <span>Light</span>
                      <span>Strong</span>
                      <span>Deep</span>
                    </div>
                    <p className={styles.streakLegendNote}>Moving bandana = streak day</p>
                  </>
                )}

                {calendarAuxPanel === "agenda" && (
                  <>
                    <p className={styles.sectionLabel}>Scheduler</p>
                    <h2 className={styles.cardTitle}>
                      {isMobileViewport ? "Day overview for " : "Day agenda for "}
                      {new Date(`${selectedDateKey}T00:00:00`).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </h2>
                    <p className={styles.accountMeta}>
                      {selectedDateEntries.length} entries: {selectedDatePlans.length} planned,{" "}
                      {selectedDateEntries.filter((entry) => entry.source === "reminder").length} reminders,{" "}
                      {selectedDateEntries.filter((entry) => entry.source === "session").length} completed sessions
                    </p>

                    {isMobileViewport ? (
                      <>
                        <div className={styles.mobileAgendaSummary}>
                          <div className={styles.mobileAgendaStat}>
                            <span>Blocks</span>
                            <strong>{selectedDatePlans.length}</strong>
                          </div>
                          <div className={styles.mobileAgendaStat}>
                            <span>Reminders</span>
                            <strong>
                              {selectedDateEntries.filter((entry) => entry.source === "reminder").length}
                            </strong>
                          </div>
                          <div className={styles.mobileAgendaStat}>
                            <span>Focus</span>
                            <strong>{selectedDateFocusedMinutes}m</strong>
                          </div>
                        </div>

                        <section className={styles.planSection}>
                          <button
                            type="button"
                            className={styles.planSectionHeader}
                            onClick={() => setMobileAgendaEntriesOpen((open) => !open)}
                          >
                            <span>Entries</span>
                            <span>{mobileAgendaEntriesOpen ? "Hide" : selectedDateEntries.length}</span>
                          </button>
                          {mobileAgendaEntriesOpen && (
                            <div className={styles.dayAgendaList}>
                              {selectedDateEntries.length === 0 ? (
                                <p className={styles.emptyText}>No events for this date yet.</p>
                              ) : (
                                selectedDateEntries.slice(0, 6).map((entry) => (
                                  <div key={entry.id} className={styles.dayAgendaItem}>
                                    <div>
                                      <p className={styles.dayAgendaTime}>{entry.timeLabel}</p>
                                      <strong className={styles.dayAgendaTitle}>{entry.title}</strong>
                                      <p className={styles.dayAgendaMeta}>{entry.subtitle}</p>
                                    </div>
                                    <div className={styles.dayAgendaActions}>
                                      {entry.source === "reminder" && entry.noteId && (
                                        <button
                                          type="button"
                                          className={styles.secondaryPlanButton}
                                          onClick={() => {
                                            setSelectedNoteId(entry.noteId ?? null);
                                            openNotesTab();
                                          }}
                                        >
                                          Open note
                                        </button>
                                      )}
                                      {entry.source === "plan" && entry.planId && plannedBlockById.get(entry.planId) && (
                                        <button
                                          type="button"
                                          className={styles.planCompleteButton}
                                          onClick={() => {
                                            const plan = plannedBlockById.get(entry.planId ?? "");
                                            if (!plan) return;
                                            void completePlannedBlock(plan);
                                          }}
                                        >
                                          Complete
                                        </button>
                                      )}
                                      {entry.source === "session" && (
                                        <button
                                          type="button"
                                          className={styles.secondaryPlanButton}
                                          onClick={() => setActiveTab("history")}
                                        >
                                          View history
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </section>
                      </>
                    ) : (
                      <div className={styles.dayAgendaList}>
                        {selectedDateEntries.length === 0 ? (
                          <p className={styles.emptyText}>No events for this date yet.</p>
                        ) : (
                          selectedDateEntries.slice(0, 8).map((entry) => (
                            <div key={entry.id} className={styles.dayAgendaItem}>
                              <div>
                                <p className={styles.dayAgendaTime}>{entry.timeLabel}</p>
                                <strong className={styles.dayAgendaTitle}>{entry.title}</strong>
                                <p className={styles.dayAgendaMeta}>{entry.subtitle}</p>
                              </div>
                              <div className={styles.dayAgendaActions}>
                                {entry.source === "reminder" && entry.noteId && (
                                  <button
                                    type="button"
                                    className={styles.secondaryPlanButton}
                                    onClick={() => {
                                      setSelectedNoteId(entry.noteId ?? null);
                                      openNotesTab();
                                    }}
                                  >
                                    Open note
                                  </button>
                                )}
                                {entry.source === "plan" && entry.planId && plannedBlockById.get(entry.planId) && (
                                  <button
                                    type="button"
                                    className={styles.planCompleteButton}
                                    onClick={() => {
                                      const plan = plannedBlockById.get(entry.planId ?? "");
                                      if (!plan) return;
                                      void completePlannedBlock(plan);
                                    }}
                                  >
                                    Complete
                                  </button>
                                )}
                                {entry.source === "session" && (
                                  <button
                                    type="button"
                                    className={styles.secondaryPlanButton}
                                    onClick={() => setActiveTab("history")}
                                  >
                                    View history
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    <div className={styles.planSectionStack}>
                  <section className={styles.planSection}>
                    <button
                      type="button"
                      className={styles.planSectionHeader}
                      onClick={() =>
                        setPlannerSectionsOpen((current) => ({ ...current, active: !current.active }))
                      }
                    >
                      <span>Planned Blocks</span>
                      <span>{selectedDatePlanGroups.visible.length}</span>
                    </button>
                    {plannerSectionsOpen.active && (
                      <div className={styles.planList}>
                        {selectedDatePlanGroups.visible.length === 0 ? (
                          <p className={styles.emptyText}>No planned blocks for this day.</p>
                        ) : (
                          selectedDatePlanGroups.visible.map((item) => {
                            const completed = item.status === "completed";
                            return (
                              <div
                                key={item.id}
                                className={`${completed ? styles.planItemStatic : styles.planItem} ${
                                  completed ? styles.planItemCompleted : ""
                                }`}
                                draggable={!completed}
                                onDragStart={() => {
                                  if (completed) return;
                                  setDraggedPlanId(item.id);
                                }}
                                onDragEnd={() => setDraggedPlanId(null)}
                                onDragOver={(event) => {
                                  if (completed) return;
                                  event.preventDefault();
                                }}
                                onDrop={() => {
                                  if (completed || !draggedPlanId) return;
                                  reorderPlannedBlocks(draggedPlanId, item.id);
                                  setDraggedPlanId(null);
                                }}
                              >
                              <div>
                                <strong>{item.title}</strong>
                                <div className={styles.planMetaRow}>
                                  {completed ? (
                                    <span>{normalizeTimeLabel(item.timeOfDay)}</span>
                                  ) : (
                                    <input
                                      type="time"
                                      value={item.timeOfDay}
                                      className={styles.planItemTime}
                                      onChange={(event) =>
                                        updatePlannedBlockTime(item.id, event.target.value)
                                      }
                                    />
                                  )}
                                  <span>{item.durationMinutes}m</span>
                                </div>
                                {item.note.trim() && <p className={styles.planItemNote}>{item.note}</p>}
                              </div>
                              <div className={styles.planActions}>
                                {completed ? (
                                  <div className={styles.planStatusPill}>Completed</div>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className={styles.planCompleteButton}
                                      onClick={() => void completePlannedBlock(item)}
                                    >
                                      Complete
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.planDeleteButton}
                                      onClick={() => deletePlannedBlock(item.id)}
                                    >
                                      Remove
                                    </button>
                                  </>
                                )}
                              </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </section>

                  <section className={styles.planSection}>
                    <button
                      type="button"
                      className={styles.planSectionHeader}
                      onClick={() =>
                        setPlannerSectionsOpen((current) => ({ ...current, incomplete: !current.incomplete }))
                      }
                    >
                      <span>Incomplete Blocks</span>
                      <span>{selectedDatePlanGroups.incomplete.length}</span>
                    </button>
                    {plannerSectionsOpen.incomplete && (
                      <div className={styles.planList}>
                        {selectedDatePlanGroups.incomplete.length === 0 ? (
                          <p className={styles.emptyText}>No incomplete blocks for this day.</p>
                        ) : (
                          selectedDatePlanGroups.incomplete.map((item) => (
                            <div key={item.id} className={styles.planItemStatic}>
                              <div>
                                <strong>{item.title}</strong>
                                <div className={styles.planMetaRow}>
                                  <span>{normalizeTimeLabel(item.timeOfDay)}</span>
                                  <span>{item.durationMinutes}m</span>
                                </div>
                                {item.note.trim() && <p className={styles.planItemNote}>{item.note}</p>}
                              </div>
                              <div className={styles.planStatusPillMuted}>Incomplete</div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </section>
                    </div>
                  </>
                )}
              </article>
              )}

              {isMobileViewport && mobileBlockSheetOpen && (
                <div
                  className={styles.feedbackOverlay}
                  onClick={() => setMobileBlockSheetOpen(false)}
                >
                  <div
                    className={styles.mobileBlockModal}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className={styles.feedbackHeader}>
                      <div>
                        <p className={styles.sectionLabel}>Time Block</p>
                        <h2 className={styles.feedbackTitle}>
                          Block out{" "}
                          {new Date(`${selectedDateKey}T00:00:00`).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </h2>
                      </div>
                      <button
                        type="button"
                        className={styles.feedbackClose}
                        onClick={() => setMobileBlockSheetOpen(false)}
                      >
                        Close
                      </button>
                    </div>
                    <p className={styles.paywallCopy}>
                      Time blocks are central in Whelm. Add one fast, then return to the calendar.
                    </p>
                    <div className={styles.planForm}>
                      <input
                        value={planTitle}
                        onChange={(event) => setPlanTitle(event.target.value)}
                        placeholder="Task title"
                        className={styles.planInput}
                      />
                      <div className={styles.planNoteRow}>
                        <button
                          type="button"
                          className={styles.planNoteToggle}
                          onClick={() => setPlanNoteExpanded((current) => !current)}
                        >
                          {planNoteExpanded || planNote ? "Hide note" : "+ Note"}
                        </button>
                      </div>
                      {planNoteExpanded && (
                        <textarea
                          value={planNote}
                          onChange={(event) => setPlanNote(event.target.value.slice(0, 280))}
                          placeholder="Optional note, intention, or instruction for this block"
                          className={styles.planNoteInput}
                        />
                      )}
                      {planConflictWarning && (
                        <div className={styles.planConflictBanner}>
                          <p className={styles.planConflictText}>{planConflictWarning.message}</p>
                          <div className={styles.planConflictActions}>
                            <button
                              type="button"
                              className={styles.secondaryPlanButton}
                              onClick={() => setPlanConflictWarning(null)}
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      )}
                      <div className={styles.planFormRow}>
                        <label className={styles.planLabel}>
                          Time
                          <input
                            type="time"
                            value={planTime}
                            onChange={(event) => setPlanTime(event.target.value)}
                            className={styles.planControl}
                          />
                        </label>
                        <label className={styles.planLabel}>
                          Minutes
                          <input
                            type="number"
                            min={MIN_PLANNED_BLOCK_MINUTES}
                            max={MAX_PLANNED_BLOCK_MINUTES}
                            value={planDuration}
                            onChange={(event) => {
                              const next = Number(event.target.value);
                              if (Number.isFinite(next)) {
                                setPlanDuration(next);
                              }
                            }}
                            className={styles.planControl}
                          />
                        </label>
                        <button
                          type="button"
                          className={`${styles.planAddButton} ${styles.blockActionButton}`}
                          onClick={() => {
                            const added = addPlannedBlock();
                            if (added) {
                              setMobileBlockSheetOpen(false);
                            }
                          }}
                        >
                          Add block
                        </button>
                      </div>
                      {planStatus && <p className={styles.accountMeta}>{planStatus}</p>}
                    </div>
                    <div className={styles.mobileBlockList}>
                      {selectedDatePlanGroups.visible.slice(0, 4).map((item) => (
                        <div
                          key={item.id}
                          className={`${styles.mobileBlockItem} ${
                            item.status === "completed" ? styles.mobileBlockItemCompleted : ""
                          }`}
                        >
                          <strong>{item.title}</strong>
                          <span>
                            {item.timeOfDay} • {item.durationMinutes}m
                            {item.status === "completed" ? " • completed" : ""}
                          </span>
                        </div>
                      ))}
                      {selectedDatePlanGroups.visible.length === 0 && (
                        <p className={styles.emptyText}>No blocks yet for this day.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === "notes" && (
            <section className={styles.notesWorkspace}>
              {isMobileViewport && <div className={styles.mobileNotesPanel}>
                <article className={styles.mobileNotesStartCard} ref={notesStartRef}>
                  <div className={styles.mobileNotesStartHeaderCompact}>
                    <div>
                      <p className={styles.sectionLabel}>Writing Studio</p>
                      <h2 className={styles.cardTitle}>Write fast</h2>
                      <p className={styles.accountMeta}>Start a note or reopen one. Nothing else should get in the way.</p>
                    </div>
                    <button
                      type="button"
                      className={styles.newNoteButton}
                      onClick={() => void handleMobileCreateNote()}
                    >
                      New note
                    </button>
                  </div>
                  <div className={styles.mobileNotesActions}>
                    {selectedNoteId && (
                      <button
                        type="button"
                        className={styles.secondaryPlanButton}
                        onClick={handleOpenCurrentMobileNote}
                      >
                        Open current note
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.mobileJumpButton}
                      onClick={() => {
                        setMobileNotesRecentOpen(true);
                        window.setTimeout(() => scrollToSection(notesRecentRef.current), 80);
                      }}
                    >
                      Recent notes
                    </button>
                  </div>
                </article>

                <article className={styles.mobileNotesRecentCard} ref={notesRecentRef}>
                  <button
                    type="button"
                    className={styles.mobileSectionToggle}
                    onClick={() => setMobileNotesRecentOpen((open) => !open)}
                    aria-expanded={mobileNotesRecentOpen}
                  >
                    <div>
                      <p className={styles.sectionLabel}>Recent Notes</p>
                      <strong className={styles.mobileSectionToggleTitle}>Tap to reopen fast</strong>
                    </div>
                    <span>{mobileNotesRecentOpen ? "Hide" : "Open"}</span>
                  </button>

                  {mobileNotesRecentOpen && (
                    <>
                      <input
                        value={notesSearch}
                        onChange={(event) => setNotesSearch(event.target.value)}
                        placeholder="Search notes"
                        className={styles.notesSearchInput}
                      />
                      <div className={styles.mobileRecentList}>
                        {recentNotes.map((note) => (
                          <button
                            key={note.id}
                            type="button"
                            className={styles.mobileRecentNote}
                            style={{ backgroundColor: note.color || "#f8fafc" }}
                            onClick={() => openMobileNoteEditor(note.id)}
                          >
                            <strong>{note.title || "Untitled note"}</strong>
                            <span>{new Date(note.updatedAtISO).toLocaleDateString()}</span>
                          </button>
                        ))}
                        {recentNotes.length === 0 && (
                          <p className={styles.emptyText}>No notes yet. Start your first one.</p>
                        )}
                      </div>
                    </>
                  )}
                </article>

                {mobileNotesEditorOpen && selectedNote ? (
                  <article
                    className={styles.mobileNotesEditorCard}
                    ref={notesEditorRef}
                    style={notesShellBackground(themeMode, selectedNote.color)}
                  >
                    <div className={styles.notesStudioHero}>
                      <div>
                        <p className={`${styles.sectionLabel} ${styles.noteHeroLabel}`}>Editing</p>
                        <h2 className={`${styles.cardTitle} ${styles.noteHeroTitle}`}>
                          {selectedNote.title || "Untitled note"}
                        </h2>
                      </div>
                      <div className={styles.noteFooterActions}>
                        <button
                          type="button"
                          className={`${styles.noteColorPickerTrigger} ${styles.noteToneButton}`}
                          onClick={() => {
                            setColorPickerOpen((open) => !open);
                            setTextColorPickerOpen(false);
                            setHighlightPickerOpen(false);
                          }}
                        >
                          <span
                            className={styles.noteColorPickerPreview}
                            style={{ backgroundColor: selectedNote.color || "#e7e5e4" }}
                          />
                          Page tone
                        </button>
                        <button
                          type="button"
                          className={`${styles.secondaryPlanButton} ${styles.noteDoneButton}`}
                          onClick={() => setMobileNotesEditorOpen(false)}
                        >
                          Done
                        </button>
                      </div>
                    </div>

                    {colorPickerOpen && (
                      <div className={styles.noteColorPickerPopover}>
                        {NOTE_COLORS.map((color) => (
                          <button
                            type="button"
                            key={color.value}
                            className={`${styles.noteColorSwatch} ${
                              selectedNote.color === color.value ? styles.noteColorSwatchActive : ""
                            }`}
                            style={{ backgroundColor: color.value }}
                            title={color.label}
                            onClick={() => {
                              void updateSelectedNote({ color: color.value });
                              setColorPickerOpen(false);
                            }}
                          />
                        ))}
                      </div>
                    )}

                    <div className={styles.mobileNotesControls}>
                      <button
                        type="button"
                        className={`${styles.mobileControlToggle} ${
                          mobileNotesToolsOpen === "format" ? styles.mobileControlToggleActive : ""
                        }`}
                        onClick={() =>
                          setMobileNotesToolsOpen((current) => (current === "format" ? null : "format"))
                        }
                      >
                        Format
                      </button>
                      <button
                        type="button"
                        className={`${styles.mobileControlToggle} ${
                          mobileNotesToolsOpen === "type" ? styles.mobileControlToggleActive : ""
                        }`}
                        onClick={() =>
                          setMobileNotesToolsOpen((current) => (current === "type" ? null : "type"))
                        }
                      >
                        Type
                      </button>
                      <button
                        type="button"
                        className={`${styles.mobileControlToggle} ${
                          mobileNotesToolsOpen === "color" ? styles.mobileControlToggleActive : ""
                        }`}
                        onClick={() =>
                          setMobileNotesToolsOpen((current) => (current === "color" ? null : "color"))
                        }
                      >
                        Color
                      </button>
                    </div>

                    {mobileNotesToolsOpen === "format" && (
                      <div className={styles.mobileToolPanel}>
                        <button type="button" className={styles.noteToolButton} onClick={() => applyEditorCommand("bold")}>
                          Bold
                        </button>
                        <button type="button" className={styles.noteToolButton} onClick={() => applyEditorCommand("italic")}>
                          Italic
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onClick={() => applyEditorCommand("underline")}
                        >
                          Underline
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onClick={() => applyEditorCommand("insertUnorderedList")}
                        >
                          Bullet
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onClick={() => applyEditorCommand("formatBlock", "H1")}
                        >
                          H1
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onClick={() => applyEditorCommand("formatBlock", "H2")}
                        >
                          H2
                        </button>
                      </div>
                    )}

                    {mobileNotesToolsOpen === "type" && (
                      <div className={styles.mobileToolPanel}>
                        <select
                          className={styles.noteToolSelect}
                          value={selectedNote.fontFamily}
                          onChange={(event) => {
                            const nextFont = event.target.value;
                            applyEditorCommand("fontName", nextFont);
                            void updateSelectedNote({ fontFamily: nextFont });
                          }}
                        >
                          {NOTE_FONTS.map((font) => (
                            <option key={font.label} value={font.value}>
                              {font.label}
                            </option>
                          ))}
                        </select>
                        <select
                          className={styles.noteToolSelect}
                          value={String(selectedNote.fontSizePx)}
                          onChange={(event) => {
                            const nextSize = Number(event.target.value);
                            const option = NOTE_FONT_SIZES.find((item) => item.value === nextSize);
                            applyEditorCommand("fontSize", option?.command ?? "4");
                            void updateSelectedNote({ fontSizePx: nextSize });
                          }}
                        >
                          {NOTE_FONT_SIZES.map((size) => (
                            <option key={size.value} value={size.value}>
                              {size.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {mobileNotesToolsOpen === "color" && (
                      <div className={styles.mobileToolPanel}>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onClick={() => {
                            setTextColorPickerOpen((open) => !open);
                            setHighlightPickerOpen(false);
                          }}
                        >
                          Text color
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onClick={() => {
                            setHighlightPickerOpen((open) => !open);
                            setTextColorPickerOpen(false);
                          }}
                        >
                          Highlight
                        </button>
                        {textColorPickerOpen && (
                          <div className={styles.noteInlinePalettePopover}>
                            {NOTE_TEXT_COLORS.map((color) => (
                              <button
                                type="button"
                                key={color.value}
                                className={styles.noteInlineSwatch}
                                style={{ backgroundColor: color.value }}
                                onClick={() => {
                                  applyEditorCommand("foreColor", color.value);
                                  setTextColorPickerOpen(false);
                                }}
                              />
                            ))}
                          </div>
                        )}
                        {highlightPickerOpen && (
                          <div className={styles.noteInlinePalettePopover}>
                            {NOTE_HIGHLIGHTS.map((color) => (
                              <button
                                type="button"
                                key={color.value}
                                className={styles.noteInlineSwatch}
                                style={{ backgroundColor: color.value }}
                                onClick={() => {
                                  applyHighlightColor(color.value);
                                  setHighlightPickerOpen(false);
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <input
                      value={selectedNote.title}
                      onChange={(event) => {
                        void updateSelectedNote({ title: event.target.value });
                      }}
                      placeholder="Note title"
                      className={styles.noteTitleInput}
                    />
                    <div
                      ref={editorRef}
                      className={styles.noteBodyInput}
                      contentEditable
                      suppressContentEditableWarning
                      style={{
                        fontFamily: selectedNote.fontFamily,
                        fontSize: `${selectedNote.fontSizePx}px`,
                      }}
                      onInput={() => {
                        captureEditorDraft();
                        saveEditorSelection();
                      }}
                      onBlur={() => {
                        captureEditorDraft();
                      }}
                      onMouseUp={() => saveEditorSelection()}
                      onKeyUp={() => saveEditorSelection()}
                      onFocus={() => saveEditorSelection()}
                    />
                    <div className={styles.noteFooterActions}>
                      <button
                        type="button"
                        className={`${styles.reportButton} ${styles.blockActionButton}`}
                        onClick={() => convertNoteToPlannedBlock(selectedNote)}
                      >
                        Convert to Block
                      </button>
                      <button
                        type="button"
                        className={styles.deleteNoteButton}
                        onClick={() => void deleteNote(selectedNote.id)}
                      >
                        Delete note
                      </button>
                    </div>
                  </article>
                ) : null}
              </div>}

              {!isMobileViewport && <CompanionPulse {...companionState.pulses.notes} />}
              {!isMobileViewport && (
                <aside
                  className={styles.notesSidebar}
                  style={notesShellBackground(themeMode, selectedNote?.color)}
                >
                <button type="button" className={styles.newNoteButton} onClick={createWorkspaceNote}>
                  + Add Note
                </button>
                <input
                  value={notesSearch}
                  onChange={(event) => setNotesSearch(event.target.value)}
                  placeholder="Search notes"
                  className={styles.notesSearchInput}
                />
                <div className={styles.notesFilterRow}>
                  <select
                    className={styles.noteToolSelect}
                    value={notesCategoryFilter}
                    onChange={(event) =>
                      setNotesCategoryFilter(event.target.value as "all" | NoteCategory)
                    }
                    disabled={!isPro}
                  >
                    <option value="all">All categories</option>
                    <option value="personal">Personal</option>
                    <option value="school">School</option>
                    <option value="work">Work</option>
                  </select>
                  {!isPro && (
                    <button type="button" className={styles.inlineUpgrade} onClick={openUpgradeFlow}>
                      Pro Filter
                    </button>
                  )}
                </div>
                <div className={styles.noteList}>
                  {filteredNotes.map((note) => (
                    <div key={note.id} className={styles.noteListRow}>
                      <button
                        type="button"
                        className={`${styles.noteListItem} ${selectedNoteId === note.id ? styles.noteListItemActive : ""}`}
                        style={{ backgroundColor: note.color || "#f8fafc" }}
                        onClick={() => setSelectedNoteId(note.id)}
                      >
                        <span className={styles.noteListTitle}>
                          {note.isPinned ? "★ " : ""}
                          {note.title || "Untitled note"}
                        </span>
                        <span className={styles.noteListMeta}>
                          {(note.category || "personal").toUpperCase()} ·{" "}
                          {new Date(note.updatedAtISO).toLocaleDateString()}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.notePinButton}
                        onClick={() => void togglePinned(note.id)}
                        title={note.isPinned ? "Unpin note" : "Pin note"}
                        aria-label={note.isPinned ? "Unpin note" : "Pin note"}
                      >
                        {note.isPinned ? "★" : "☆"}
                      </button>
                    </div>
                  ))}
                  {filteredNotes.length === 0 && (
                    <p className={styles.emptyText}>No notes match your filters.</p>
                  )}
                </div>
              </aside>
              )}

              {!isMobileViewport && (
                <article
                  className={styles.notesEditorCard}
                  style={notesShellBackground(themeMode, selectedNote?.color)}
                >
                {!selectedNote ? (
                  <div className={styles.notesEmptyEditor}>
                    <SenseiFigure
                      variant="scholar"
                      size="inline"
                      message="Start with one idea worth keeping."
                      className={styles.notesEmptySensei}
                    />
                    <p>Start by creating your first note.</p>
                  </div>
                ) : (
                  <>
                    <div className={styles.notesStudioHero}>
                      <div>
                        <p className={styles.sectionLabel}>Whelm Writing Studio</p>
                        <h2 className={`${styles.cardTitle} ${styles.noteSurfaceHeading}`}>
                          Elite notes, not scratch paper
                        </h2>
                        <p className={styles.noteStudioCopy}>
                          Shape the page the way you think: typography, emphasis, structure, and tone.
                        </p>
                      </div>
                      <div className={styles.noteColorRow}>
                        <button
                          type="button"
                          className={styles.noteColorPickerTrigger}
                          onClick={() => {
                            setColorPickerOpen((open) => !open);
                            setTextColorPickerOpen(false);
                            setHighlightPickerOpen(false);
                          }}
                        >
                          <span
                            className={styles.noteColorPickerPreview}
                            style={{ backgroundColor: selectedNote.color || "#e7e5e4" }}
                          />
                          Page tone
                        </button>

                        {colorPickerOpen && (
                          <div className={styles.noteColorPickerPopover}>
                            {NOTE_COLORS.map((color) => (
                              <button
                                type="button"
                                key={color.value}
                                className={`${styles.noteColorSwatch} ${
                                  selectedNote.color === color.value ? styles.noteColorSwatchActive : ""
                                }`}
                                style={{ backgroundColor: color.value }}
                                title={color.label}
                                onClick={() => {
                                  void updateSelectedNote({ color: color.value });
                                  setColorPickerOpen(false);
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.noteMetaRow}>
                      <label className={styles.noteMetaLabel}>
                        Category
                        <select
                          className={styles.noteToolSelect}
                          value={selectedNote.category || "personal"}
                          onChange={(event) =>
                            void updateSelectedNote({
                              category: event.target.value as NoteCategory,
                            })
                          }
                        >
                          <option value="personal">Personal</option>
                          <option value="school">School</option>
                          <option value="work">Work</option>
                        </select>
                      </label>
                      <label className={styles.noteMetaLabel}>
                        Reminder
                        <input
                          type="datetime-local"
                          className={styles.planControl}
                          value={
                            selectedNote.reminderAtISO
                              ? new Date(selectedNote.reminderAtISO)
                                  .toISOString()
                                  .slice(0, 16)
                              : ""
                          }
                          onChange={(event) =>
                            void updateSelectedNote({
                              reminderAtISO: event.target.value
                                ? new Date(event.target.value).toISOString()
                                : "",
                            })
                          }
                        />
                      </label>
                    </div>

                    <div className={styles.noteEditorToolbar}>
                      <div className={styles.noteToolbarGroup}>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            saveEditorSelection();
                          }}
                          onClick={() => applyEditorCommand("bold")}
                        >
                          Bold
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            saveEditorSelection();
                          }}
                          onClick={() => applyEditorCommand("italic")}
                        >
                          Italic
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            saveEditorSelection();
                          }}
                          onClick={() => applyEditorCommand("underline")}
                        >
                          Underline
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            saveEditorSelection();
                          }}
                          onClick={() => applyEditorCommand("removeFormat")}
                        >
                          Clear
                        </button>
                      </div>

                      <div className={styles.noteToolbarGroup}>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            saveEditorSelection();
                          }}
                          onClick={() => applyEditorCommand("formatBlock", "H1")}
                        >
                          H1
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            saveEditorSelection();
                          }}
                          onClick={() => applyEditorCommand("formatBlock", "H2")}
                        >
                          H2
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            saveEditorSelection();
                          }}
                          onClick={() => applyEditorCommand("formatBlock", "BLOCKQUOTE")}
                        >
                          Quote
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            saveEditorSelection();
                          }}
                          onClick={() => applyEditorCommand("insertHorizontalRule")}
                        >
                          Divider
                        </button>
                      </div>

                      <div className={styles.noteToolbarGroup}>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            saveEditorSelection();
                          }}
                          onClick={() => applyEditorCommand("insertUnorderedList")}
                        >
                          Bullet
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            saveEditorSelection();
                          }}
                          onClick={() => applyEditorCommand("insertOrderedList")}
                        >
                          Number
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            saveEditorSelection();
                          }}
                          onClick={() => applyEditorCommand("justifyLeft")}
                        >
                          Left
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            saveEditorSelection();
                          }}
                          onClick={() => applyEditorCommand("justifyCenter")}
                        >
                          Center
                        </button>
                      </div>

                      <div className={styles.noteToolbarGroup}>
                        <select
                          className={styles.noteToolSelect}
                          value={selectedNote.fontFamily}
                          onMouseDown={() => saveEditorSelection()}
                          onChange={(event) => {
                            const nextFont = event.target.value;
                            applyEditorCommand("fontName", nextFont);
                            void updateSelectedNote({ fontFamily: nextFont });
                          }}
                        >
                          {NOTE_FONTS.map((font) => (
                            <option key={font.label} value={font.value}>
                              {font.label}
                            </option>
                          ))}
                        </select>

                        <select
                          className={styles.noteToolSelect}
                          value={String(selectedNote.fontSizePx)}
                          onMouseDown={() => saveEditorSelection()}
                          onChange={(event) => {
                            const nextSize = Number(event.target.value);
                            const option = NOTE_FONT_SIZES.find((item) => item.value === nextSize);
                            applyEditorCommand("fontSize", option?.command ?? "4");
                            void updateSelectedNote({ fontSizePx: nextSize });
                          }}
                        >
                          {NOTE_FONT_SIZES.map((size) => (
                            <option key={size.value} value={size.value}>
                              {size.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={styles.noteToolbarGroup}>
                        <div className={styles.noteInlinePalette}>
                          <button
                            type="button"
                            className={styles.noteToolButton}
                            onClick={() => {
                              setTextColorPickerOpen((open) => !open);
                              setHighlightPickerOpen(false);
                              saveEditorSelection();
                            }}
                          >
                            Text color
                          </button>
                          {textColorPickerOpen && (
                            <div className={styles.noteInlinePalettePopover}>
                              {NOTE_TEXT_COLORS.map((color) => (
                                <button
                                  type="button"
                                  key={color.value}
                                  className={styles.noteInlineSwatch}
                                  style={{ backgroundColor: color.value }}
                                  title={color.label}
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    saveEditorSelection();
                                  }}
                                  onClick={() => {
                                    applyEditorCommand("foreColor", color.value);
                                    setTextColorPickerOpen(false);
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        <div className={styles.noteInlinePalette}>
                          <button
                            type="button"
                            className={styles.noteToolButton}
                            onClick={() => {
                              setHighlightPickerOpen((open) => !open);
                              setTextColorPickerOpen(false);
                              saveEditorSelection();
                            }}
                          >
                            Highlight
                          </button>
                          {highlightPickerOpen && (
                            <div className={styles.noteInlinePalettePopover}>
                              {NOTE_HIGHLIGHTS.map((color) => (
                                <button
                                  type="button"
                                  key={color.value}
                                  className={styles.noteInlineSwatch}
                                  style={{ backgroundColor: color.value }}
                                  title={color.label}
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    saveEditorSelection();
                                  }}
                                  onClick={() => {
                                    applyHighlightColor(color.value);
                                    setHighlightPickerOpen(false);
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <input
                      value={selectedNote.title}
                      onChange={(event) => {
                        void updateSelectedNote({ title: event.target.value });
                      }}
                      placeholder="Note title"
                      className={styles.noteTitleInput}
                    />

                    <div
                      ref={editorRef}
                      className={styles.noteBodyInput}
                      contentEditable
                      suppressContentEditableWarning
                      style={{
                        fontFamily: selectedNote.fontFamily,
                        fontSize: `${selectedNote.fontSizePx}px`,
                      }}
                      onInput={() => {
                        captureEditorDraft();
                        saveEditorSelection();
                      }}
                      onBlur={() => {
                        captureEditorDraft();
                      }}
                      onMouseUp={() => saveEditorSelection()}
                      onKeyUp={() => saveEditorSelection()}
                      onFocus={() => saveEditorSelection()}
                    />

                    <div className={styles.noteEditorFooter}>
                      <span>
                        {notesSyncStatus === "synced"
                          ? "Synced to your account."
                          : notesSyncStatus === "syncing"
                            ? "Syncing notes..."
                            : "Saved locally only. Sync needed for other devices."}
                        {notesSyncMessage ? ` ${notesSyncMessage}` : ""}
                      </span>
                      <div className={styles.noteFooterActions}>
                      <button
                        type="button"
                        className={`${styles.reportButton} ${styles.blockActionButton}`}
                        onClick={() => convertNoteToPlannedBlock(selectedNote)}
                      >
                        Convert to Block
                      </button>
                        {notesSyncStatus !== "synced" && (
                          <button type="button" className={styles.retrySyncButton} onClick={() => void handleRetrySync()}>
                            Retry sync
                          </button>
                        )}
                        <button type="button" className={styles.deleteNoteButton} onClick={() => void deleteNote(selectedNote.id)}>
                          Delete note
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </article>
              )}
            </section>
          )}

          {activeTab === "history" && (
            <section className={styles.historyShell}>
              <CompanionPulse {...companionState.pulses.history} />
              <article className={styles.card}>
                <p className={styles.sectionLabel}>Block History</p>
                <h2 className={styles.cardTitle}>Completed and incomplete blocks</h2>
                <div className={styles.planSectionStack}>
                  <section className={styles.planSection}>
                    <button
                      type="button"
                      className={styles.planSectionHeader}
                      onClick={() =>
                        setHistorySectionsOpen((current) => ({
                          ...current,
                          completed: !current.completed,
                        }))
                      }
                    >
                      <span>Completed</span>
                      <span>{plannedBlockHistory.completed.length}</span>
                    </button>
                    {historySectionsOpen.completed && (
                      <div className={styles.planList}>
                        {plannedBlockHistory.completed.length === 0 ? (
                          <p className={styles.emptyText}>No completed blocks yet.</p>
                        ) : (
                          plannedBlockHistory.completed.map((item) => (
                            <div key={item.id} className={styles.planItemStatic}>
                              <div>
                                <strong>{item.title}</strong>
                                <div className={styles.planMetaRow}>
                                  <span>
                                    {new Date(`${item.dateKey}T00:00:00`).toLocaleDateString(undefined, {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                  <span>{normalizeTimeLabel(item.timeOfDay)}</span>
                                  <span>{item.durationMinutes}m</span>
                                </div>
                                {item.note.trim() && <p className={styles.planItemNote}>{item.note}</p>}
                              </div>
                              <div className={styles.planStatusPill}>Completed</div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </section>

                  <section className={styles.planSection}>
                    <button
                      type="button"
                      className={styles.planSectionHeader}
                      onClick={() =>
                        setHistorySectionsOpen((current) => ({
                          ...current,
                          incomplete: !current.incomplete,
                        }))
                      }
                    >
                      <span>Incomplete</span>
                      <span>{plannedBlockHistory.incomplete.length}</span>
                    </button>
                    {historySectionsOpen.incomplete && (
                      <div className={styles.planList}>
                        {plannedBlockHistory.incomplete.length === 0 ? (
                          <p className={styles.emptyText}>No incomplete blocks yet.</p>
                        ) : (
                          plannedBlockHistory.incomplete.map((item) => (
                            <div key={item.id} className={styles.planItemStatic}>
                              <div>
                                <strong>{item.title}</strong>
                                <div className={styles.planMetaRow}>
                                  <span>
                                    {new Date(`${item.dateKey}T00:00:00`).toLocaleDateString(undefined, {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                  <span>{normalizeTimeLabel(item.timeOfDay)}</span>
                                  <span>{item.durationMinutes}m</span>
                                </div>
                                {item.note.trim() && <p className={styles.planItemNote}>{item.note}</p>}
                              </div>
                              <div className={styles.planStatusPillMuted}>Incomplete</div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </section>
                </div>
              </article>
              <article className={styles.card}>
                <p className={styles.sectionLabel}>History</p>
                <h2 className={styles.cardTitle}>Session log</h2>
                {sessionHistoryGroups.length === 0 ? (
                  <div className={styles.historyEmptyState}>
                    <SenseiFigure
                      variant="wave"
                      size="inline"
                      message="Your first session will start the record."
                      className={styles.historyEmptySensei}
                    />
                    <p className={styles.emptyText}>
                      No sessions yet. Start your timer and save your first block.
                    </p>
                  </div>
                ) : (
                  <div className={styles.groupList}>
                    {sessionHistoryGroups.map((monthGroup) => (
                      <section key={monthGroup.key} className={`${styles.sessionGroup} ${styles.historyMonthGroup}`}>
                        <button
                          type="button"
                          className={styles.groupHeader}
                          onClick={() =>
                            setHistoryGroupsOpen((current) => ({
                              ...current,
                              [monthGroup.key]: !current[monthGroup.key],
                            }))
                          }
                        >
                          <div className={styles.historyGroupCopy}>
                            <p className={styles.historyGroupLabel}>Month</p>
                            <h3>{monthGroup.label}</h3>
                          </div>
                          <div className={styles.historyGroupMeta}>
                            <span>{monthGroup.weeks.length} week{monthGroup.weeks.length === 1 ? "" : "s"}</span>
                            <strong>{monthGroup.totalMinutes}m</strong>
                            <span className={styles.historyDisclosure}>
                              {historyGroupsOpen[monthGroup.key] ? "-" : "+"}
                            </span>
                          </div>
                        </button>
                        {historyGroupsOpen[monthGroup.key] && (
                          <div className={styles.historyWeekList}>
                            {monthGroup.weeks.map((weekGroup) => (
                              <section
                                key={weekGroup.key}
                                className={`${styles.sessionGroup} ${styles.historyWeekGroup}`}
                              >
                                <button
                                  type="button"
                                  className={styles.groupHeader}
                                  onClick={() =>
                                    setHistoryGroupsOpen((current) => ({
                                      ...current,
                                      [weekGroup.key]: !current[weekGroup.key],
                                    }))
                                  }
                                >
                                  <div className={styles.historyGroupCopy}>
                                    <p className={styles.historyGroupLabel}>Week</p>
                                    <h3>{weekGroup.label}</h3>
                                  </div>
                                  <div className={styles.historyGroupMeta}>
                                    <span>{weekGroup.days.length} day{weekGroup.days.length === 1 ? "" : "s"}</span>
                                    <strong>{weekGroup.totalMinutes}m</strong>
                                    <span className={styles.historyDisclosure}>
                                      {historyGroupsOpen[weekGroup.key] ? "-" : "+"}
                                    </span>
                                  </div>
                                </button>
                                {historyGroupsOpen[weekGroup.key] && (
                                  <div className={styles.historyDayList}>
                                    {weekGroup.days.map((dayGroup) => (
                                      <section
                                        key={dayGroup.key}
                                        className={`${styles.sessionGroup} ${styles.historyDayGroup}`}
                                      >
                                        <button
                                          type="button"
                                          className={styles.groupHeader}
                                          onClick={() =>
                                            setHistoryGroupsOpen((current) => ({
                                              ...current,
                                              [dayGroup.key]: !current[dayGroup.key],
                                            }))
                                          }
                                        >
                                          <div className={styles.historyGroupCopy}>
                                            <p className={styles.historyGroupLabel}>Day</p>
                                            <h3>{dayGroup.label}</h3>
                                          </div>
                                          <div className={styles.historyGroupMeta}>
                                            <span>{dayGroup.items.length} session{dayGroup.items.length === 1 ? "" : "s"}</span>
                                            <strong>{dayGroup.totalMinutes}m</strong>
                                            <span className={styles.historyDisclosure}>
                                              {historyGroupsOpen[dayGroup.key] ? "-" : "+"}
                                            </span>
                                          </div>
                                        </button>
                                        {historyGroupsOpen[dayGroup.key] && (
                                          <div className={styles.sessionList}>
                                            {dayGroup.items.map((session, index) => (
                                              <div key={`${session.completedAtISO}-${index}`} className={styles.sessionItem}>
                                                <div>
                                                  <div className={styles.sessionPrimary}>
                                                    {new Date(session.completedAtISO).toLocaleTimeString([], {
                                                      hour: "numeric",
                                                      minute: "2-digit",
                                                    })}{" "}
                                                    {session.note?.trim()
                                                      ? stripCompletedBlockPrefix(session.note.trim())
                                                      : "Session"}
                                                  </div>
                                                </div>
                                                <div className={styles.sessionMinutes}>{session.minutes}m</div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </section>
                                    ))}
                                  </div>
                                )}
                              </section>
                            ))}
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                )}
              </article>
            </section>
          )}

          {activeTab === "reports" && (
            <section className={styles.reportsGrid}>
              <CompanionPulse {...companionState.pulses.reports} />
              <article className={`${styles.card} ${styles.analyticsHeroCard}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Advanced Reports</p>
                    <h2 className={styles.cardTitle}>Performance command center</h2>
                    <p className={styles.accountMeta}>
                      Rich analytics from your tracked sessions, completion behavior, quality score, and timing patterns.
                    </p>
                  </div>
                  <WhelmEmote emoteId="whelm.score" size="inline" className={styles.analyticsHeroEmote} />
                </div>

                <div className={styles.analyticsToolbar}>
                  <div className={styles.rangeTabs}>
                    <button
                      type="button"
                      className={`${styles.rangeTab} ${insightRange === 7 ? styles.rangeTabActive : ""}`}
                      onClick={() => setInsightRange(7)}
                    >
                      7d
                    </button>
                    <button
                      type="button"
                      className={`${styles.rangeTab} ${insightRange === 30 ? styles.rangeTabActive : ""}`}
                      onClick={() => setInsightRange(30)}
                    >
                      30d
                    </button>
                    <button
                      type="button"
                      className={`${styles.rangeTab} ${insightRange === 90 ? styles.rangeTabActive : ""}`}
                      onClick={() => setInsightRange(90)}
                    >
                      90d
                    </button>
                  </div>
                  <p className={styles.accountMeta}>
                    Window: {analyticsDateRange.startDate} to {analyticsDateRange.endDate}
                  </p>
                </div>

                {analyticsError ? (
                  <p className={styles.analyticsEmptyState}>{analyticsError}</p>
                ) : analyticsLoading && !analyticsWeeklySummary ? (
                  <p className={styles.analyticsEmptyState}>Loading advanced reports...</p>
                ) : analyticsWeeklySummary ? (
                  <div className={styles.analyticsHeroGrid}>
                    <div className={styles.analyticsHeroMetric}>
                      <span>Avg Performance</span>
                      <strong>{analyticsWeeklySummary.averages.dailyPerformanceScore}</strong>
                      <small>score this week</small>
                    </div>
                    <div className={styles.analyticsHeroMetric}>
                      <span>Completion Rate</span>
                      <strong>{analyticsWeeklySummary.averages.completionRate}%</strong>
                      <small>{analyticsWeeklySummary.totals.sessionsCompleted} sessions finished</small>
                    </div>
                    <div className={styles.analyticsHeroMetric}>
                      <span>Session Quality</span>
                      <strong>
                        {analyticsWeeklySummary.averages.sessionQualityScore === null
                          ? "N/A"
                          : analyticsWeeklySummary.averages.sessionQualityScore}
                      </strong>
                      <small>quality average</small>
                    </div>
                    <div className={styles.analyticsHeroMetric}>
                      <span>Active Days</span>
                      <strong>{analyticsWeeklySummary.activeDays}</strong>
                      <small>captured this week</small>
                    </div>
                  </div>
                ) : (
                  <p className={styles.analyticsEmptyState}>Finish a few tracked sessions to unlock richer reports.</p>
                )}
              </article>

              <article className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Score History</p>
                    <h2 className={styles.cardTitle}>Performance score trend</h2>
                  </div>
                </div>
                {analyticsScoreHistory.length > 0 ? (
                  <>
                    <div className={styles.analyticsChartFrame}>
                      <svg viewBox="0 0 100 100" className={styles.trendChart} preserveAspectRatio="none">
                        <polyline points={analyticsScorePath} className={styles.analyticsTrendLine} />
                      </svg>
                    </div>
                    <div className={styles.analyticsChartLabels}>
                      {analyticsScoreHistory
                        .map((entry, index) => (
                          <span key={`${entry.date}-${index}`}>
                            {new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        ))
                        .filter((_, index) =>
                          insightRange === 7
                            ? true
                            : insightRange === 30
                              ? index % 5 === 0 || index === analyticsScoreHistory.length - 1
                              : index % 15 === 0 || index === analyticsScoreHistory.length - 1,
                        )}
                    </div>
                    <div className={styles.analyticsBandSummary}>
                      <span>High: {analyticsWeeklySummary?.performanceBands.high ?? 0}</span>
                      <span>Steady: {analyticsWeeklySummary?.performanceBands.steady ?? 0}</span>
                      <span>Recovery: {analyticsWeeklySummary?.performanceBands.recovery ?? 0}</span>
                    </div>
                  </>
                ) : (
                  <p className={styles.analyticsEmptyState}>Performance score history will appear once analytics days are aggregated.</p>
                )}
              </article>

              <article className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Insight Feed</p>
                    <h2 className={styles.cardTitle}>What the system is seeing</h2>
                  </div>
                </div>
                {analyticsInsights.length > 0 ? (
                  <div className={styles.analyticsInsightList}>
                    {analyticsInsights.map((insight) => (
                      <article
                        key={insight.type}
                        className={`${styles.analyticsInsightCard} ${
                          insight.tone === "warning"
                            ? styles.analyticsInsightWarning
                            : insight.tone === "positive"
                              ? styles.analyticsInsightPositive
                              : styles.analyticsInsightNeutral
                        }`}
                      >
                        <p className={styles.analyticsInsightTitle}>{insight.title}</p>
                        <p className={styles.accountMeta}>{insight.body}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className={styles.analyticsEmptyState}>No standout insights yet. More tracked sessions will make this feed sharper.</p>
                )}
              </article>

              <article className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Timing</p>
                    <h2 className={styles.cardTitle}>Best focus window</h2>
                  </div>
                </div>
                {analyticsBestHours?.bestWindow ? (
                  <>
                    <div className={styles.analyticsFocusWindow}>
                      <strong>
                        {formatAnalyticsWindowLabel(
                          analyticsBestHours.bestWindow.startHour,
                          analyticsBestHours.bestWindow.endHour,
                        )}
                      </strong>
                      <span>{analyticsBestHours.bestWindow.focusMinutes} focus minutes captured in this window.</span>
                      <small>{analyticsBestHours.bestWindow.sharePercent}% of your tracked completed-session focus lives here.</small>
                    </div>
                    <div className={styles.analyticsHourList}>
                      {analyticsTopHours.map((hour) => (
                        <div key={hour.hour} className={styles.analyticsHourRow}>
                          <div>
                            <strong>{formatHourLabel(hour.hour)}</strong>
                            <p className={styles.accountMeta}>{hour.completedSessions} sessions</p>
                          </div>
                          <div className={styles.analyticsBarTrack}>
                            <div
                              className={styles.analyticsBarFill}
                              style={{ width: `${Math.max(8, hour.sharePercent)}%` }}
                            />
                          </div>
                          <span>{hour.focusMinutes}m</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className={styles.analyticsEmptyState}>Best focus hours appear after enough completed sessions are tracked.</p>
                )}
              </article>

              <article className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Subject Breakdown</p>
                    <h2 className={styles.cardTitle}>Where the work is landing</h2>
                  </div>
                </div>
                {analyticsTopSubjects.some((subject) => subject.focusMinutes > 0) ? (
                  <div className={styles.analyticsSubjectList}>
                    {analyticsTopSubjects.map((subject) => (
                      <div key={subject.key} className={styles.analyticsSubjectRow}>
                        <div className={styles.analyticsSubjectHeader}>
                          <strong>{subject.label}</strong>
                          <span>{subject.focusMinutes}m</span>
                        </div>
                        <div className={styles.analyticsBarTrack}>
                          <div
                            className={styles.analyticsBarFill}
                            style={{ width: `${(subject.focusMinutes / analyticsTopSubjectMinutes) * 100}%` }}
                          />
                        </div>
                        <p className={styles.accountMeta}>
                          {subject.sessionsCompleted} completed sessions, {subject.tasksCompleted} tasks finished
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.analyticsEmptyState}>Subject-level analytics will fill in as tracked sessions accumulate.</p>
                )}
              </article>

              <article className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Popups & Notifications</p>
                    <h2 className={styles.cardTitle}>Recommended nudges</h2>
                    <p className={styles.accountMeta}>
                      These are generated from the latest analytics snapshot and can power in-app prompts and scheduled notifications.
                    </p>
                  </div>
                </div>
                {analyticsNotificationPlan ? (
                  <div className={styles.analyticsNotificationList}>
                    {analyticsNotificationPlan.notifications.map((notification) => (
                      <article key={notification.kind} className={styles.analyticsNotificationCard}>
                        <div className={styles.analyticsNotificationHeader}>
                          <strong>{notification.title}</strong>
                          <span>{notification.deliverAtLocalTime}</span>
                        </div>
                        <p className={styles.accountMeta}>{notification.body}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className={styles.analyticsEmptyState}>Once today has analytics data, Whelm can propose targeted nudges here.</p>
                )}
              </article>
            </section>
          )}

          {activeTab === "streaks" && (
            <section className={styles.streaksShell}>
              <article className={`${styles.card} ${styles.streakHeroCard}`}>
                <div className={styles.streakHeroCopy}>
                  <p className={styles.streakBadge}>
                    {renderBandanaBadgeLabel(streakBandanaTier?.label)}
                  </p>
                  <h2 className={styles.streakHeroTitle}>
                    {displayStreak} day streak
                  </h2>
                  <p className={styles.streakHeroBody}>
                    {yesterdaySave && !sessionMinutesByDay.has(todayKey)
                      ? "Yesterday was protected by a sick day save. Complete today to carry the run forward."
                      : streakProtectedToday
                      ? "Today is protected. Keep the run alive and let tomorrow inherit the standard."
                      : streakStatusLine}
                  </p>
                </div>
                {!isMobileViewport && (
                  <div className={styles.streakHeroVisual}>
                    <WhelmEmote emoteId={streakHeroEmoteId} size="card" />
                  </div>
                )}
              </article>

              <article className={`${styles.card} ${styles.streakMilestoneCard}`}>
                <div className={styles.streakMilestoneIcon}>
                  <StreakBandana
                    streakDays={nextBandanaMilestone?.tier.minDays ?? Math.max(1, displayStreak)}
                    className={styles.streakMilestoneBandana}
                  />
                </div>
                <div className={styles.streakMilestoneCopy}>
                  <h3 className={styles.streakMilestoneTitle}>{streakMilestoneTitle}</h3>
                  <p className={styles.streakMilestoneBody}>
                    {isMobileViewport && nextBandanaMilestone
                      ? `${nextBandanaMilestone.remainingDays} more day${
                          nextBandanaMilestone.remainingDays === 1 ? "" : "s"
                        } to ${nextBandanaMilestone.tier.color.toLowerCase()}.`
                      : streakMilestoneBody}
                  </p>
                </div>
              </article>

              {(rawYesterdayMissed || yesterdaySave) &&
                (sickDaySaveEligible || recentSickSaveUsed || Boolean(yesterdaySave)) && (
                <article className={`${styles.card} ${styles.streakSaveCard}`}>
                  <div>
                    <p className={styles.sectionLabel}>Streak Saver</p>
                    <h3 className={styles.cardTitle}>Sick day save</h3>
                    <p className={styles.accountMeta}>
                      {yesterdaySave
                        ? "Yesterday was protected as a sick day. Today still needs a real session."
                        : sickDaySaveEligible
                          ? `If you genuinely missed ${new Date(`${yesterdayKey}T00:00:00`).toLocaleDateString(
                              undefined,
                              { weekday: "long" },
                            )} because you were sick, you can protect that one day now.`
                          : `No sick day save is available right now.${
                              sickDaySaveCooldownUntil
                                ? ` Next save window opens ${sickDaySaveCooldownUntil.toLocaleDateString(undefined, {
                                    month: "long",
                                    day: "numeric",
                                  })}.`
                                : ""
                            }`}
                    </p>
                  </div>
                  <div className={styles.noteFooterActions}>
                    {sickDaySaveEligible ? (
                      <>
                        <button
                          type="button"
                          className={styles.reportButton}
                          onClick={openStreakSaveQuestionnaire}
                        >
                          Use sick day save
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryPlanButton}
                          onClick={declineSickDaySave}
                        >
                          Let it reset
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={styles.secondaryPlanButton}
                        onClick={() => setActiveTab("today")}
                      >
                        Earn today now
                      </button>
                    )}
                  </div>
                </article>
              )}

              <article className={`${styles.card} ${styles.streakCalendarCard}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Calendar</p>
                    <h2 className={styles.cardTitle}>Real month streak view</h2>
                  </div>
                  <div className={styles.noteFooterActions}>
                    <button
                      type="button"
                      className={styles.secondaryPlanButton}
                      onClick={() => setStreakCalendarCursor((current) => shiftMonth(current, -1))}
                    >
                      Prev
                    </button>
                    <strong className={styles.streakCalendarMonthLabel}>{streakMonthLabel}</strong>
                    <button
                      type="button"
                      className={styles.secondaryPlanButton}
                      onClick={() => setStreakCalendarCursor((current) => shiftMonth(current, 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
                <div className={styles.streakWeekHeader}>
                  <span>S</span>
                  <span>M</span>
                  <span>T</span>
                  <span>W</span>
                  <span>T</span>
                  <span>F</span>
                  <span>S</span>
                </div>
                <div className={styles.streakMonthGrid}>
                  {streakMonthCalendar.map((cell) => (
                    <div
                      key={cell.key}
                      className={[
                        styles.streakMonthCell,
                        cell.dayNumber ? "" : styles.streakMonthCellEmpty,
                        cell.streakLength > 0 ? styles.streakMonthCellActive : "",
                        cell.streakTierColor ? styles[`streakMonthCellTier${cell.streakTierColor.charAt(0).toUpperCase()}${cell.streakTierColor.slice(1)}`] : "",
                        cell.isSaved ? styles.streakMonthCellSaved : "",
                        cell.leftConnected ? styles.streakMonthCellConnectLeft : "",
                        cell.rightConnected ? styles.streakMonthCellConnectRight : "",
                        cell.isToday ? styles.streakMonthCellToday : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      title={
                        cell.dateKey
                          ? `${cell.dateKey}: ${
                              cell.streakLength > 0
                                ? cell.isSaved
                                  ? `protected sick day, ${cell.streakLength}-day run preserved`
                                  : `${cell.streakLength}-day streak tier`
                                : cell.hasSession
                                  ? "session saved"
                                  : "no streak"
                            }`
                          : "Outside current month"
                      }
                    >
                      {cell.dayNumber ? (
                        <>
                          <span className={styles.streakMonthDayNumber}>{cell.dayNumber}</span>
                          {cell.streakLength > 0 ? (
                            <StreakBandana
                              streakDays={cell.streakLength}
                              className={styles.streakMonthBandana}
                            />
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>

              {isMobileViewport ? (
                <article className={`${styles.card} ${styles.streakStatusCard}`}>
                  <div className={styles.kpiItemStatic}>
                    <span>Status</span>
                    <strong>{streakProtectedToday ? "Protected" : "At risk"}</strong>
                  </div>
                </article>
              ) : (
                <article className={styles.card}>
                  <div className={styles.kpiGrid}>
                    <div className={styles.kpiItemStatic}>
                      <span>Current Run</span>
                      <strong>{displayStreak}d</strong>
                    </div>
                    <div className={styles.kpiItemStatic}>
                      <span>Current Bandana</span>
                      <strong>{streakBandanaTier?.label ?? "None yet"}</strong>
                    </div>
                    <div className={styles.kpiItemStatic}>
                      <span>Today Focus</span>
                      <strong>{focusMetrics.todayMinutes}m</strong>
                    </div>
                    <div className={styles.kpiItemStatic}>
                      <span>Status</span>
                      <strong>{streakProtectedToday ? "Protected" : "At risk"}</strong>
                    </div>
                  </div>
                  <div className={styles.noteFooterActions}>
                    <button
                      type="button"
                      className={styles.reportButton}
                      onClick={() => {
                        setActiveTab("calendar");
                        setCalendarView("month");
                      }}
                    >
                      Open command board
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryPlanButton}
                      onClick={() => setActiveTab("today")}
                    >
                      Focus now
                    </button>
                  </div>
                </article>
              )}
            </section>
          )}

          {activeTab === "settings" && (
            <section className={styles.settingsGrid}>
              <CompanionPulse {...companionState.pulses.settings} />
              <article className={`${styles.card} ${styles.settingsHeroCard}`}>
                <div className={styles.settingsHeroHeader}>
                  <WhelmProfileAvatar tierColor={streakBandanaTier?.color} size="compact" isPro={isPro} />
                  <div>
                    <p className={styles.sectionLabel}>Account</p>
                    <h2 className={styles.cardTitle}>{user.displayName || "WHELM user"}</h2>
                    <p className={styles.accountMeta}>{user.email}</p>
                  </div>
                </div>
                <div className={styles.settingsPills}>
                  <span className={styles.settingsPill}>
                    Plan: {isPro ? "Pro" : "Free"}
                  </span>
                  <span className={styles.settingsPill}>
                    Mode: {proSource === "preview" ? "Preview" : isPro ? "Store" : "Standard"}
                  </span>
                  <span className={styles.settingsPill}>Streak: {streak}d</span>
                </div>
                {!isPro ? (
                  <div className={styles.noteFooterActions}>
                    <button
                      type="button"
                      className={styles.inlineUpgrade}
                      onClick={() => void handleStartProPreview()}
                    >
                      Enter premium preview
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryPlanButton}
                      onClick={() => signOut(auth)}
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className={styles.noteFooterActions}>
                    <button
                      type="button"
                      className={styles.secondaryPlanButton}
                      onClick={() => void handleRestoreFreeTier()}
                    >
                      Restore free tier
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryPlanButton}
                      onClick={() => signOut(auth)}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </article>

              <article className={styles.card}>
                <p className={styles.sectionLabel}>Account</p>
                <h2 className={styles.cardTitle}>Whelm setup</h2>
                <ul className={styles.settingsList}>
                  <li>
                    <span>Clean Focus Mode</span>
                    <strong>{isPro ? "Enabled" : "Soon"}</strong>
                  </li>
                  <li>
                    <span>Weekly Report Cards</span>
                    <strong>On</strong>
                  </li>
                  <li>
                    <span>Productivity Reports</span>
                    <strong>{isPro ? "Full" : "Growing"}</strong>
                  </li>
                </ul>
              </article>

              <article className={styles.card}>
                <p className={styles.sectionLabel}>Testing</p>
                <h2 className={styles.cardTitle}>Internal preview controls</h2>
                <p className={styles.accountMeta}>
                  Open gated flows from Settings without waiting for the real trigger conditions.
                </p>
                <div className={styles.settingsActionGrid}>
                  <button
                    type="button"
                    className={styles.reportButton}
                    onClick={openStreakSaveQuestionnairePreview}
                  >
                    Preview sick survey
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryPlanButton}
                    onClick={openDailyPlanningPreview}
                  >
                    Preview 3-block ritual
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryPlanButton}
                    onClick={openSickDaySavePromptPreview}
                  >
                    Preview streak warning
                  </button>
                </div>
              </article>

              <article className={styles.card}>
                <p className={styles.sectionLabel}>Protocol</p>
                <h2 className={styles.cardTitle}>Whelm tone</h2>
                <p className={styles.accountMeta}>
                  Choose how direct Whelm should feel when keeping you accountable.
                </p>
                <div className={styles.companionStyleRow}>
                  {(["gentle", "balanced", "strict"] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      className={`${styles.companionStyleButton} ${
                        companionStyle === style ? styles.companionStyleButtonActive : ""
                      }`}
                      onClick={() => setCompanionStyle(style)}
                    >
                      {formatSenseiLabel(style)}
                    </button>
                  ))}
                </div>
              </article>

              <article className={styles.card}>
                <p className={styles.sectionLabel}>Appearance</p>
                <h2 className={styles.cardTitle}>Theme mode</h2>
                <p className={styles.accountMeta}>
                  Choose the theme you want by default. You can change this any time.
                </p>
                <div className={styles.companionStyleRow}>
                  {(["dark", "light"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`${styles.companionStyleButton} ${
                        themeMode === mode ? styles.companionStyleButtonActive : ""
                      }`}
                      onClick={() => applyThemeMode(mode)}
                    >
                      {mode === "dark" ? "Dark mode" : "Light mode"}
                    </button>
                  ))}
                </div>
              </article>

              <article className={styles.card}>
                <p className={styles.sectionLabel}>Sync</p>
                <h2 className={styles.cardTitle}>Notes sync status</h2>
                <p className={styles.accountMeta}>
                  {notesSyncStatus === "synced"
                    ? "Synced"
                    : notesSyncStatus === "syncing"
                      ? "Syncing"
                      : "Local only"}
                </p>
                {notesSyncMessage && <p className={styles.accountMeta}>{notesSyncMessage}</p>}
                {notesSyncStatus !== "synced" && (
                  <button type="button" className={styles.retrySyncButton} onClick={() => void handleRetrySync()}>
                    Retry sync now
                  </button>
                )}
              </article>

              <article className={styles.card}>
                <p className={styles.sectionLabel}>Screen Time</p>
                <h2 className={styles.cardTitle}>Device usage permission</h2>
                <p className={styles.accountMeta}>
                  {screenTimeSupported
                    ? `Authorization status: ${screenTimeStatus}`
                    : "Screen Time is available only in the iOS native build."}
                </p>
                {screenTimeReason && <p className={styles.accountMeta}>{screenTimeReason}</p>}
                <div className={styles.noteFooterActions}>
                  {screenTimeSupported && (
                    <button
                      type="button"
                      className={styles.reportButton}
                      onClick={() => void handleRequestScreenTimeAuth()}
                      disabled={screenTimeBusy}
                    >
                      {screenTimeBusy ? "Working..." : "Request Screen Time Access"}
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.secondaryPlanButton}
                    onClick={() => void handleOpenScreenTimeSettings()}
                    disabled={screenTimeBusy}
                  >
                    Open iOS Settings
                  </button>
                </div>
                <ul className={styles.commandList}>
                  <li>This unlocks Screen Time APIs through Apple permission flow.</li>
                  <li>Detailed per-app charts require the Device Activity report extension.</li>
                </ul>
              </article>

              <article className={styles.card}>
                <p className={styles.sectionLabel}>Support</p>
                <h2 className={styles.cardTitle}>Feedback</h2>
                <button
                  type="button"
                  className={styles.reportButton}
                  onClick={() => {
                    setFeedbackOpen(true);
                    setFeedbackStatus("");
                  }}
                >
                  Send Whelm feedback
                </button>
                <p className={styles.accountMeta}>Report bugs, request features, or share ideas.</p>
              </article>

              <article className={`${styles.card} ${styles.accountDangerCard}`}>
                <p className={styles.sectionLabel}>Account</p>
                <h2 className={styles.cardTitle}>Delete account</h2>
                <p className={styles.accountMeta}>
                  Permanently delete your Whelm account, notes, sessions, and local app data.
                </p>
                <button
                  type="button"
                  className={styles.deleteAccountButton}
                  onClick={() => void handleDeleteAccount()}
                  disabled={deletingAccount}
                >
                  {deletingAccount ? "Deleting account..." : "Delete account permanently"}
                </button>
                {accountDangerStatus ? (
                  <p className={styles.accountDangerStatus}>{accountDangerStatus}</p>
                ) : null}
              </article>
            </section>
          )}
        </section>
      </div>

      <nav className={styles.bottomTabs}>
        {MOBILE_PRIMARY_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`${styles.bottomTabButton} ${
              (tab.key === "more" ? mobileMoreActive || mobileMoreOpen : activeTab === tab.key)
                ? styles.bottomTabButtonActive
                : ""
            }`}
            onClick={() => handleMobileTabSelect(tab.key)}
          >
            <span className={styles.bottomTabIcon}>
              {tab.key === "more" ? iconForNavKey("more") : iconForTab(tab.key)}
            </span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {profileOpen && (
        <div className={styles.feedbackOverlay} onClick={() => setProfileOpen(false)}>
          <div className={styles.profileSheet} onClick={(event) => event.stopPropagation()}>
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>Profile</h2>
              <button
                type="button"
                className={styles.feedbackClose}
                onClick={() => setProfileOpen(false)}
              >
                Close
              </button>
            </div>

            <article className={styles.profileHero}>
              <WhelmProfileAvatar tierColor={streakBandanaTier?.color} size="hero" isPro={isPro} />
              <div className={styles.profileHeroCopy}>
                <p className={styles.sectionLabel}>Whelm Identity</p>
                <h3 className={styles.profileHeroTitle}>{profileDisplayName}</h3>
                <p className={styles.accountMeta}>
                  {profileTierTheme.title} · {streakBandanaTier?.label ?? "No bandana yet"}
                </p>
              </div>
            </article>

            <div className={styles.profileStatsGrid}>
              <article className={styles.profileStatCard}>
                <span>Current streak</span>
                <strong>{displayStreak}d</strong>
              </article>
              <article className={styles.profileStatCard}>
                <span>Longest streak</span>
                <strong>{longestStreak}d</strong>
              </article>
              <article className={styles.profileStatCard}>
                <span>Lifetime focus</span>
                <strong>{lifetimeFocusMinutes}m</strong>
              </article>
              <article className={styles.profileStatCard}>
                <span>Total sessions</span>
                <strong>{sessions.length}</strong>
              </article>
            </div>

            <article className={styles.profileProgressCard}>
              <p className={styles.sectionLabel}>Next ascent</p>
              <h3 className={styles.cardTitle}>
                {nextBandanaMilestone
                  ? `${nextBandanaMilestone.tier.label} at ${nextBandanaMilestone.tier.minDays} days`
                  : "White Bandana reached"}
              </h3>
              <p className={styles.accountMeta}>
                {nextBandanaMilestone
                  ? `${nextBandanaMilestone.remainingDays} more day${
                      nextBandanaMilestone.remainingDays === 1 ? "" : "s"
                    } to level up the profile.`
                  : "Top tier achieved. Keep the run alive."}
              </p>
            </article>

            <div className={styles.noteFooterActions}>
              <button
                type="button"
                className={styles.reportButton}
                onClick={() => {
                  setProfileOpen(false);
                  setActiveTab("streaks");
                }}
              >
                Open streaks
              </button>
              <button
                type="button"
                className={styles.secondaryPlanButton}
                onClick={() => {
                  setProfileOpen(false);
                  setMobileMoreOpen(true);
                }}
              >
                More
              </button>
            </div>
          </div>
        </div>
      )}

      {mobileMoreOpen && (
        <div className={styles.feedbackOverlay} onClick={() => setMobileMoreOpen(false)}>
          <div className={styles.mobileMoreSheet} onClick={(event) => event.stopPropagation()}>
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>More</h2>
              <button
                type="button"
                className={styles.feedbackClose}
                onClick={() => setMobileMoreOpen(false)}
              >
                Close
              </button>
            </div>
            <div className={styles.mobileMoreGrid}>
              {MOBILE_MORE_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={styles.mobileMoreButton}
                  onClick={() => handleMobileTabSelect(tab)}
                >
                  <span className={styles.bottomTabIcon}>{iconForTab(tab)}</span>
                  <span>{tabTitle(tab)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {dailyPlanningLocked && !dailyPlanningOpen && (
        <div className={styles.dailyLockOverlay} onClick={() => setDailyPlanningOpen(true)}>
          <div className={styles.dailyLockCard} onClick={(event) => event.stopPropagation()}>
            <p className={styles.sectionLabel}>Daily Entry Ritual</p>
            <h2 className={styles.cardTitle}>Today is not claimed yet.</h2>
            <p className={styles.accountMeta}>
              Whelm stays locked until you place 3 blocks for today. Minimum 15 minutes each.
            </p>
            <button
              type="button"
              className={styles.reportButton}
              onClick={() => setDailyPlanningOpen(true)}
            >
              Place today&apos;s blocks
            </button>
          </div>
        </div>
      )}

      {dailyPlanningOpen && (dailyPlanningLocked || dailyPlanningPreviewOpen) && (
        <div className={styles.feedbackOverlay}>
          <div
            className={`${styles.feedbackModal} ${styles.dailyRitualModal}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.dailyRitualCornerIcon}>
              <DailyRitualWaveIcon
                className={styles.dailyRitualCornerIconImage}
                tierColor={streakBandanaTier?.color}
              />
            </div>
            <div className={styles.feedbackHeader}>
              <div>
                <p className={styles.sectionLabel}>Daily Entry Ritual</p>
                <h2 className={styles.feedbackTitle}>Claim today before it claims you.</h2>
              </div>
            </div>
            <p className={styles.feedbackMeta}>
              <strong className={styles.dailyRitualCallout}>3 foundational blocks to enter.</strong>{" "}
              {dailyPlanningPreviewOpen
                ? "Preview mode only. Inspect the flow without changing today."
                : "Place them before Whelm unlocks. Each one must be at least 15 minutes."}
            </p>
            <div className={styles.dailyRitualList}>
              {dailyRitualDrafts.map((draft, index) => {
                const locked = Boolean(draft.existingBlockId);
                const expanded = dailyRitualExpandedId === draft.id;
                return (
                  <div key={draft.id} className={styles.dailyRitualItem}>
                    <button
                      type="button"
                      className={styles.dailyRitualHeader}
                      onClick={() =>
                        setDailyRitualExpandedId((current) => (current === draft.id ? null : draft.id))
                      }
                    >
                      <div className={styles.dailyRitualHeaderMain}>
                        <strong>Block {index + 1}</strong>
                        <span>{locked ? "Claimed" : "Required"}</span>
                      </div>
                      <div className={styles.dailyRitualSummary}>
                        <span>{draft.title.trim() || "What are you protecting?"}</span>
                        <small>{draft.timeOfDay} • {draft.durationMinutes}m</small>
                      </div>
                    </button>
                    {expanded && (
                      <>
                        <div className={styles.dailyRitualGrid}>
                          <input
                            value={draft.title}
                            onChange={(event) =>
                              updateDailyRitualDraft(draft.id, { title: event.target.value })
                            }
                            placeholder="What are you protecting?"
                            className={styles.planInput}
                            disabled={locked}
                          />
                          <label className={styles.planLabel}>
                            Time
                            <input
                              type="time"
                              value={draft.timeOfDay}
                              onChange={(event) =>
                                updateDailyRitualDraft(draft.id, { timeOfDay: event.target.value })
                              }
                              className={styles.planControl}
                              disabled={locked}
                            />
                          </label>
                          <label className={styles.planLabel}>
                            Minutes
                            <input
                              type="number"
                              min={15}
                              max={240}
                              value={draft.durationMinutes}
                              onChange={(event) =>
                                updateDailyRitualDraft(draft.id, {
                                  durationMinutes: Number(event.target.value) || 0,
                                })
                              }
                              className={styles.planControl}
                              disabled={locked}
                            />
                          </label>
                        </div>
                        <textarea
                          value={draft.note}
                          onChange={(event) =>
                            updateDailyRitualDraft(draft.id, { note: event.target.value.slice(0, 280) })
                          }
                          placeholder="Optional note"
                          className={styles.dailyRitualNote}
                          disabled={locked}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {dailyPlanningStatus && <p className={styles.feedbackStatus}>{dailyPlanningStatus}</p>}
            <div className={`${styles.feedbackFooter} ${styles.dailyRitualFooter}`}>
              <button
                type="button"
                className={`${styles.feedbackClose} ${styles.dailyRitualFooterClose}`}
                onClick={() =>
                  dailyPlanningPreviewOpen ? closeDailyPlanningPreview() : setDailyPlanningOpen(false)
                }
              >
                Close
              </button>
              <button
                type="button"
                className={`${styles.feedbackSubmit} ${styles.dailyRitualSubmit}`}
                onClick={submitDailyRitual}
              >
                <span className={styles.dailyRitualSubmitLabelWrap}>
                  <span className={styles.dailyRitualSubmitLabel}>
                    {dailyPlanningPreviewOpen ? "Close preview" : "Submit"}
                  </span>
                </span>
                <span className={styles.dailyRitualSubmitBandanaPanel} aria-hidden="true">
                  <DailyRitualSubmitBandana className={styles.dailyRitualSubmitBandana} />
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {themePromptOpen && (
        <div className={styles.feedbackOverlay} onClick={() => setThemePromptOpen(false)}>
          <div className={styles.feedbackModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>Choose your theme</h2>
              <button
                type="button"
                className={styles.feedbackClose}
                onClick={() => setThemePromptOpen(false)}
              >
                Later
              </button>
            </div>
            <p className={styles.feedbackMeta}>
              Pick how Whelm should look when you return. You can change this later in Settings.
            </p>
            <div className={styles.companionStyleRow}>
              <button
                type="button"
                className={`${styles.companionStyleButton} ${
                  themeMode === "dark" ? styles.companionStyleButtonActive : ""
                }`}
                onClick={() => applyThemeMode("dark")}
              >
                Dark mode
              </button>
              <button
                type="button"
                className={`${styles.companionStyleButton} ${
                  themeMode === "light" ? styles.companionStyleButtonActive : ""
                }`}
                onClick={() => applyThemeMode("light")}
              >
                Light mode
              </button>
            </div>
          </div>
        </div>
      )}

      {streakSaveQuestionnaireOpen && (sickDaySaveEligible || streakSaveQuestionnairePreview) && (
        <div className={styles.feedbackOverlay} onClick={closeStreakSaveQuestionnaire}>
          <div className={styles.feedbackModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>Sick day accountability</h2>
              <button
                type="button"
                className={styles.feedbackClose}
                onClick={closeStreakSaveQuestionnaire}
              >
                Close
              </button>
            </div>
            <p className={styles.feedbackMeta}>
              {streakSaveQuestionnairePreview
                ? "Preview mode only. Fill it out and close it without changing the streak."
                : "A streak save now requires 5 direct answers. If yesterday was a real sick day, write it plainly and commit to today."}
            </p>
            <div className={styles.feedbackFormStack}>
              {STREAK_SAVE_ACCOUNTABILITY_QUESTIONS.map((question, index) => (
                <label key={question} className={styles.planLabel}>
                  {index + 1}. {question}
                  <textarea
                    value={streakSaveAnswers[question] ?? ""}
                    onChange={(event) =>
                      setStreakSaveAnswers((current) => ({
                        ...current,
                        [question]: event.target.value.slice(0, 280),
                      }))
                    }
                    className={styles.feedbackTextarea}
                    rows={3}
                  />
                </label>
              ))}
            </div>
            {streakSaveStatus && <p className={styles.feedbackStatus}>{streakSaveStatus}</p>}
            <div className={styles.noteFooterActions}>
              <button
                type="button"
                className={styles.feedbackSubmit}
                onClick={claimSickDaySave}
              >
                {streakSaveQuestionnairePreview ? "Close preview" : "Use sick day save"}
              </button>
              <button
                type="button"
                className={styles.secondaryPlanButton}
                onClick={closeStreakSaveQuestionnaire}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {sickDaySavePromptOpen && (sickDaySaveEligible || sickDaySavePromptPreview) && (
        <div className={styles.feedbackOverlay} onClick={dismissSickDaySavePrompt}>
          <div className={styles.feedbackModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>Yesterday broke your streak</h2>
              <button
                type="button"
                className={styles.feedbackClose}
                onClick={dismissSickDaySavePrompt}
              >
                Later
              </button>
            </div>
            <p className={styles.feedbackMeta}>
              If you genuinely missed yesterday because you were sick, you can review a one-day sick save in Streaks.
            </p>
            <div className={styles.noteFooterActions}>
              <button
                type="button"
                className={styles.feedbackSubmit}
                onClick={openSickDaySaveReview}
              >
                Open Streaks
              </button>
              <button
                type="button"
                className={styles.secondaryPlanButton}
                onClick={dismissSickDaySavePrompt}
              >
                Ask later
              </button>
            </div>
          </div>
        </div>
      )}

      {(noteUndoItem || deletedPlanUndo) && (
        <div className={styles.undoToast}>
          <span>
            {noteUndoItem
              ? `Deleted note: ${noteUndoItem.title || "Untitled note"}`
              : "Removed planned block"}
          </span>
          {noteUndoItem && (
            <button type="button" onClick={() => void undoDeleteNote()}>
              Undo note
            </button>
          )}
          {deletedPlanUndo && (
            <button type="button" onClick={undoDeletePlannedBlock}>
              Undo plan
            </button>
          )}
        </div>
      )}

      {paywallOpen && (
        <div className={styles.feedbackOverlay} onClick={() => setPaywallOpen(false)}>
          <div className={styles.paywallModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>Whelm Pro is forming</h2>
              <button type="button" className={styles.feedbackClose} onClick={() => setPaywallOpen(false)}>
                Close
              </button>
            </div>
            <p className={styles.paywallCopy}>
              Whelm Pro will add deeper analytics, expanded planning controls, and a cleaner focus experience.
            </p>
            <div className={styles.planGrid}>
              <article className={`${styles.planCard} ${styles.planCardFeatured}`}>
                <p className={styles.planName}>Founding release</p>
                <p className={styles.planPrice}>Soon</p>
                <p className={styles.planMeta}>early users will receive a strong launch offer</p>
              </article>
            </div>
            <ul className={styles.proList}>
              <li>Advanced discipline reports and score history</li>
              <li>Monthly streak intelligence and weekly reports</li>
              <li>Premium focus workflows and a cleaner workspace</li>
            </ul>
            <div className={styles.paywallActions}>
              <button type="button" className={styles.feedbackSubmit} onClick={() => setPaywallOpen(false)}>
                Continue with current version
              </button>
            </div>
            <p className={styles.paywallHint}>
              Billing is not live in this version. Whelm Pro will be introduced in a later release.
            </p>
          </div>
        </div>
      )}

      {kpiDetailOpen && (
        <div className={styles.feedbackOverlay} onClick={() => setKpiDetailOpen(null)}>
          <div className={styles.kpiModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>{kpiDetailContent[kpiDetailOpen].title}</h2>
              <button
                type="button"
                className={styles.feedbackClose}
                onClick={() => setKpiDetailOpen(null)}
              >
                Close
              </button>
            </div>
            <p className={styles.paywallCopy}>{kpiDetailContent[kpiDetailOpen].summary}</p>
            <ul className={styles.commandList}>
              {kpiDetailContent[kpiDetailOpen].bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {feedbackOpen && (
        <div
          className={styles.feedbackOverlay}
          onClick={() => {
            if (!feedbackSubmitting) {
              setFeedbackOpen(false);
              setFeedbackStatus("");
            }
          }}
        >
          <div className={styles.feedbackModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>Send feedback</h2>
              <button
                type="button"
                className={styles.feedbackClose}
                disabled={feedbackSubmitting}
                onClick={() => {
                  setFeedbackOpen(false);
                  setFeedbackStatus("");
                }}
              >
                Close
              </button>
            </div>

            <div className={styles.feedbackMeta}>
              <span>{user.email || "Unknown email"}</span>
            </div>

            <label className={styles.feedbackLabel} htmlFor="feedback-category">
              Category
            </label>
            <select
              id="feedback-category"
              value={feedbackCategory}
              onChange={(event) => setFeedbackCategory(event.target.value as FeedbackCategory)}
              className={styles.feedbackSelect}
              disabled={feedbackSubmitting}
            >
              <option value="bug">Bug</option>
              <option value="feature">Feature</option>
              <option value="other">Other</option>
            </select>

            <label className={styles.feedbackLabel} htmlFor="feedback-message">
              Message
            </label>
            <textarea
              id="feedback-message"
              value={feedbackMessage}
              onChange={(event) => setFeedbackMessage(event.target.value)}
              className={styles.feedbackTextarea}
              placeholder="What happened? What should change?"
              maxLength={2000}
              disabled={feedbackSubmitting}
            />

            <div className={styles.feedbackFooter}>
              <button
                type="button"
                className={styles.feedbackSubmit}
                onClick={submitFeedback}
                disabled={feedbackSubmitting}
              >
                {feedbackSubmitting ? "Sending..." : "Send feedback"}
              </button>
              {feedbackStatus && <p className={styles.feedbackStatus}>{feedbackStatus}</p>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
