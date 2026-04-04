"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { type User } from "firebase/auth";
import { ref as storageRef } from "firebase/storage";

import BottomNav from "@/components/BottomNav";
import AnimatedTabSection from "@/components/AnimatedTabSection";
import BlockDetailModal from "@/components/BlockDetailModal";
import CalendarTonePicker from "@/components/CalendarTonePicker";
import CollapsibleSectionCard from "@/components/CollapsibleSectionCard";
import DailyPlanningModal from "@/components/DailyPlanningModal";
import { DailyRitualSubmitBandana, DailyRitualWaveIcon } from "@/components/DailyRitualDecorations";
import HomeActiveTabContent from "@/components/HomeActiveTabContent";
import HomeOverlayHost from "@/components/HomeOverlayHost";
import FeedbackModal from "@/components/FeedbackModal";
import HomeShellFrame, {
  MOBILE_MORE_TABS,
  renderAppNavIcon,
  tabTitle,
} from "@/components/HomeShellFrame";
import IntroSplash from "@/components/IntroSplash";
import KpiDetailModal from "@/components/KpiDetailModal";
import LeaderboardProfileModal from "@/components/LeaderboardProfileModal";
import MobileMoreSheet from "@/components/MobileMoreSheet";
import OnboardingTour, { type OnboardingTourStep } from "@/components/OnboardingTour";
import PaywallModal from "@/components/PaywallModal";
import ProfileSheet from "@/components/ProfileSheet";
import QuickCardModal from "@/components/QuickCardModal";
import SessionRewardToast from "@/components/SessionRewardToast";
import ThemePromptModal from "@/components/ThemePromptModal";
import StreakOverlayCluster from "@/components/StreakOverlayCluster";
import XpBandanaLevelMark from "@/components/XpBandanaLevelMark";
import WhelMascot from "@/components/WhelMascot";
import WhelmEmote from "@/components/WhelmEmote";
import WhelmRitualScene from "@/components/WhelmRitualScene";
import CardsTab from "@/components/CardsTab";
import XPPopAnimation, { type XPPop } from "@/components/XPPopAnimation";
import WhelToastContainer, { useToasts } from "@/components/WhelToast";
import { createCard, loadCards, normalizeCards, readLocalCards, saveCards } from "@/lib/cards-store";
import {
  trackAppOpened,
  trackStreakUpdated,
  trackTaskCreated,
} from "@/lib/analytics-tracker";
import { resolveApiUrl } from "@/lib/api-base";
import { getCalendarToneMeta, type CalendarTone } from "@/lib/calendar-tones";
import { auth, db, storage } from "@/lib/firebase";
import {
  type WorkspaceNote,
  mergeNotesPreferNewest,
  saveNotes,
} from "@/lib/notes-store";
import {
  type PreferencesBackgroundSetting,
  type PreferencesBackgroundSkin,
  savePreferences,
} from "@/lib/preferences-store";
import { dedupeSessions, loadSessions, saveSessionsLocally, syncMissingSessionsToCloud } from "@/lib/session-store";
import {
  clearLocalAccountData,
  loadDayTones,
  loadMonthTones,
  saveDayTones,
  saveMonthTones,
} from "@/lib/page-shell-local";
import { getProfileTierTheme } from "@/lib/profile-tier";
import {
  computeStreak,
  computeStreakEndingAtDateKey,
  type SessionDoc,
} from "@/lib/streak";
import {
  buildSenseiCompanionState,
  type SenseiCompanionStyle,
} from "@/lib/sensei-companion";
import {
  getStreakBandanaTier,
  STREAK_BANDANA_TIERS,
  type StreakBandanaTier,
} from "@/lib/streak-bandanas";
import { buildPerformanceNotificationPlan } from "@/lib/performance-notifications";
import {
  buildStreakProfilePresentation,
  buildStreakTodayPresentation,
} from "@/lib/streak-presentation";
import { buildShellStreakRecord } from "@/lib/streak-record";
import { subscribeToUserData } from "@/lib/firestore-sync";
import { logClientRuntime } from "@/lib/client-runtime";
import type { AppTab } from "@/lib/app-tabs";
import { monthKeyLocal } from "@/lib/date-utils";
import { buildWhelmArchive, parseWhelmArchive, saveWhelmArchive } from "@/lib/whelm-archive";
import { exportReadableNotesZip } from "@/lib/whelm-notes-export";
import { WHELM_PRO_NAME } from "@/lib/whelm-plans";
import { mergeBlocksPreferNewest, savePlannedBlocks } from "@/lib/planned-blocks-store";
import { saveReflectionState } from "@/lib/reflection-store";
import {
  clearStoredTodayLaunchRequest,
  readStoredTodayLaunchRequest,
  TODAY_LAUNCH_REQUEST_EVENT,
  type TodayLaunchRequest,
} from "@/lib/today-launch";
import {
  clearTodayAlarmInstance,
  completeTodayAlarmInstance,
  getActiveTodayAlarmInstance,
  getLatestMissedTodayAlarmInstance,
  markTodayAlarmInstanceEffectApplied,
  readStoredTodayAlarmInstances,
  resolveTodayAlarmMode,
  snoozeTodayAlarmInstance,
  startTodayAlarmInstanceFromLaunch,
  sweepMissedTodayAlarmInstances,
  TODAY_ALARM_INSTANCES_EVENT,
  type TodayAlarmInstance,
} from "@/lib/today-alarm-instances";
import { readStoredTodayAlarms } from "@/lib/today-alarms";
import {
  buildDayXpSummaryForDate,
  doesDateQualifyForStreak,
  formatXpMultiplier,
  getLifetimeXpSummary,
  STREAK_RULE_V2_START_DATE,
  XP_DAILY_CAP,
  XP_DAILY_TARGET,
  XP_FOCUS_DAILY_CAP,
  XP_COMPLETED_BLOCK_XP,
  XP_COMPLETED_BLOCK_DAILY_CAP,
  XP_STREAK_DAILY_BONUS,
  XP_COMBO_BONUS,
  XP_DEEP_WORK_BONUS,
  XP_WRITING_ENTRY_THRESHOLD,
  XP_WRITING_ENTRY_BONUS,
  XP_WRITING_BONUS_THRESHOLD,
  XP_WRITING_BONUS_XP,
  XP_WRITING_DAILY_CAP,
  type DayXpSummary,
  type LifetimeXpSummary,
  type SessionRewardState,
  type StreakCelebrationState,
  type StreakNudgeState,
} from "@/lib/xp-engine";
import { useNotes } from "@/hooks/useNotes";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useFriends } from "@/hooks/useFriends";
import { usePageShellViewModel } from "@/hooks/usePageShellViewModel";
import { usePlannedBlocks } from "@/hooks/usePlannedBlocks";
import type { TodayTimeHubRequest } from "@/hooks/useTodayTimeHub";
import { useAccountSettings } from "@/hooks/useAccountSettings";
import { useCalendarAgenda } from "@/hooks/useCalendarAgenda";
import { usePreferences } from "@/hooks/usePreferences";
import { useCalendarInteractions } from "@/hooks/useCalendarInteractions";
import { useCompanionMetrics } from "@/hooks/useCompanionMetrics";
import { useHistoryData } from "@/hooks/useHistoryData";
import { useModalFlows } from "@/hooks/useModalFlows";
import { useReflection } from "@/hooks/useReflection";
import { useReportsAnalytics } from "@/hooks/useReportsAnalytics";
import {
  type NotesShellHandlers,
  type NotesShellRefs,
  type NotesShellState,
} from "@/hooks/useNotesShellViewModel";
import {
  type ScheduleShellHandlers,
  type ScheduleShellRefs,
  type ScheduleShellState,
} from "@/hooks/useScheduleShellViewModel";
import {
  type TodayShellHandlers,
  type TodayShellRefs,
  type TodayShellState,
} from "@/hooks/useTodayShellViewModel";
import { useSessions } from "@/hooks/useSessions";
import { useShellLifecycle } from "@/hooks/useShellLifecycle";
import { useShellStreakState } from "@/hooks/useShellStreakState";
import { useTabNavigation } from "@/hooks/useTabNavigation";
import { useUserData } from "@/hooks/useUserData";
import { useWhelmNotifications } from "@/hooks/useWhelmNotifications";
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

const PRO_HISTORY_FREE_DAYS = 14;

const PRO_BACKGROUND_PRESETS = [
  {
    id: "whelm_core",
    label: "Core Glow",
    background:
      "radial-gradient(circle at 50% 12%, rgba(158, 212, 255, 0.46), transparent 24%), radial-gradient(circle at 50% 50%, rgba(72, 108, 255, 0.34), transparent 30%), radial-gradient(circle at 50% 78%, rgba(201, 96, 255, 0.28), transparent 22%), linear-gradient(180deg, #3a63c7 0%, #2d4ea8 24%, #2d328f 56%, #37257b 78%, #2a1f63 100%)",
  },
  {
    id: "blue_halo",
    label: "Blue Halo",
    background:
      "radial-gradient(circle at 50% 10%, rgba(181, 244, 255, 0.48), transparent 22%), radial-gradient(circle at 46% 46%, rgba(74, 211, 255, 0.34), transparent 28%), radial-gradient(circle at 56% 72%, rgba(86, 120, 255, 0.26), transparent 22%), linear-gradient(180deg, #2e72d6 0%, #2558ba 28%, #24439b 62%, #25306e 100%)",
  },
  {
    id: "violet_orbit",
    label: "Violet Orbit",
    background:
      "radial-gradient(circle at 50% 10%, rgba(187, 144, 255, 0.34), transparent 22%), radial-gradient(circle at 48% 44%, rgba(140, 88, 255, 0.3), transparent 28%), radial-gradient(circle at 52% 76%, rgba(247, 109, 255, 0.3), transparent 22%), linear-gradient(180deg, #5b56cf 0%, #4b3db3 28%, #4a2f93 62%, #331d63 100%)",
  },
  {
    id: "midnight_glass",
    label: "Night Pulse",
    background:
      "radial-gradient(circle at 50% 10%, rgba(255, 255, 255, 0.2), transparent 18%), radial-gradient(circle at 50% 42%, rgba(112, 143, 255, 0.24), transparent 26%), radial-gradient(circle at 50% 74%, rgba(154, 87, 255, 0.22), transparent 20%), linear-gradient(180deg, #314a8e 0%, #28396f 30%, #241f53 66%, #171334 100%)",
  },
] as const;

const MIN_PLANNED_BLOCK_MINUTES = 15;
const MAX_PLANNED_BLOCK_MINUTES = 240;
const MIN_PLANNED_BLOCK_GAP_MINUTES = 15;

const WHELM_BRAND_THESIS = "Whelm is where productivity becomes a standard, not a mood.";
const WHELM_PRO_POSITIONING =
  "Whelm Pro unlocks unlimited history, full customization, and the deeper version of the Whelm system.";
const STREAK_MIRROR_MIN_WORDS = 33;
const STREAK_SAVE_ACCOUNTABILITY_QUESTIONS = [
  "What honestly pulled you off track yesterday?",
  "What part of it was outside your control, and what part was yours?",
  "What is the first concrete action you will complete today to get back in line?",
] as const;
const STREAK_MIRROR_TAGS = [
  { value: "forgot", label: "Forgot", accent: "#8ec5ff" },
  { value: "lazy", label: "Lazy", accent: "#f4a261" },
  { value: "too_busy", label: "Too busy", accent: "#ff8fab" },
  { value: "low_energy", label: "Low energy", accent: "#7dd3c7" },
  { value: "disorganized", label: "Disorganized", accent: "#c4b5fd" },
  { value: "other", label: "Other", accent: "#facc15" },
] as const;
const STREAK_MIRROR_SAYINGS = [
  "Honest reflection protects stronger returns. What you face clearly, you can change clearly.",
  "Looking back without hiding is part of keeping the streak real.",
  "This space is private. Use it to be honest, reset clearly, and move forward.",
  "The win here is accuracy, not perfection.",
] as const;
const NOTE_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
const NOTE_ATTACHMENT_UPLOAD_IDLE_TIMEOUT_MS = 15000;
const NOTE_ATTACHMENT_UPLOAD_TOTAL_TIMEOUT_MS = 120000;
const NOTE_ATTACHMENT_ACCEPT = [
  "image/*",
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".md",
  ".rtf",
  ".pages",
  ".numbers",
  ".key",
  ".zip",
].join(",");

type FeedbackCategory = "bug" | "feature" | "other";
type TrendRange = 7 | 30 | 90;
type CalendarView = "month" | "day";
type ThemeMode = "dark" | "light" | "system";
type DailyRitualBlockDraft = {
  id: string;
  existingBlockId?: string;
  title: string;
  note: string;
  tone: CalendarTone | null;
  timeOfDay: string;
  durationMinutes: number;
};

type LeaderboardEntry = {
  id: string;
  username: string;
  createdAtISO: string;
  level: number;
  totalXp: number;
  currentStreak: number;
  bestStreak?: number;
  totalFocusHours?: number;
  avatarUrl?: string | null;
  isProStyle?: boolean;
  isCurrentUser?: boolean;
};
type LeaderboardBandanaHolder = {
  color: string;
  label: string;
  entry: LeaderboardEntry | null;
};
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
  tone?: CalendarTone;
};

type TrendPoint = {
  label: string;
  minutes: number;
};

type PlannedBlock = {
  id: string;
  dateKey: string;
  title: string;
  note: string;
  attachmentCount?: number;
  tone?: CalendarTone;
  durationMinutes: number;
  timeOfDay: string;
  sortOrder: number;
  createdAtISO: string;
  updatedAtISO: string;
  status: "active" | "completed" | "deleted";
  completedAtISO?: string;
};

function shiftBlockTime(timeOfDay: string, durationMinutes: number) {
  const [rawHours, rawMinutes] = timeOfDay.split(":").map((part) => Number(part));
  const hours = Number.isFinite(rawHours) ? rawHours : 9;
  const minutes = Number.isFinite(rawMinutes) ? rawMinutes : 0;
  const startMinutes = Math.min(24 * 60 - 1, Math.max(0, hours * 60 + minutes));
  const shiftedMinutes = Math.min(24 * 60 - 15, startMinutes + Math.max(15, durationMinutes) + 10);
  const nextHours = Math.floor(shiftedMinutes / 60);
  const nextMinutes = shiftedMinutes % 60;
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

type DayToneMap = Record<string, CalendarTone>;
type MonthToneMap = Record<string, CalendarTone>;

type KpiDetailKey =
  | "totalFocus"
  | "totalSessions"
  | "averageSession"
  | "bestDay"
  | "weeklyProgress";

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

function attachmentIndicatorLabel(count: number) {
  return `📎 ${count}`;
}

function normalizeBodyForEditor(body: string) {
  if (!body) return "";

  const hasHtmlTags = /<[a-z!/]/i.test(body);
  if (!hasHtmlTags) {
    // Plain text: convert newlines to br so the editor renders line breaks
    return body.replaceAll("\n", "<br/>");
  }

  // HTML body: return as-is. The browser handles entity decoding when setting innerHTML.
  // Do NOT run decodeHtmlEntities here — it uses textarea.value which strips all HTML
  // elements, silently discarding every line after the first <div> or <br>.
  return body;
}

function isEffectivelyEmptyEditorHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, "")
    .replace(/<[^>]*>/g, "")
    .trim().length === 0;
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

function startOfDayLocal(dateInput?: string | Date) {
  const value =
    typeof dateInput === "string" ? new Date(dateInput) : dateInput ? new Date(dateInput) : new Date();
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

function isDateKeyWithinRecentWindow(dateKey: string, days: number) {
  const cutoff = dayKeyLocal(addDaysLocal(new Date(), -(Math.max(1, days) - 1)));
  return dateKey >= cutoff;
}

function normalizePlannableDateKey(dateKey: string) {
  return isDateKeyBeforeToday(dateKey) ? dayKeyLocal(new Date()) : dateKey;
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

type AppBackgroundSetting =
  | { kind: "default" }
  | { kind: "preset"; value: string }
  | { kind: "upload"; value: string };

type BackgroundSkinSetting = {
  mode: "solid" | "glass";
  dim: number;
  surfaceOpacity: number;
  blur: number;
  imageFit: "fill" | "fit";
};

const DEFAULT_BACKGROUND_SKIN: BackgroundSkinSetting = {
  mode: "glass",
  dim: 0.58,
  surfaceOpacity: 0.72,
  blur: 18,
  imageFit: "fit",
};



function getStreakTierColorTheme(tierColor: string | null | undefined) {
  switch (tierColor) {
    case "white":
      return {
        accent: "#f6fbff",
        accentStrong: "#dbeafe",
        accentDeep: "#93c5fd",
        accentGlow: "rgba(255, 255, 255, 0.34)",
        shell: "rgba(218, 233, 255, 0.18)",
        textStrong: "#08101e",
        textSoft: "rgba(11, 24, 46, 0.76)",
      };
    case "black":
      return {
        accent: "#8f9fc7",
        accentStrong: "#56698d",
        accentDeep: "#293750",
        accentGlow: "rgba(142, 163, 207, 0.28)",
        shell: "rgba(62, 79, 112, 0.24)",
        textStrong: "#f5f8ff",
        textSoft: "rgba(227, 235, 255, 0.8)",
      };
    case "blue":
      return {
        accent: "#59c7ff",
        accentStrong: "#2f86ff",
        accentDeep: "#143d9a",
        accentGlow: "rgba(84, 173, 255, 0.34)",
        shell: "rgba(48, 106, 212, 0.24)",
        textStrong: "#f5fbff",
        textSoft: "rgba(222, 241, 255, 0.86)",
      };
    case "purple":
      return {
        accent: "#bf86ff",
        accentStrong: "#8a4dff",
        accentDeep: "#4a2398",
        accentGlow: "rgba(174, 98, 255, 0.34)",
        shell: "rgba(104, 55, 177, 0.25)",
        textStrong: "#fbf8ff",
        textSoft: "rgba(241, 231, 255, 0.86)",
      };
    case "green":
      return {
        accent: "#59e07f",
        accentStrong: "#1fb850",
        accentDeep: "#0e6b30",
        accentGlow: "rgba(77, 212, 124, 0.32)",
        shell: "rgba(22, 122, 55, 0.24)",
        textStrong: "#f6fff8",
        textSoft: "rgba(225, 255, 233, 0.84)",
      };
    case "red":
      return {
        accent: "#ff7676",
        accentStrong: "#f24545",
        accentDeep: "#a11f2a",
        accentGlow: "rgba(255, 92, 92, 0.32)",
        shell: "rgba(166, 36, 48, 0.24)",
        textStrong: "#fff8f8",
        textSoft: "rgba(255, 229, 229, 0.84)",
      };
    case "yellow":
    default:
      return {
        accent: "#ffd84d",
        accentStrong: "#ffb400",
        accentDeep: "#b56f00",
        accentGlow: "rgba(255, 196, 38, 0.32)",
        shell: "rgba(171, 112, 10, 0.22)",
        textStrong: "#fff9ee",
        textSoft: "rgba(255, 242, 214, 0.84)",
      };
  }
}
















function getPageShellBackgroundStyle(
  themeMode: ThemeMode,
  setting: AppBackgroundSetting,
  skin: BackgroundSkinSetting,
): CSSProperties | undefined {
  if (setting.kind === "default") return undefined;

  if (setting.kind === "preset") {
    const preset = PRO_BACKGROUND_PRESETS.find((item) => item.id === setting.value);
    if (!preset) return undefined;
    if (skin.mode === "solid") {
      return { background: preset.background };
    }
    return {
      backgroundImage: `linear-gradient(180deg, rgba(7, 9, 18, ${skin.dim}), rgba(14, 18, 34, ${Math.min(
        0.94,
        skin.dim + 0.12,
      )})), ${preset.background}`,
      backgroundAttachment: "scroll",
      backgroundSize: "cover",
      backgroundPosition: "center top",
      backgroundRepeat: "repeat-y",
      backgroundColor: themeMode === "light" ? "#ece8de" : "#0d1121",
    };
  }

  if (!setting.value) return undefined;
  const uploadOverlayStart = skin.mode === "glass" ? skin.dim : 0.68;
  const uploadOverlayEnd = skin.mode === "glass" ? Math.min(0.98, skin.dim + 0.16) : 0.86;
  const uploadFitMode = skin.imageFit === "fit";
  return {
    backgroundImage: `linear-gradient(180deg, rgba(7, 9, 18, ${uploadOverlayStart}), rgba(14, 18, 34, ${uploadOverlayEnd})), url("${setting.value}")`,
    backgroundSize: uploadFitMode ? "100% auto" : "cover",
    backgroundPosition: uploadFitMode ? "center top" : "center top",
    backgroundRepeat: uploadFitMode ? "repeat-y" : "no-repeat",
    backgroundAttachment: "scroll",
    backgroundColor: themeMode === "light" ? "#f6f2eb" : "#0d1121",
  };
}

const ONBOARDING_STEPS: OnboardingTourStep[] = [
  {
    id: "schedule",
    selector: '[data-tour="nav-schedule"]',
    pose: "thinking_idea",
    color: "yellow",
    mobileContextPaddingX: 20,
    mobileContextPaddingY: 18,
    title: "Start in Schedule",
    body:
      "This is your command map. Plan the day here first so Whelm is built around deliberate blocks, not random effort.",
  },
  {
    id: "block",
    selector: '[data-tour="schedule-add-block"]',
    pose: "focus_action",
    color: "red",
    mobileContextPaddingX: 18,
    mobileContextPaddingY: 18,
    title: "Blocks are worth 10 XP",
    body:
      "Add a block here. Each completed block gives 10 XP, and block XP caps at 50 per day. This is the first half of protecting your day.",
  },
  {
    id: "timer",
    selector: '[data-tour="today-timer"]',
    pose: "ready_idle",
    color: "green",
    mobileContextPaddingX: 14,
    mobileContextPaddingY: 16,
    title: "Run the focus timer",
    body:
      "This is where execution happens. Every 30 minutes of focus gives 20 XP, 90+ minutes unlocks a deep work bonus, and the stopwatch Whelm art changes every 5 minutes while you are running.",
  },
  {
    id: "xp",
    selector: '[data-tour="xp-dock"]',
    pose: "celebrate_success",
    color: "purple",
    mobileContextPaddingX: 20,
    mobileContextPaddingY: 18,
    title: "Know the XP system",
    body:
      "Your daily target is 120 XP and the hard max is 150. Complete one block plus 30 focused minutes or 33 written words to trigger the combo bonus and protect the streak.",
  },
  {
    id: "notes",
    selector: '[data-tour="notes-create"]',
    pose: "thinking_idea",
    color: "blue",
    mobileContextPaddingX: 20,
    mobileContextPaddingY: 18,
    title: "Capture notes fast",
    body:
      "Use Notes+ to keep ideas, plans, and session notes alive. Writing 33+ words starts a writing XP bonus, and 100+ words reaches the full daily writing reward.",
  },
  {
    id: "cards",
    selector: '[data-tour="notes-cards-toggle"]',
    pose: "focus_action",
    color: "black",
    mobileContextPaddingX: 22,
    mobileContextPaddingY: 18,
    title: "Turn notes into flashcards",
    body:
      "Open Cards here to convert what matters into flashcards. Notes capture the idea. Cards train recall and keep the learning loop active.",
  },
  {
    id: "whelmboard",
    selector: '[data-tour="whelmboard-surfaces"]',
    pose: "celebrate_success",
    color: "white",
    contextPaddingX: 260,
    contextPaddingY: 220,
    mobileContextPaddingX: 30,
    mobileContextPaddingY: 120,
    title: "Climb the Whelmboard",
    body:
      "Track your global rank by XP or streak, add friends, accept requests, send nudges, and check Bandana Tiers to see who is holding each level.",
  },
  {
    id: "replay",
    selector: '[data-tour="settings-replay-tutorial"]',
    pose: "meditating",
    color: "yellow",
    title: "Need a refresher later?",
    body:
      "This replay tutorial button lives in Settings. The full tour only auto-shows once for a new user, but you can return here anytime to review the flow or the XP system.",
  },
];

const ONBOARDING_NEW_USER_WINDOW_MS = 24 * 60 * 60 * 1000;

function onboardingStorageKey(uid: string) {
  return `whelm:onboarding-tour:v1:${uid}`;
}

export default function HomePage() {
  const router = useRouter();
  const liveTodayKey = dayKeyLocal(new Date());

  const [mobileTodayOverviewOpen, setMobileTodayOverviewOpen] = useState(false);
  const [todayTimeHubRequest, setTodayTimeHubRequest] = useState<TodayTimeHubRequest | null>(null);
  const [todayAlarmInstances, setTodayAlarmInstances] = useState<TodayAlarmInstance[]>([]);
  const [senseiReaction, setSenseiReaction] = useState("");
  const [landingWisdomMinute, setLandingWisdomMinute] = useState(() => Math.floor(Date.now() / 60000));
  const [trendRange, setTrendRange] = useState<TrendRange>(7);
  const [activeTab, setActiveTab] = useState<AppTab>("calendar");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStepIndex, setOnboardingStepIndex] = useState(0);
  const [selectedLbProfile, setSelectedLbProfile] = useState<{ entry: LeaderboardEntry; rank: number } | null>(null);
  const [insightMetric, setInsightMetric] = useState<InsightMetric>("focus");
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [dayTones, setDayTones] = useState<DayToneMap>({});
  const [monthTones, setMonthTones] = useState<MonthToneMap>({});
  const { toasts: whelToasts, showToast, dismissToast } = useToasts();
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [streakRulesOpen, setStreakRulesOpen] = useState(false);
  const [settingsSectionsOpen, setSettingsSectionsOpen] = useState({
    identity: false,
    internalTools: false,
    protocol: false,
    appearance: false,
    background: false,
    archive: false,
    notifications: false,
    sync: false,
    screenTime: false,
    danger: false,
    legal: false,
  });
  const [archiveExportBusy, setArchiveExportBusy] = useState(false);
  const [archiveExportStatus, setArchiveExportStatus] = useState("");
  const [notesExportBusy, setNotesExportBusy] = useState(false);
  const [notesExportStatus, setNotesExportStatus] = useState("");
  const [archiveImportBusy, setArchiveImportBusy] = useState(false);
  const archiveImportInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingArchiveImport, setPendingArchiveImport] = useState<{
    fileName: string;
    archive: ReturnType<typeof buildWhelmArchive>;
  } | null>(null);
  const [reportsSectionsOpen, setReportsSectionsOpen] = useState({
    score: false,
    insights: false,
    timing: false,
    subjects: false,
    notifications: false,
  });
  const backgroundUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [mobileCalendarControlsOpen, setMobileCalendarControlsOpen] = useState(false);
  const [mobileAgendaEntriesOpen, setMobileAgendaEntriesOpen] = useState(false);

  const todaySummaryRef = useRef<HTMLElement | null>(null);
  const todaySectionRef = useRef<HTMLElement | null>(null);
  const todayTimerRef = useRef<HTMLDivElement | null>(null);
  const todayQueueRef = useRef<HTMLElement | null>(null);
  const calendarSectionRef = useRef<HTMLElement | null>(null);
  const calendarHeroRef = useRef<HTMLDivElement | null>(null);
  const calendarMonthRef = useRef<HTMLElement | null>(null);
  const calendarStreakRef = useRef<HTMLElement | null>(null);
  const calendarPlannerRef = useRef<HTMLElement | null>(null);
  const calendarTimelineRef = useRef<HTMLDivElement | null>(null);
  const mirrorSectionRef = useRef<HTMLElement | null>(null);
  const mirrorEntriesAnchorRef = useRef<HTMLDivElement | null>(null);
  const leaderboardSectionRef = useRef<HTMLElement | null>(null);
  const leaderboardPrimaryRef = useRef<HTMLElement | null>(null);
  const historySectionRef = useRef<HTMLElement | null>(null);
  const historyPrimaryRef = useRef<HTMLElement | null>(null);
  const reportsSectionRef = useRef<HTMLElement | null>(null);
  const reportsPrimaryRef = useRef<HTMLElement | null>(null);
  const streaksSectionRef = useRef<HTMLElement | null>(null);
  const streaksPrimaryRef = useRef<HTMLElement | null>(null);
  const settingsSectionRef = useRef<HTMLElement | null>(null);
  const settingsPrimaryRef = useRef<HTMLElement | null>(null);
  const mobileDayTimelineScrollRef = useRef<HTMLDivElement | null>(null);
  const onboardingAutostartedRef = useRef(false);
  const {
    feedbackOpen,
    setFeedbackOpen,
    feedbackCategory,
    setFeedbackCategory,
    feedbackMessage,
    setFeedbackMessage,
    feedbackStatus,
    setFeedbackStatus,
    feedbackSubmitting,
    profileOpen,
    setProfileOpen,
    paywallOpen,
    setPaywallOpen,
    isPro,
    proSource,
    subscriptionBusy,
    subscriptionStatus,
    proPanelsOpen,
    setProPanelsOpen,
    screenTimeStatus,
    screenTimeSupported,
    screenTimeReason,
    screenTimeBusy,
    deletingAccount,
    accountDangerStatus,
    accountStateHydrated,
    submitFeedback,
    handleStartProPreview,
    handleRestorePurchases,
    handleRequestScreenTimeAuth,
    handleOpenScreenTimeSettings,
    handleDeleteAccount,
    openUpgradeFlow,
    handleManageSubscription,
    handleSignOut,
  } = useAccountSettings({
    user: auth.currentUser,
    clearLocalAccountData,
  });
  const {
    plannedBlocks,
    setPlannedBlocks,
    plannedBlocksHydrated,
    setPlannedBlocksHydrated,
    completedBlocksByDay,
    todayPlannedBlocks,
    todayActivePlannedBlocks,
    claimedBlocksToday,
    dailyPlanningLocked,
    dailyPlanningOpen,
    setDailyPlanningOpen,
    dailyPlanningStatus,
    setDailyPlanningStatus,
    dailyRitualDrafts,
    dailyRitualExpandedId,
    setDailyRitualExpandedId,
    selectedCalendarDate,
    setSelectedCalendarDate,
    calendarCursor,
    setCalendarCursor,
    calendarHoverEntryId,
    setCalendarHoverEntryId,
    calendarPinnedEntryId,
    setCalendarPinnedEntryId,
    calendarAuxPanel,
    setCalendarAuxPanel,
    calendarJumpDate,
    setCalendarJumpDate,
    draggedPlanId,
    setDraggedPlanId,
    pendingCalendarEntryFocusId,
    setPendingCalendarEntryFocusId,
    activatedCalendarEntryId,
    setActivatedCalendarEntryId,
    overlapPickerEntryId,
    setOverlapPickerEntryId,
    selectedPlanDetailId,
    setSelectedPlanDetailId,
    plannerSectionsOpen,
    setPlannerSectionsOpen,
    deletedPlanUndo,
    dailyPlanningPreviewOpen,
    setDailyPlanningPreviewOpen,
    selectedDateKey,
    selectedDateCanAddBlocks,
    selectedDatePlans,
    handleBlocksSnapshot,
    handleUserSignedIn: handlePlannedBlocksSignedIn,
    handleUserSignedOut: handlePlannedBlocksSignedOut,
    persistPlannedBlocks,
    selectCalendarDate,
    jumpToToday,
    savePlannedBlock,
    closeDailyPlanningPreview,
    deletePlannedBlock,
    undoDeletePlannedBlock,
    updatePlannedBlockTime,
    reorderPlannedBlocks,
    updatePlannedBlockTone,
    updateDailyRitualDraft,
    submitDailyRitual,
  } = usePlannedBlocks({
    isPro,
    liveTodayKey,
    showToast,
    onNavigateToCalendarDay: () => {
      setActiveTab("calendar");
      setCalendarView("day");
    },
    onTrackTaskCreated: (block, source) => {
      if (!user) return;
      fireAndForgetTracking(
        trackTaskCreated(user, {
          taskId: block.id,
          scheduledDate: block.dateKey,
          durationMinutes: block.durationMinutes,
          subjectMode: analyticsSubjectModeFromText(`${block.title} ${block.note}`),
          source,
        }),
      );
    },
  });

  const {
    notes,
    setNotes,
    selectedNoteId,
    setSelectedNoteId,
    selectedNote,
    orderedNotes,
    filteredNotes,
    dueReminderNotes,
    hasLockedNotesHistory,
    noteWordsByDay,
    pendingXpPop,
    clearPendingXpPop,
    selectedNoteSurfaceColor,
    selectedNotePageColor,
    selectedNoteWordCount,
    notesSyncStatus,
    setNotesSyncStatus,
    notesSyncMessage,
    setNotesSyncMessage,
    notesRef,
    selectedNoteIdRef,
    bodyDirtyRef,
    editorRef,
    noteBodyShellRef,
    noteAttachmentInputRef,
    notesSectionRef,
    notesStartRef,
    notesRecentRef,
    notesEditorRef,
    notesSurface,
    setNotesSurface,
    colorPickerOpen,
    setColorPickerOpen,
    shellColorPickerOpen,
    setShellColorPickerOpen,
    textColorPickerOpen,
    setTextColorPickerOpen,
    highlightPickerOpen,
    setHighlightPickerOpen,
    editorBandanaCaret,
    setEditorBandanaCaret,
    notesSearch,
    setNotesSearch,
    notesCategoryFilter,
    setNotesCategoryFilter,
    noteUndoItem,
    mobileNotesRecentOpen,
    setMobileNotesRecentOpen,
    mobileNotesEditorOpen,
    setMobileNotesEditorOpen,
    mobileNotesToolsOpen,
    setMobileNotesToolsOpen,
    selectionPopup,
    setSelectionPopup,
    quickCardForm,
    setQuickCardForm,
    noteAttachmentBusy,
    noteAttachmentStatus,
    pendingNoteAttachments,
    applyNotesSnapshot,
    handleUserSignedIn,
    handleUserSignedOut,
    createWorkspaceNote,
    updateSelectedNote,
    flushPendingTitleSync,
    flushSelectedNoteDraft,
    togglePinned,
    captureEditorDraft,
    saveEditorSelection,
    checkEditorSelection,
    handleQuickCardSave,
    updateEditorBandanaCaret,
    applyEditorCommand,
    applyHighlightColor,
    deleteNote,
    undoDeleteNote,
    handleRetrySync,
    openNoteAttachmentPicker,
    openNoteAttachment,
    handleNoteAttachmentInput,
    removeNoteAttachment,
  } = useNotes({
    isPro,
    isMobileViewport,
    onNavigateToNotes: () => setActiveTab("notes"),
  });

  const {
    sickDaySaves,
    sickDaySaveDismissals,
    protectedStreakDateKeys,
    sickDaySavePromptOpen,
    sickDaySavePromptPreview,
    streakSaveQuestionnaireOpen,
    streakSaveQuestionnairePreview,
    mirrorSectionsOpen,
    mirrorPrivacyOpen,
    streakMirrorEntries,
    streakMirrorTag,
    streakSaveAnswers,
    streakSaveStatus,
    streakMirrorVisibleEntries,
    selectedStreakMirrorEntry,
    streakMirrorSaying,
    setSickDaySavePromptOpen,
    setMirrorSectionsOpen,
    setMirrorPrivacyOpen,
    setSelectedStreakMirrorId,
    setStreakMirrorTag,
    setStreakSaveAnswers,
    handleReflectionSnapshot,
    openStreakSaveQuestionnaire,
    openStreakSaveQuestionnairePreview,
    openSickDaySavePromptPreview,
    dismissSickDaySavePrompt,
    closeStreakSaveQuestionnaire,
    declineSickDaySave,
    claimSickDaySave,
  } = useReflection({
    user: auth.currentUser,
    isPro,
    landingWisdomMinute,
    questions: STREAK_SAVE_ACCOUNTABILITY_QUESTIONS,
    sayings: STREAK_MIRROR_SAYINGS,
    minWords: STREAK_MIRROR_MIN_WORDS,
  });

  // ── useUserData: auth, sessions, XP, streak, bandana, mascot ───────────────
  const onSignIn = useCallback((uid: string) => {
    handlePlannedBlocksSignedIn(uid);
    handleUserSignedIn(uid);
  }, [handlePlannedBlocksSignedIn, handleUserSignedIn]);

  const onSignOut = useCallback(() => {
    handlePlannedBlocksSignedOut();
    handleUserSignedOut();
  }, [handlePlannedBlocksSignedOut, handleUserSignedOut]);

  const {
    user,
    authChecked,
    setAuthChecked,
    sessionsSynced,
    sessionsSyncedRef,
    applySessionsSnapshot,
    refreshSessionsFromCloud,
    sessions,
    setSessions,
    sessionMinutesByDay,
    streakQualifiedDateKeys,
    streak,
    streakIsProvisional,
    bandanaColor,
    mascot,
    showMascot,
    dismissMascot,
    xpByDay,
    weeklyXp,
    lifetimeXpSummary,
    xpPops,
    triggerXPPop,
    removeXPPop,
    sessionReward,
    setSessionReward,
    streakCelebration,
    setStreakCelebration,
    streakNudge,
    setStreakNudge,
    profileDisplayName,
    currentUserPhotoUrl,
    currentUserId,
    currentUserCreatedAtISO,
  } = useUserData({
    completedBlocksByDay,
    noteWordsByDay,
    protectedStreakDateKeys,
    plannedBlocksHydrated,
    notesHydrated: notesSyncStatus !== "syncing",
    onSignIn,
    onSignOut,
  });

  const handleSessionOutcome = useCallback(({
    source,
    minutesSpent,
    nextSessions,
    nextStreak,
  }: {
    source: "timer" | "plan";
    minutesSpent: number;
    nextSessions: SessionDoc[];
    nextStreak: number;
  }) => {
    const todayKeyForReaction = dayKeyLocal(new Date());
    setSenseiReaction(
      buildSenseiReaction({
        source,
        minutesSpent,
        todaySessions: nextSessions.filter(
          (session) => dayKeyLocal(session.completedAtISO) === todayKeyForReaction,
        ).length,
        streak: nextStreak,
      }),
    );
    if (source === "plan") {
      showToast("Session saved from plan.", "success");
    }
  }, [showToast]);

  const {
    handleSessionStarted,
    handleSessionAbandoned,
    completeSession,
    completePlannedBlock,
  } = useSessions({
    user,
    sessions,
    setSessions,
    sessionMinutesByDay,
    completedBlocksByDay,
    noteWordsByDay,
    streakQualifiedDateKeys,
    protectedStreakDateKeys,
    xpByDay,
    lifetimeXpSummary,
    plannedBlocks,
    persistPlannedBlocks,
    sessionReward,
    setSessionReward,
    triggerXPPop,
    getSubjectModeFromText: analyticsSubjectModeFromText,
    onSessionOutcome: handleSessionOutcome,
  });

  const {
    companionStyle,
    themeMode,
    resolvedTheme,
    themePromptOpen,
    appBackgroundSetting,
    backgroundSkin,
    notificationSettings,
    effectiveBackgroundSetting,
    backgroundSkinActive,
    preferencesHydrated,
    setThemePromptOpen,
    applyPreferencesSnapshot,
    applyThemeMode,
    applyBackgroundSetting,
    applyCompanionStyle,
    updateBackgroundSkin,
    applyNotificationSettings,
    handleBackgroundUpload,
  } = usePreferences({
    user,
    isPro,
    defaultBackgroundSkin: DEFAULT_BACKGROUND_SKIN,
    showToast,
  });

  const handleExportArchive = useCallback(async () => {
    if (!user || archiveExportBusy) return;
    if (!isPro) {
      setArchiveExportStatus("Whelm Pro is required for full archive export.");
      return;
    }

    setArchiveExportBusy(true);
    setArchiveExportStatus("");

    try {
      const archive = buildWhelmArchive({
        account: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName ?? profileDisplayName ?? null,
          createdAtISO: currentUserCreatedAtISO,
          tier: WHELM_PRO_NAME,
        },
        preferences: {
          themeMode,
          companionStyle,
          backgroundSetting: appBackgroundSetting,
          backgroundSkin,
          notificationSettings,
          proState: {
            isPro,
            source: proSource,
          },
        },
        notes,
        plannedBlocks,
        sessions,
        cards: readLocalCards(user.uid),
        reflection: {
          mirrorEntries: streakMirrorEntries,
          sickDaySaves,
          sickDaySaveDismissals,
        },
        calendarTones: {
          days: dayTones,
          months: monthTones,
        },
        streak: {
          current: streak,
          qualifiedDateKeys: streakQualifiedDateKeys,
          lifetimeXpSummary,
        },
      });

      const result = await saveWhelmArchive(archive);
      setArchiveExportStatus(
        result === "shared"
          ? "Whelm archive ready to share."
          : "Whelm archive downloaded.",
      );
      showToast(
        result === "shared" ? "Archive ready to share." : "Archive downloaded.",
        "success",
      );
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setArchiveExportStatus("Archive export cancelled.");
      } else {
        setArchiveExportStatus(
          error instanceof Error ? error.message : "Unable to export Whelm archive.",
        );
      }
    } finally {
      setArchiveExportBusy(false);
    }
  }, [
    appBackgroundSetting,
    archiveExportBusy,
    backgroundSkin,
    companionStyle,
    currentUserCreatedAtISO,
    dayTones,
    isPro,
    lifetimeXpSummary,
    monthTones,
    notes,
    plannedBlocks,
    profileDisplayName,
    proSource,
    sessions,
    showToast,
    sickDaySaveDismissals,
    sickDaySaves,
    streak,
    streakMirrorEntries,
    streakQualifiedDateKeys,
    themeMode,
    user,
  ]);

  const handleExportNotes = useCallback(async () => {
    if (!user || notesExportBusy) return;
    if (!isPro) {
      setNotesExportStatus("Whelm Pro is required for readable notes export.");
      return;
    }

    setNotesExportBusy(true);
    setNotesExportStatus("");

    try {
      const result = await exportReadableNotesZip(notes);
      setNotesExportStatus(
        `Notes export ready: ${result.noteCount} notes and ${result.attachmentCount} bundled attachments.`,
      );
      showToast("Readable notes export downloaded.", "success");
    } catch (error: unknown) {
      setNotesExportStatus(
        error instanceof Error ? error.message : "Unable to export notes as Markdown.",
      );
    } finally {
      setNotesExportBusy(false);
    }
  }, [isPro, notes, notesExportBusy, showToast, user]);

  const handleImportArchive = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user || archiveImportBusy) return;
    if (!isPro) {
      setArchiveExportStatus("Whelm Pro is required for archive restore.");
      return;
    }

    try {
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith(".json")) {
        throw new Error("Whelm archive imports must use a .json file.");
      }
      if (file.size <= 0) {
        throw new Error("This archive file is empty.");
      }
      if (file.size > 15 * 1024 * 1024) {
        throw new Error("This archive file is too large to import on this screen.");
      }

      const raw = await file.text();
      const archive = parseWhelmArchive(raw);
      setPendingArchiveImport({
        fileName: file.name,
        archive,
      });
      setArchiveExportStatus("Archive loaded. Review it below, then confirm the merge.");
    } catch (error: unknown) {
      setArchiveExportStatus(
        error instanceof Error ? error.message : "Unable to import Whelm archive.",
      );
    }
  }, [
    archiveImportBusy,
    isPro,
    user,
  ]);

  const handleConfirmArchiveImport = useCallback(async () => {
    if (!user || !pendingArchiveImport || archiveImportBusy) return;

    setArchiveImportBusy(true);
    setArchiveExportStatus("");

    try {
      const { archive } = pendingArchiveImport;
      const mergedNotes = mergeNotesPreferNewest(notes, archive.notes);
      const mergedPlannedBlocks = mergeBlocksPreferNewest(plannedBlocks, archive.plannedBlocks);
      const mergedSessions = dedupeSessions([...sessions, ...archive.sessions]);
      const mergedCards = normalizeCards([...readLocalCards(user.uid), ...archive.cards]);
      const mergedPlannedBlocksForState = mergedPlannedBlocks.map((block) => ({
        ...block,
        tone: block.tone && getCalendarToneMeta(block.tone as CalendarTone)
          ? (block.tone as CalendarTone)
          : undefined,
      }));
      const mergedMirrorEntries = [...archive.reflection.mirrorEntries, ...streakMirrorEntries]
        .sort((a, b) => (a.updatedAtISO < b.updatedAtISO ? 1 : -1))
        .filter((entry, index, list) => list.findIndex((candidate) => candidate.id === entry.id) === index);
      const mergedSickDaySaves = [...archive.reflection.sickDaySaves, ...sickDaySaves]
        .sort((a, b) => (a.claimedAtISO < b.claimedAtISO ? 1 : -1))
        .filter((entry, index, list) => list.findIndex((candidate) => candidate.id === entry.id) === index);
      const mergedSickDayDismissals = [...new Set([...sickDaySaveDismissals, ...archive.reflection.sickDaySaveDismissals])];
      const mergedDayTones = { ...dayTones, ...archive.calendarTones.days };
      const mergedMonthTones = { ...monthTones, ...archive.calendarTones.months };
      const mergedPreferences = {
        ...archive.preferences,
        proState: {
          isPro,
          source: proSource,
        },
      };

      await Promise.all([
        saveNotes(user, mergedNotes),
        savePlannedBlocks(user, mergedPlannedBlocks),
        savePreferences(user, mergedPreferences),
        saveReflectionState(user, {
          mirrorEntries: mergedMirrorEntries,
          sickDaySaves: mergedSickDaySaves,
          sickDaySaveDismissals: mergedSickDayDismissals,
        }),
        saveCards(user.uid, mergedCards),
        syncMissingSessionsToCloud(user, mergedSessions),
      ]);

      setNotes(mergedNotes);
      setPlannedBlocks(mergedPlannedBlocksForState);
      setSessions(mergedSessions);
      saveSessionsLocally(user.uid, mergedSessions);
      applyPreferencesSnapshot(mergedPreferences);
      handleReflectionSnapshot({
        mirrorEntries: mergedMirrorEntries,
        sickDaySaves: mergedSickDaySaves,
        sickDaySaveDismissals: mergedSickDayDismissals,
      });
      saveDayTones(user.uid, mergedDayTones);
      saveMonthTones(user.uid, mergedMonthTones);
      setDayTones(mergedDayTones);
      setMonthTones(mergedMonthTones);
      setPendingArchiveImport(null);

      setArchiveExportStatus("Whelm archive imported and merged into this account.");
      showToast("Archive imported.", "success");
    } catch (error: unknown) {
      setArchiveExportStatus(
        error instanceof Error ? error.message : "Unable to import Whelm archive.",
      );
    } finally {
      setArchiveImportBusy(false);
    }
  }, [
    applyPreferencesSnapshot,
    archiveImportBusy,
    dayTones,
    handleReflectionSnapshot,
    isPro,
    monthTones,
    notes,
    pendingArchiveImport,
    plannedBlocks,
    proSource,
    sessions,
    setNotes,
    setPlannedBlocks,
    setSessions,
    showToast,
    sickDaySaveDismissals,
    sickDaySaves,
    streakMirrorEntries,
    user,
  ]);

  const {
    streakCalendarCursor,
    setStreakCalendarCursor,
    historicalStreaksByDay,
    todayKey,
    yesterdayKey,
    todayFocusMinutes,
    todayNoteWords,
    hasEarnedToday,
    displayStreak,
    streakBandanaTier,
    xpTierTheme,
    xpDockStyle,
    mobileStreakJumpStyle,
    monthlyStreakSaveCount,
    streakSaveMonthlyLimit,
    streakSaveSlotsLeft,
    rawYesterdayMissed,
    yesterdaySave,
    monthlySaveLimitReached,
    sickDaySaveEligible,
    formattedLifetimeXp,
    formattedXpToNextLevel,
    nextBandanaMilestone,
    longestStreak,
    streakRuleV2ActiveToday,
    streakProtectedToday,
    streakProgressMinutesLabel,
    streakProgressBlocksLabel,
    streakProgressWordsLabel,
    streakStatusLine,
    streakNudgeDraft,
    streakRuleSummaryLine,
    streakMonthLabel,
    streakMonthCalendar,
    visibleBandanaColor,
    streakSummaryBase,
    streakDailyRecords,
  } = useShellStreakState({
    isPro,
    streak,
    streakQualifiedDateKeys,
    sessionMinutesByDay,
    noteWordsByDay,
    completedBlocksByDay,
    sickDaySaves,
    sickDaySaveDismissals,
    lifetimeXpSummary,
    bandanaColor,
    streakIsProvisional,
  });

  useEffect(() => {
    if (!pendingXpPop) return;
    triggerXPPop(pendingXpPop.amount);
    clearPendingXpPop();
  }, [clearPendingXpPop, pendingXpPop, triggerXPPop]);

  const {
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
  } = useHistoryData({
    isPro,
    plannedBlocks,
    sessions,
    proHistoryFreeDays: PRO_HISTORY_FREE_DAYS,
    isDateKeyBeforeToday,
    isDateKeyWithinRecentWindow,
    startOfDayLocal,
    weekStartKeyLocal,
    formatHistoryWeekLabel,
  });

  const {
    focusMetrics,
    trendPoints,
    lastSessionHoursAgo,
    nextSenseiMilestone,
    companionState,
    senseiGuidance,
    todayHeroCopy,
  } = useCompanionMetrics({
    sessions,
    streak,
    trendRange,
    dueReminderCount: dueReminderNotes.length,
    todayActivePlannedBlocksCount: todayActivePlannedBlocks.length,
    notesCount: notes.length,
    notesUpdated7d: notes.filter((note) => {
      const updated = new Date(note.updatedAtISO);
      const now = new Date();
      return now.getTime() - updated.getTime() <= 7 * 24 * 60 * 60 * 1000;
    }).length,
    activeTab,
    companionStyle,
    landingWisdomMinute,
    focusLevel,
    summarizeDisciplineScore,
    milestoneForStreak,
    startOfDayLocal,
    landingWisdomRotation: LANDING_WISDOM_ROTATION,
  });

  const {
    reportCopyStatus,
    analyticsLoading,
    analyticsError,
    analyticsWeeklySummary,
    analyticsBestHours,
    analyticsScoreHistory,
    analyticsInsights,
    insightRange,
    setInsightRange,
    kpiDetailOpen,
    setKpiDetailOpen,
    reportMetrics,
    analyticsDateRange,
    analyticsNotificationPlan,
    copyWeeklyReport,
    analyticsScorePath,
    analyticsTopHours,
    analyticsTopSubjects,
    analyticsTopSubjectMinutes,
    analyticsLeadInsight,
    analyticsLeadSubject,
    analyticsLeadNotification,
  } = useReportsAnalytics({
    user,
    isPro,
    activeTab,
    focusMetrics,
    notes,
    sessions,
    trendPoints,
    streak,
    setSenseiReaction,
  });

  const {
    deliveryMode: notificationDeliveryMode,
    permissionState: notificationPermissionState,
    notificationStatus,
    notificationBusy,
    scheduledNotificationCount,
    requestNotificationPermission,
    resyncNotifications,
  } = useWhelmNotifications({
    user,
    notificationSettings,
    analyticsNotificationPlan,
    notes,
    showToast,
  });

  const handleTodayLaunchRequest = useCallback((request: TodayLaunchRequest | null) => {
    if (!request) return;

    startTodayAlarmInstanceFromLaunch(request);
    setActiveTab("today");
    setTodayTimeHubRequest({
      id: request.id,
      tool: request.tool,
      alarmId: request.alarmId,
      autoStart: request.autoStart,
      timerDraft:
        request.tool === "timer"
          ? {
              minutes: request.linkedBlockDurationMinutes ?? 25,
              label: request.linkedBlockTitle || request.alarmLabel || "Focus timer",
            }
          : undefined,
    });
    clearStoredTodayLaunchRequest();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const consumeLaunchRequest = () => {
      handleTodayLaunchRequest(readStoredTodayLaunchRequest());
    };

    consumeLaunchRequest();
    window.addEventListener(TODAY_LAUNCH_REQUEST_EVENT, consumeLaunchRequest);
    window.addEventListener("storage", consumeLaunchRequest);
    return () => {
      window.removeEventListener(TODAY_LAUNCH_REQUEST_EVENT, consumeLaunchRequest);
      window.removeEventListener("storage", consumeLaunchRequest);
    };
  }, [handleTodayLaunchRequest]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncAlarmInstances = () => {
      setTodayAlarmInstances(readStoredTodayAlarmInstances());
    };

    syncAlarmInstances();
    window.addEventListener(TODAY_ALARM_INSTANCES_EVENT, syncAlarmInstances);
    window.addEventListener("storage", syncAlarmInstances);
    return () => {
      window.removeEventListener(TODAY_ALARM_INSTANCES_EVENT, syncAlarmInstances);
      window.removeEventListener("storage", syncAlarmInstances);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshAlarmAdherence = () => {
      const alarms = readStoredTodayAlarms();
      resolveTodayAlarmMode(readStoredTodayAlarmInstances(), alarms);
      sweepMissedTodayAlarmInstances(alarms, new Date());
      setTodayAlarmInstances(readStoredTodayAlarmInstances());
    };

    refreshAlarmAdherence();
    const intervalId = window.setInterval(refreshAlarmAdherence, 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const updateViewport = () => setIsMobileViewport(media.matches);
    updateViewport();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", updateViewport);
      return () => media.removeEventListener("change", updateViewport);
    }
    media.addListener(updateViewport);
    return () => media.removeListener(updateViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) {
      setMobileMoreOpen(false);
      setMobileNotesRecentOpen(false);
      setMobileNotesEditorOpen(false);
      setMobileNotesToolsOpen(null);
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
    if (!user) return;
    setDayTones(loadDayTones(user.uid));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setMonthTones(loadMonthTones(user.uid));
  }, [user]);

  useEffect(() => {
    function onOnline() {
      if (!user) return;
      void refreshSessionsFromCloud();
      if (notes.length === 0) return;
      void handleRetrySync();
    }

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [handleRetrySync, notes.length, refreshSessionsFromCloud, user]);

  useEffect(() => {
    if (!user || sickDaySavePromptPreview) return;
    if (sickDaySaveEligible) {
      setSickDaySavePromptOpen(true);
    }
  }, [setSickDaySavePromptOpen, sickDaySaveEligible, sickDaySavePromptPreview, user]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void flushSelectedNoteDraft();
        return;
      }
      if (document.visibilityState === "visible") {
        void refreshSessionsFromCloud();
      }
    }

    function onPageHide() {
      void flushSelectedNoteDraft();
    }

    function onWindowFocus() {
      void refreshSessionsFromCloud();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("focus", onWindowFocus);

    if (!user) {
      return () => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("pagehide", onPageHide);
        window.removeEventListener("focus", onWindowFocus);
      };
    }

    const unsub = subscribeToUserData(user.uid, {
      onNotes: (notes) => {
        applyNotesSnapshot(notes);
      },
      onBlocks: (blocks) => {
        handleBlocksSnapshot(blocks as PlannedBlock[]);
      },
      onPreferences: (prefs) => {
        applyPreferencesSnapshot({
          companionStyle: prefs.companionStyle as SenseiCompanionStyle,
          themeMode: prefs.themeMode as ThemeMode,
          backgroundSetting: prefs.backgroundSetting as AppBackgroundSetting,
          backgroundSkin: prefs.backgroundSkin as BackgroundSkinSetting,
          notificationSettings: prefs.notificationSettings,
          proState: prefs.proState,
        });
      },
      onReflection: handleReflectionSnapshot,
      onSessions: (sessions) => {
        if (sessionsSyncedRef.current) {
          applySessionsSnapshot(sessions);
        }
      },
      onCards: () => {
        // Cards are handled by CardsTab's own subscription
      },
      isEditingNote: () => bodyDirtyRef.current,
      editingNoteId: () => selectedNoteIdRef.current,
      localNote: (id) => notesRef.current.find((n) => n.id === id),
    });

    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, [
    applyNotesSnapshot,
    applyPreferencesSnapshot,
    applySessionsSnapshot,
    flushSelectedNoteDraft,
    handleBlocksSnapshot,
    handleReflectionSnapshot,
    refreshSessionsFromCloud,
    user,
  ]);

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

    if (nextLength > previousLength) {
      triggerXPPop(15);
    }

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

  useEffect(() => {
    if (!streakCelebration) return;
    const timeoutId = window.setTimeout(() => {
      setStreakCelebration((current) => (current?.id === streakCelebration.id ? null : current));
    }, 4200);
    return () => window.clearTimeout(timeoutId);
  }, [streakCelebration]);

  function convertNoteToPlannedBlock(noteId: string) {
    const note = notesRef.current.find((entry) => entry.id === noteId);
    if (!note) return;
    const reminderDate = note.reminderAtISO ? new Date(note.reminderAtISO) : null;
    const rawDateKey = reminderDate ? dayKeyLocal(reminderDate) : selectedDateKey;
    const dateKey = normalizePlannableDateKey(rawDateKey);
    const timeOfDay = reminderDate
      ? `${String(reminderDate.getHours()).padStart(2, "0")}:${String(
          reminderDate.getMinutes(),
        ).padStart(2, "0")}`
      : "09:00";

    setActiveTab("today");
    setTodayTimeHubRequest({
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : `note-block-${Date.now()}`,
      tool: "block",
      draft: {
        dateKey,
        title: note.title || "Untitled note task",
        note: summarizePlainText(note.body, 280),
        timeOfDay,
        durationMinutes: 25,
      },
    });
  }

  const selectedCalendarMonthKey = monthKeyLocal(calendarCursor);
  const selectedMonthTone = isPro ? (monthTones[selectedCalendarMonthKey] ?? null) : null;
  const calendarMonthLabel = calendarCursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const calendarMonthInput = monthInputFromDate(calendarCursor);
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
        tone: isPro ? (dayTones[dateKey] ?? monthTones[selectedCalendarMonthKey]) : undefined,
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
  }, [calendarCursor, dayTones, monthTones, selectedCalendarMonthKey, sessionMinutesByDay]);
  const {
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
  } = useCalendarAgenda({
    isPro,
    isMobileViewport,
    selectedDateKey,
    selectedDatePlans,
    plannedBlocks,
    notes,
    sessions,
    sessionMinutesByDay,
    dayTones,
    proHistoryFreeDays: PRO_HISTORY_FREE_DAYS,
    isDateKeyBeforeToday,
    isDateKeyWithinRecentWindow,
  });
  const {
    mobileMoreOpen,
    setMobileMoreOpen,
    handleTabSelect,
    handleMobileTabSelect,
    openNotesTab,
    scrollCalendarTimelineToNow,
    scrollToSection,
  } = useTabNavigation({
    activeTab,
    setActiveTab,
    isMobileViewport,
    calendarView,
    selectedDateKey,
    dayViewTimeline,
    currentTimeMarkerMinute: currentTimeMarker?.minute,
    anchors: {
      todaySectionRef,
      todaySummaryRef,
      todayTimerRef,
      calendarSectionRef,
      calendarHeroRef,
      calendarMonthRef,
      calendarTimelineRef,
      mirrorSectionRef,
      mirrorEntriesAnchorRef,
      leaderboardSectionRef,
      leaderboardPrimaryRef,
      historySectionRef,
      historyPrimaryRef,
      reportsSectionRef,
      reportsPrimaryRef,
      streaksSectionRef,
      streaksPrimaryRef,
      settingsSectionRef,
      settingsPrimaryRef,
      notesSectionRef,
      notesRecentRef,
      notesStartRef,
      notesEditorRef,
      mobileDayTimelineScrollRef,
    },
  });
  const openSpecificNote = useCallback((noteId: string | null) => {
    void (async () => {
      await flushSelectedNoteDraft();
      setSelectedNoteId(noteId);
      openNotesTab();
    })();
  }, [flushSelectedNoteDraft, openNotesTab, setSelectedNoteId]);

  const {
    openMobileNoteEditor,
    handleMobileCreateNote,
    handleOpenCurrentMobileNote,
    handleMobilePlannerOpen,
    openTimeBlockFlow,
    openSickDaySaveReview,
    openDailyPlanningPreview,
    handleTodayPrimaryAction,
    handleStreakNudgeAction,
  } = useModalFlows({
    selectedNoteId,
    selectedDateKey,
    sickDaySaveEligible,
    senseiActionLabel: senseiGuidance.actionLabel,
    senseiActionTab: senseiGuidance.actionTab as AppTab,
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
    setStreakNudge: () => setStreakNudge(null),
    scrollToSection,
    todayTimerRef,
    todaySectionRef,
    notesEditorRef,
    notesSectionRef,
    calendarTimelineRef,
    calendarSectionRef,
  });
  const {
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
  } = useCalendarInteractions({
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
    dayViewTimelineItems: dayViewTimeline.items,
    pendingCalendarEntryFocusId,
    setPendingCalendarEntryFocusId,
    setActivatedCalendarEntryId,
    setCalendarJumpDate,
    persistDayTones: saveDayTones,
    persistMonthTones: saveMonthTones,
  });

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

  const {
    leaderboardMetricTab,
    setLeaderboardMetricTab,
    leaderboardCurrentUserRank,
    leaderboardCurrentUserMovement,
    leaderboardSource,
    leaderboardTotalEntries,
    leaderboardRows,
    leaderboardAroundRows,
    leaderboardBandanaHolders,
    leaderboardError,
    leaderboardLoading,
    leaderboardHasEntries,
    leaderboardHasMore,
    leaderboardIsLive,
    seenChallengerIds,
    handleLeaderboardLoadMore,
  } = useLeaderboard({
    activeTab,
    user,
    currentUserId,
    currentUserPhotoUrl,
    currentUserCreatedAtISO,
    profileDisplayName,
    displayStreak,
    isPro,
    lifetimeXpSummary,
    historicalStreaksByDay,
    sessions,
    sessionsSynced,
    streakIsProvisional,
    weeklyXp,
  });
  const {
    friends,
    incomingRequests: friendIncomingRequests,
    outgoingRequests: friendOutgoingRequests,
    searchResults: friendSearchResults,
    searchQuery: friendSearchQuery,
    searchLoading: friendSearchLoading,
    friendsLoading,
    error: friendsError,
    sentRequestUids,
    alreadyFriendUids,
    incomingRequestUids,
    handleSearch: handleFriendSearch,
    handleSendRequest: handleSendFriendRequest,
    handleAccept: handleAcceptFriendRequest,
    handleDecline: handleDeclineFriendRequest,
    handleRemoveFriend,
    handleNudge: handleNudgeFriend,
    canNudgeFriend,
    nudgeAvailableInMinutes,
  } = useFriends(user, profileDisplayName);

  const notificationsBlocked = dailyPlanningLocked || dailyPlanningOpen || dailyPlanningPreviewOpen;
  useEffect(() => {
    if (!authChecked || !user) return;
    logClientRuntime("workspace-shell");
  }, [authChecked, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => console.info("[whelm:network] online");
    const handleOffline = () => console.warn("[whelm:network] offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const {
    showIntroSplash,
    setIntroFinished,
    todayLabel,
  } = useShellLifecycle({
    authChecked,
    user,
    router,
    senseiReaction,
    clearSenseiReaction: () => setSenseiReaction(""),
    notificationsBlocked,
    streakProtectedToday,
    streakRuleV2ActiveToday,
    displayStreak,
    todayKey,
    plannedBlocksHydrated,
    streakNudge,
    streakNudgeDraft,
    setStreakNudge,
    setSessionReward: () => setSessionReward(null),
    setStreakCelebration,
  });
  const {
    trendPath,
    streakHeroEmoteId,
    pageShellStyle,
    lastSession,
    latestNote,
    nextPlannedBlock,
    mobileMoreActive,
    recentNotes,
    todaySessionNoteCount,
    profileTierTheme,
    lifetimeFocusMinutes,
  } = usePageShellViewModel({
    trendPoints,
    streak,
    resolvedTheme,
    themeMode,
    effectiveBackgroundSetting,
    backgroundSkin,
    backgroundSkinActive,
    activeTab,
    mobileMoreTabs: MOBILE_MORE_TABS,
    filteredNotes,
    sessions,
    todayKey,
    todayActivePlannedBlocks,
    orderedNotes,
    streakBandanaColor: visibleBandanaColor,
    isPro,
    getPageShellBackgroundStyle,
    getProfileTierTheme,
  });
  const onboardingStep = ONBOARDING_STEPS[Math.min(onboardingStepIndex, ONBOARDING_STEPS.length - 1)];
  const shellStreakRecord = useMemo(
    () =>
      buildShellStreakRecord({
        profileTitle: profileTierTheme.title,
        streak: streakSummaryBase,
        dailyRecords: streakDailyRecords,
      }),
    [profileTierTheme.title, streakDailyRecords, streakSummaryBase],
  );
  const streakTodayPresentation = useMemo(
    () =>
      buildStreakTodayPresentation({
        streakProtectedToday,
        streakStatusLine,
        streakProgressBlocksLabel,
        streakProgressMinutesLabel,
        streakProgressWordsLabel,
      }),
    [
      streakProgressBlocksLabel,
      streakProgressMinutesLabel,
      streakProgressWordsLabel,
      streakProtectedToday,
      streakStatusLine,
    ],
  );
  const {
    tierColor: shellTierColor,
    currentStreakLabel: shellCurrentStreakLabel,
    longestStreakLabel: shellLongestStreakLabel,
    identityLine: shellIdentityLine,
    nextAscentTitle: shellNextAscentTitle,
    nextAscentBody: shellNextAscentBody,
  } = shellStreakRecord.summary;
  const handleCalendarPrevMonth = useCallback(() => {
    setCalendarCursor((current) => shiftMonth(current, -1));
  }, [setCalendarCursor]);
  const handleCalendarNextMonth = useCallback(() => {
    setCalendarCursor((current) => shiftMonth(current, 1));
  }, [setCalendarCursor]);
  const handleCalendarJumpGo = useCallback(() => {
    if (!calendarJumpDate) return;
    selectCalendarDate(calendarJumpDate);
  }, [calendarJumpDate, selectCalendarDate]);
  const handleToggleMobileCalendarControls = useCallback(() => {
    setMobileCalendarControlsOpen((open) => !open);
  }, []);
  const handleGoToStreaksTab = useCallback(() => {
    setMobileMoreOpen(false);
    setActiveTab("streaks");
  }, [setActiveTab, setMobileMoreOpen]);
  const handleOpenHistoryTab = useCallback(() => {
    setActiveTab("history");
  }, [setActiveTab]);
  const handleCompletePlannedBlockWithAlarm = useCallback(async (item: (typeof plannedBlocks)[number]) => {
    const linkedInstance = todayAlarmInstances.find(
      (instance) =>
        instance.status !== "completed" &&
        instance.linkedBlockId === item.id,
    );
    if (linkedInstance) {
      completeTodayAlarmInstance(linkedInstance.id);
    }
    await completePlannedBlock(item);
  }, [completePlannedBlock, plannedBlocks, todayAlarmInstances]);
  const scheduleContainerProps: {
    refs: ScheduleShellRefs;
    state: ScheduleShellState;
    handlers: ScheduleShellHandlers;
  } = {
    refs: {
      sectionRef: calendarSectionRef,
      calendarMonthRef,
      calendarPlannerRef,
      calendarHeroRef,
      calendarTimelineRef,
      mobileDayTimelineScrollRef,
    },
    state: {
      calendarView,
      calendarMonthLabel,
      calendarMonthInput,
      calendarJumpDate,
      selectedCalendarMonthKey,
      mobileCalendarControlsOpen,
      calendarAuxPanel,
      isMobileViewport,
      mobileStreakJumpStyle,
      streak: displayStreak,
      isPro,
      dynamicMonthCalendar,
      calendarEntriesByDate,
      selectedMonthTone,
      calendarHoverEntryId,
      calendarPinnedEntryId,
      activeCalendarPreview,
      selectedDateKey,
      isSelectedDateToday,
      selectedDateSummary,
      selectedDateFocusedMinutes,
      selectedDatePlans,
      selectedDateEntries,
      selectedDateDayTone,
      selectedDateCanAddBlocks,
      bandanaColor: visibleBandanaColor,
      currentTimeMarker,
      dayViewTimeline,
      mobileDayTimelineHeight,
      activatedCalendarEntryId,
      activeOverlapPickerItem,
      activeDayViewPreviewItem,
      plannerSectionsOpen,
      selectedDatePlanGroups,
      selectedDateAgendaStateSummary,
      mobileAgendaEntriesOpen,
      draggedPlanId,
      plannedBlockById,
      focusMetricsCalendar: focusMetrics.calendar,
      historicalStreaksByDay,
      calendarCompanionPulse: companionState.pulses.calendar,
    },
    handlers: {
      onPrevMonth: handleCalendarPrevMonth,
      onNextMonth: handleCalendarNextMonth,
      onSetCalendarView: setCalendarView,
      onSetCalendarCursor: setCalendarCursor,
      onSetCalendarJumpDate: setCalendarJumpDate,
      onCalendarJumpGo: handleCalendarJumpGo,
      onToggleMobileCalendarControls: handleToggleMobileCalendarControls,
      onSetCalendarAuxPanel: setCalendarAuxPanel,
      onGoToStreaks: handleGoToStreaksTab,
      onApplyMonthTone: applyMonthTone,
      onSelectCalendarDate: selectCalendarDate,
      onSetCalendarHoverEntryId: setCalendarHoverEntryId,
      onSetCalendarPinnedEntryId: setCalendarPinnedEntryId,
      onOpenPlannedBlockDetail: openPlannedBlockDetail,
      onApplyDayTone: applyDayTone,
      onScrollCalendarTimelineToNow: scrollCalendarTimelineToNow,
      onShowCalendarHoverPreview: showCalendarHoverPreview,
      onScheduleCalendarHoverPreviewClear: scheduleCalendarHoverPreviewClear,
      onClearCalendarHoverPreviewDelay: clearCalendarHoverPreviewDelay,
      onSetOverlapPickerEntryId: setOverlapPickerEntryId,
      onOpenNote: openSpecificNote,
      onSetActiveTabHistory: handleOpenHistoryTab,
      onCompletePlannedBlock: handleCompletePlannedBlockWithAlarm,
      onUpdatePlannedBlockTime: updatePlannedBlockTime,
      onDeletePlannedBlock: deletePlannedBlock,
      onReorderPlannedBlocks: reorderPlannedBlocks,
      onSetDraggedPlanId: setDraggedPlanId,
      onSetPlannerSectionsOpen: setPlannerSectionsOpen,
      onSetMobileAgendaEntriesOpen: setMobileAgendaEntriesOpen,
      onUpgrade: openUpgradeFlow,
    },
  };

  const attachableAlarmBlocks = useMemo(
    () =>
      plannedBlocks
        .filter((item) => item.status === "active" && item.dateKey >= liveTodayKey)
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.timeOfDay.localeCompare(b.timeOfDay))
        .slice(0, 6)
        .map((item) => ({
          id: item.id,
          dateKey: item.dateKey,
          title: item.title,
          timeOfDay: item.timeOfDay,
          durationMinutes: item.durationMinutes,
          status: item.status,
        })),
    [liveTodayKey, plannedBlocks],
  );

  const activeTodayAlarmInstance = useMemo(
    () => getActiveTodayAlarmInstance(todayAlarmInstances),
    [todayAlarmInstances],
  );
  const latestMissedTodayAlarmInstance = useMemo(
    () => getLatestMissedTodayAlarmInstance(todayAlarmInstances),
    [todayAlarmInstances],
  );
  const activeAlarmCommitmentLabel = activeTodayAlarmInstance
    ? activeTodayAlarmInstance.linkedBlockTitle || activeTodayAlarmInstance.alarmLabel
    : latestMissedTodayAlarmInstance
      ? `${latestMissedTodayAlarmInstance.alarmMode === "hard" ? "Missed hard" : "Missed"} alarm`
      : null;
  const activeAlarmCommitmentMeta = activeTodayAlarmInstance
    ? activeTodayAlarmInstance.alarmMode === "hard"
      ? "Hard commitment live now."
      : "Soft commitment live now."
    : latestMissedTodayAlarmInstance
      ? latestMissedTodayAlarmInstance.linkedBlockTitle
        ? `${latestMissedTodayAlarmInstance.linkedBlockTitle} was missed.`
        : "This time commitment was missed."
      : null;
  const handleSnoozeActiveAlarm = useCallback(() => {
    if (!activeTodayAlarmInstance) return;
    snoozeTodayAlarmInstance(activeTodayAlarmInstance.id);
    showToast("Alarm snoozed for 10 minutes.", "info");
  }, [activeTodayAlarmInstance, showToast]);
  const handleClearMissedAlarm = useCallback(() => {
    if (!latestMissedTodayAlarmInstance) return;
    clearTodayAlarmInstance(latestMissedTodayAlarmInstance.id);
    showToast("Missed alarm cleared.", "info");
  }, [latestMissedTodayAlarmInstance, showToast]);

  useEffect(() => {
    const unresolvedEffects = todayAlarmInstances.filter(
      (instance) =>
        !instance.effectAppliedAtISO &&
        (instance.status === "completed" || instance.status === "missed"),
    );
    if (unresolvedEffects.length === 0) return;

    unresolvedEffects.forEach((instance) => {
      if (instance.status === "completed") {
        if (instance.outcome === "on_time") {
          triggerXPPop(5);
          showToast("Alarm honored on time. +5 adherence XP.", "success");
        } else if (instance.outcome === "late") {
          triggerXPPop(2);
          showToast("Alarm completed late. +2 adherence XP.", "info");
        } else if (instance.outcome === "snoozed") {
          triggerXPPop(1);
          showToast("Alarm completed after snooze. +1 adherence XP.", "info");
        }
      } else if (instance.outcome === "missed") {
        if (instance.alarmMode === "hard") {
          setStreakNudge({
            id: `alarm-miss-${instance.id}`,
            title: "Hard alarm missed",
            body: instance.linkedBlockTitle
              ? `${instance.linkedBlockTitle} slipped. Recover in Today before drift compounds.`
              : "A hard time commitment was missed. Recover in Today before drift compounds.",
            actionLabel: "Go to Today",
            actionTab: "today",
          });
          showToast("Hard alarm missed.", "warning");
        } else {
          showToast("Soft alarm missed.", "info");
        }
      }

      markTodayAlarmInstanceEffectApplied(instance.id);
    });
  }, [setStreakNudge, showToast, todayAlarmInstances, triggerXPPop]);

  const todayContainerProps = useMemo<{
    refs: TodayShellRefs;
    state: TodayShellState;
    handlers: TodayShellHandlers;
    getTabTitle: (tab: AppTab) => string;
    timeHubRequest: TodayTimeHubRequest | null;
    onConsumeTimeHubRequest: (id: string) => void;
  }>(
    () => ({
      refs: {
        todaySectionRef,
        todayTimerRef,
        todaySummaryRef,
      },
      state: {
        isMobileViewport,
        isPro,
        resolvedTheme,
        liveTodayKey,
        todaySessionNoteCount,
        focusMetrics: {
          disciplineScore: focusMetrics.disciplineScore,
          todayMinutes: focusMetrics.todayMinutes,
          todaySessions: focusMetrics.todaySessions,
          weekMinutes: focusMetrics.weekMinutes,
        },
        streak: displayStreak,
        mobileTodayOverviewOpen,
        nextPlannedBlock,
        dueReminderNotes,
        lastSession,
        lastSessionHoursAgo,
        latestNote,
        orderedNotes,
        todayActivePlannedBlocksCount: todayActivePlannedBlocks.length,
        attachableAlarmBlocks,
        activeAlarmCommitmentLabel,
        activeAlarmCommitmentMeta,
        activeTodayAlarmInstance,
        latestMissedTodayAlarmInstance,
        senseiGuidance: {
          tone: senseiGuidance.tone,
          ritual: senseiGuidance.ritual,
          voiceMode: senseiGuidance.voiceMode,
          actionLabel: senseiGuidance.actionLabel,
          actionTab: senseiGuidance.actionTab,
        },
        todayHeroCopy: {
          eyebrow: todayHeroCopy.eyebrow,
          title: todayHeroCopy.title,
          body: todayHeroCopy.body,
          signatureLine: todayHeroCopy.signatureLine,
        },
        companionStageLabel: companionState.stage,
        nextSenseiMilestone,
        senseiReaction,
        bandanaColor: visibleBandanaColor,
        reportCopyStatus,
        userEmail: user?.email ?? "",
        senseiActionTab: senseiGuidance.actionTab as AppTab,
      },
      handlers: {
        onOpenSessionNotes: handleOpenHistoryTab,
        onSessionStart: handleSessionStarted,
        onSessionAbandon: handleSessionAbandoned,
        onSessionComplete: (note, minutesSpent, sessionContext) => {
          if (activeTodayAlarmInstance) {
            completeTodayAlarmInstance(activeTodayAlarmInstance.id);
          }
          return void completeSession(note, minutesSpent, sessionContext);
        },
        onToggleMobileTodayOverview: () => setMobileTodayOverviewOpen((open) => !open),
        onTodayPrimaryAction: handleTodayPrimaryAction,
        onOpenNote: openSpecificNote,
        onCreateWorkspaceNote: () => void createWorkspaceNote(),
        onCopyWeeklyReport: () => void copyWeeklyReport(),
        onUpgrade: openUpgradeFlow,
        onSnoozeActiveAlarm: handleSnoozeActiveAlarm,
        onClearMissedAlarm: handleClearMissedAlarm,
        onSavePlannedBlock: savePlannedBlock,
        onOpenScheduleDay: (dateKey) => {
          selectCalendarDate(dateKey);
          setActiveTab("calendar");
          setCalendarView("day");
        },
      },
      getTabTitle: tabTitle,
      timeHubRequest: todayTimeHubRequest,
      onConsumeTimeHubRequest: (id) => {
        setTodayTimeHubRequest((current) => (current?.id === id ? null : current));
      },
    }),
    [
      companionState.stage,
      completeSession,
      copyWeeklyReport,
      savePlannedBlock,
      createWorkspaceNote,
      dueReminderNotes,
      focusMetrics.disciplineScore,
      focusMetrics.todayMinutes,
      focusMetrics.todaySessions,
      focusMetrics.weekMinutes,
      handleOpenHistoryTab,
      handleSessionAbandoned,
      handleSessionStarted,
      handleTodayPrimaryAction,
      isMobileViewport,
      isPro,
      lastSession,
      lastSessionHoursAgo,
      latestNote,
      mobileTodayOverviewOpen,
      liveTodayKey,
      nextPlannedBlock,
      nextSenseiMilestone,
      openSpecificNote,
      openUpgradeFlow,
      orderedNotes,
      reportCopyStatus,
      resolvedTheme,
      selectCalendarDate,
      setActiveTab,
      setCalendarView,
      senseiGuidance.actionLabel,
      senseiGuidance.actionTab,
      senseiGuidance.ritual,
      senseiGuidance.tone,
      senseiGuidance.voiceMode,
      senseiReaction,
      displayStreak,
      tabTitle,
      todayActivePlannedBlocks.length,
      attachableAlarmBlocks,
      activeAlarmCommitmentLabel,
      activeAlarmCommitmentMeta,
      activeTodayAlarmInstance,
      handleClearMissedAlarm,
      handleSnoozeActiveAlarm,
      latestMissedTodayAlarmInstance,
      todayHeroCopy.body,
      todayHeroCopy.eyebrow,
      todayHeroCopy.signatureLine,
      todayHeroCopy.title,
      todaySectionRef,
      todaySessionNoteCount,
      todaySummaryRef,
      todayTimerRef,
      todayTimeHubRequest,
      user?.email,
      visibleBandanaColor,
      setTodayTimeHubRequest,
    ],
  );
  const notesContainerProps = useMemo<{
    refs: NotesShellRefs;
    state: NotesShellState;
    handlers: NotesShellHandlers;
  }>(
    () => ({
      refs: {
        sectionRef: notesSectionRef,
        noteAttachmentInputRef,
        notesStartRef,
        notesRecentRef,
        notesEditorRef,
        editorRef,
        noteBodyShellRef,
      },
      state: {
        notesSurface,
        uid: user?.uid ?? "",
        isMobileViewport,
        notes,
        selectedNoteId,
        selectedNote,
        filteredNotes,
        recentNotes,
        selectedNoteWordCount,
        hasLockedNotesHistory,
        noteUndoItem,
        resolvedTheme,
        selectedNoteSurfaceColor,
        selectedNotePageColor,
        xpTierTheme,
        streakBandanaTier,
        bandanaColor: visibleBandanaColor,
        notesSearch,
        notesCategoryFilter,
        mobileNotesRecentOpen,
        mobileNotesEditorOpen,
        mobileNotesToolsOpen,
        colorPickerOpen,
        shellColorPickerOpen,
        textColorPickerOpen,
        highlightPickerOpen,
        editorBandanaCaret,
        notesSyncStatus,
        notesSyncMessage,
        noteAttachmentBusy,
        noteAttachmentStatus,
        pendingNoteAttachments,
        isPro,
        proPanelNotesOpen: proPanelsOpen.notes,
      },
      handlers: {
        onSetNotesSurface: setNotesSurface,
        onCardsXPEarned: handleCardsXPEarned,
        onSetNotesSearch: setNotesSearch,
        onSetNotesCategoryFilter: setNotesCategoryFilter,
        onSetMobileNotesRecentOpen: setMobileNotesRecentOpen,
        onSetMobileNotesEditorOpen: setMobileNotesEditorOpen,
        onSetMobileNotesToolsOpen: setMobileNotesToolsOpen,
        onSetColorPickerOpen: setColorPickerOpen,
        onSetShellColorPickerOpen: setShellColorPickerOpen,
        onSetTextColorPickerOpen: setTextColorPickerOpen,
        onSetHighlightPickerOpen: setHighlightPickerOpen,
        onSetEditorBandanaCaret: setEditorBandanaCaret,
        onNoteAttachmentInput: handleNoteAttachmentInput,
        onOpenAttachmentPicker: openNoteAttachmentPicker,
        onOpenNoteAttachment: openNoteAttachment,
        onRemoveNoteAttachment: (attachment) => void removeNoteAttachment(attachment),
        onConvertNoteToBlock: convertNoteToPlannedBlock,
        onDeleteNote: (noteId) => void deleteNote(noteId),
        onUndoDelete: () => void undoDeleteNote(),
        onCreateNote: () => void createWorkspaceNote(),
        onTogglePinned: (noteId) => void togglePinned(noteId),
        onUpdateSelectedNote: (patch) => void updateSelectedNote(patch),
        onFlushPendingTitleSync: () => void flushPendingTitleSync(),
        onCaptureEditorDraft: captureEditorDraft,
        onSaveEditorSelection: saveEditorSelection,
        onApplyEditorCommand: applyEditorCommand,
        onCheckEditorSelection: checkEditorSelection,
        onUpdateEditorBandanaCaret: updateEditorBandanaCaret,
        onFlushNoteDraft: flushSelectedNoteDraft,
        onMobileCreateNote: () => void handleMobileCreateNote(),
        onOpenMobileEditor: openMobileNoteEditor,
        onOpenCurrentMobileNote: handleOpenCurrentMobileNote,
        onRetrySync: () => void handleRetrySync(),
        onApplyHighlightColor: applyHighlightColor,
        onScrollToSection: scrollToSection,
        onSetSelectedNoteId: setSelectedNoteId,
        onToggleProNotesPanel: () =>
          setProPanelsOpen((current) => ({ ...current, notes: !current.notes })),
        onStartProPreview: () => void handleStartProPreview(),
        onOpenUpgradeFlow: openUpgradeFlow,
      },
    }),
    [
      applyEditorCommand,
      applyHighlightColor,
      captureEditorDraft,
      checkEditorSelection,
      colorPickerOpen,
      createWorkspaceNote,
      deleteNote,
      editorBandanaCaret,
      editorRef,
      filteredNotes,
      flushPendingTitleSync,
      flushSelectedNoteDraft,
      handleCardsXPEarned,
      handleMobileCreateNote,
      handleNoteAttachmentInput,
      handleOpenCurrentMobileNote,
      handleRetrySync,
      handleStartProPreview,
      hasLockedNotesHistory,
      highlightPickerOpen,
      isMobileViewport,
      isPro,
      mobileNotesEditorOpen,
      mobileNotesRecentOpen,
      mobileNotesToolsOpen,
      noteAttachmentBusy,
      noteAttachmentInputRef,
      noteAttachmentStatus,
      noteBodyShellRef,
      noteUndoItem,
      notes,
      notesCategoryFilter,
      notesEditorRef,
      notesRecentRef,
      notesSearch,
      notesSectionRef,
      notesStartRef,
      notesSurface,
      notesSyncMessage,
      notesSyncStatus,
      openMobileNoteEditor,
      openNoteAttachment,
      openNoteAttachmentPicker,
      openUpgradeFlow,
      pendingNoteAttachments,
      proPanelsOpen.notes,
      recentNotes,
      removeNoteAttachment,
      resolvedTheme,
      saveEditorSelection,
      scrollToSection,
      selectedNote,
      selectedNoteId,
      selectedNotePageColor,
      selectedNoteSurfaceColor,
      selectedNoteWordCount,
      setColorPickerOpen,
      setEditorBandanaCaret,
      setHighlightPickerOpen,
      setMobileNotesEditorOpen,
      setMobileNotesRecentOpen,
      setMobileNotesToolsOpen,
      setNotesCategoryFilter,
      setNotesSearch,
      setNotesSurface,
      setProPanelsOpen,
      setSelectedNoteId,
      setShellColorPickerOpen,
      setTextColorPickerOpen,
      shellColorPickerOpen,
      streakBandanaTier,
      textColorPickerOpen,
      togglePinned,
      undoDeleteNote,
      updateEditorBandanaCaret,
      updateSelectedNote,
      user?.uid,
      visibleBandanaColor,
      xpTierTheme,
    ],
  );
  const settingsTabProps = useMemo(
    () => ({
      companionPulse: companionState.pulses.settings,
      bandanaColor: visibleBandanaColor,
      sectionRef: settingsSectionRef,
      primaryRef: settingsPrimaryRef,
      streakBandanaTier,
      isPro,
      photoUrl: currentUserPhotoUrl,
      displayName: user?.displayName,
      email: user?.email,
      profileTierTheme,
      nextBandanaMilestone,
      proSource,
      streak,
      companionStyle,
      themeMode,
      sectionsOpen: settingsSectionsOpen,
      onToggleSection: (key: keyof typeof settingsSectionsOpen) =>
        setSettingsSectionsOpen((current) => {
          const nextValue = !current[key];
          return {
            identity: false,
            internalTools: false,
            protocol: false,
            appearance: false,
            background: false,
            archive: false,
            notifications: false,
            sync: false,
            screenTime: false,
            danger: false,
            legal: false,
            [key]: nextValue,
          };
        }),
      onFeedbackOpen: () => {
        setFeedbackOpen(true);
        setFeedbackStatus("");
      },
      onReplayTutorial: () => {
        setMobileMoreOpen(false);
        setProfileOpen(false);
        setFeedbackOpen(false);
        setOnboardingStepIndex(0);
        setOnboardingOpen(true);
      },
      onStartProPreview: () => void handleStartProPreview(),
      onManageSubscription: () => void handleManageSubscription(),
      onRestorePurchases: () => void handleRestorePurchases(),
      subscriptionBusy,
      subscriptionStatus,
      onSignOut: () => void handleSignOut(),
      onApplyCompanionStyle: applyCompanionStyle,
      onApplyThemeMode: applyThemeMode,
      appBackgroundSetting,
      backgroundSkin,
      backgroundUploadInputRef,
      onBackgroundUpload: handleBackgroundUpload,
      onApplyBackgroundSetting: applyBackgroundSetting,
      onUpdateBackgroundSkin: updateBackgroundSkin,
      proPanelBackgroundOpen: proPanelsOpen.background,
      onToggleProBackgroundPanel: () =>
        setProPanelsOpen((current) => ({ ...current, background: !current.background })),
      archiveExportBusy,
      archiveExportStatus,
      onExportArchive: handleExportArchive,
      notesExportBusy,
      notesExportStatus,
      onExportNotes: handleExportNotes,
      archiveImportBusy,
      archiveImportInputRef,
      onImportArchive: handleImportArchive,
      pendingArchiveImport: pendingArchiveImport
        ? {
            fileName: pendingArchiveImport.fileName,
            version: pendingArchiveImport.archive.version,
            tier: pendingArchiveImport.archive.account.tier,
            exportedAtISO: pendingArchiveImport.archive.exportedAtISO,
            notes: pendingArchiveImport.archive.summary.notes,
            plannedBlocks: pendingArchiveImport.archive.summary.plannedBlocks,
            sessions: pendingArchiveImport.archive.summary.sessions,
            cards: pendingArchiveImport.archive.summary.cards,
            mirrorEntries: pendingArchiveImport.archive.summary.mirrorEntries,
            sickDaySaves: pendingArchiveImport.archive.summary.sickDaySaves,
          }
        : null,
      onConfirmArchiveImport: () => void handleConfirmArchiveImport(),
      onCancelArchiveImport: () => {
        setPendingArchiveImport(null);
        setArchiveExportStatus("Archive import cancelled.");
      },
      notesSyncStatus,
      notesSyncMessage,
      onRetrySync: () => void handleRetrySync(),
      notificationSettings,
      notificationPermissionState,
      notificationDeliveryMode,
      notificationBusy,
      notificationStatus,
      scheduledNotificationCount,
      onApplyNotificationSettings: applyNotificationSettings,
      onRequestNotificationPermission: () => void requestNotificationPermission(),
      onResyncNotifications: () => void resyncNotifications(),
      screenTimeSupported,
      screenTimeStatus,
      screenTimeReason,
      screenTimeBusy,
      onRequestScreenTimeAuth: () => void handleRequestScreenTimeAuth(),
      onOpenScreenTimeSettings: () => void handleOpenScreenTimeSettings(),
      deletingAccount,
      onDeleteAccount: () => void handleDeleteAccount(),
      accountDangerStatus,
      onPreviewStreakMirror: openStreakSaveQuestionnairePreview,
      onPreviewDailyCommitment: openDailyPlanningPreview,
      onPreviewStreakAlert: openSickDaySavePromptPreview,
    }),
    [
      accountDangerStatus,
      appBackgroundSetting,
      applyBackgroundSetting,
      applyCompanionStyle,
      applyNotificationSettings,
      applyThemeMode,
      archiveExportBusy,
      archiveExportStatus,
      archiveImportBusy,
      archiveImportInputRef,
      backgroundSkin,
      backgroundUploadInputRef,
      companionState.pulses.settings,
      currentUserPhotoUrl,
      deletingAccount,
      handleDeleteAccount,
      handleExportArchive,
      handleExportNotes,
      handleImportArchive,
      handleManageSubscription,
      handleRestorePurchases,
      handleRetrySync,
      handleSignOut,
      handleStartProPreview,
      isPro,
      nextBandanaMilestone,
      notesExportBusy,
      notesExportStatus,
      notesSyncMessage,
      notesSyncStatus,
      notificationBusy,
      notificationDeliveryMode,
      notificationPermissionState,
      notificationSettings,
      notificationStatus,
      pendingArchiveImport,
      openDailyPlanningPreview,
      openSickDaySavePromptPreview,
      openStreakSaveQuestionnairePreview,
      proPanelsOpen.background,
      proSource,
      profileTierTheme,
      requestNotificationPermission,
      resyncNotifications,
      scheduledNotificationCount,
      screenTimeBusy,
      screenTimeReason,
      screenTimeStatus,
      screenTimeSupported,
      settingsPrimaryRef,
      settingsSectionRef,
      settingsSectionsOpen,
      streak,
      streakBandanaTier,
      subscriptionBusy,
      subscriptionStatus,
      themeMode,
      updateBackgroundSkin,
      user?.displayName,
      user?.email,
      visibleBandanaColor,
    ],
  );

  const markOnboardingSeen = useCallback(() => {
    if (!user) return;
    try {
      window.localStorage.setItem(onboardingStorageKey(user.uid), "seen");
    } catch {
      // Ignore storage failures in constrained webviews.
    }
  }, [user]);

  const closeOnboarding = useCallback((markSeen = true) => {
    if (markSeen) {
      markOnboardingSeen();
    }
    setOnboardingOpen(false);
  }, [markOnboardingSeen]);

  const startOnboarding = useCallback(() => {
    setMobileMoreOpen(false);
    setProfileOpen(false);
    setFeedbackOpen(false);
    setOnboardingStepIndex(0);
    setOnboardingOpen(true);
  }, [setFeedbackOpen, setMobileMoreOpen, setProfileOpen]);

  const handleOnboardingNext = useCallback(() => {
    if (onboardingStepIndex >= ONBOARDING_STEPS.length - 1) {
      closeOnboarding(true);
      return;
    }
    setOnboardingStepIndex((current) => current + 1);
  }, [closeOnboarding, onboardingStepIndex]);

  const overlayHostProps = useMemo(
    () => ({
      notificationsBlocked,
      sessionReward,
      onDismissSessionReward: () => setSessionReward(null),
      getStreakTierColorTheme,
      currentTierColor: shellTierColor,
      isPro,
      photoUrl: currentUserPhotoUrl,
      xpPops,
      onDoneXPPop: removeXPPop,
      whelToasts,
      onDismissToast: dismissToast,
      profileSheetProps: {
        open: profileOpen,
        onClose: () => setProfileOpen(false),
        tierColor: shellTierColor,
        isPro,
        photoUrl: currentUserPhotoUrl,
        profileDisplayName,
        identityLine: shellIdentityLine,
        nextPlannedBlock,
        normalizeTimeLabel,
        currentStreakLabel: shellCurrentStreakLabel,
        longestStreakLabel: shellLongestStreakLabel,
        lifetimeFocusMinutes,
        sessionsCount: sessions.length,
        nextAscentTitle: shellNextAscentTitle,
        nextAscentBody: shellNextAscentBody,
        onOpenStreaks: () => {
          setProfileOpen(false);
          setActiveTab("streaks");
        },
      },
      mobileMoreSheetProps: {
        open: mobileMoreOpen,
        onClose: () => setMobileMoreOpen(false),
        tabs: MOBILE_MORE_TABS,
        onSelectTab: (tab: string) => handleTabSelect(tab as AppTab),
        renderIcon: (tab: string) => renderAppNavIcon(tab as AppTab),
        getTitle: (tab: string) => tabTitle(tab as AppTab),
      },
      blockDetailModalProps: {
        open: Boolean(selectedPlanDetail),
        selectedPlanDetail,
        onClose: closePlannedBlockDetail,
        normalizeTimeLabel,
        attachmentIndicatorLabel,
        tonePicker: selectedPlanDetail ? (
          <CalendarTonePicker
            label="Block tone"
            selectedTone={visiblePlanTone(selectedPlanDetail.tone)}
            onSelectTone={(tone) => updatePlannedBlockTone(selectedPlanDetail.id, tone)}
            isPro={isPro}
            onUpgrade={openUpgradeFlow}
          />
        ) : null,
        onEdit: () => {
          if (!selectedPlanDetail || selectedPlanDetail.status !== "active") return;
          setActiveTab("today");
          setTodayTimeHubRequest({
            id: typeof crypto !== "undefined" ? crypto.randomUUID() : `edit-block-${selectedPlanDetail.id}`,
            tool: "block",
            draft: {
              editingBlockId: selectedPlanDetail.id,
              dateKey: selectedPlanDetail.dateKey,
              title: selectedPlanDetail.title,
              note: selectedPlanDetail.note,
              timeOfDay: selectedPlanDetail.timeOfDay,
              durationMinutes: selectedPlanDetail.durationMinutes,
            },
          });
          closePlannedBlockDetail();
        },
        onDuplicate: () => {
          if (!selectedPlanDetail || selectedPlanDetail.status !== "active") return;
          setActiveTab("today");
          setTodayTimeHubRequest({
            id: typeof crypto !== "undefined" ? crypto.randomUUID() : `duplicate-block-${selectedPlanDetail.id}`,
            tool: "block",
            draft: {
              dateKey: selectedPlanDetail.dateKey,
              title: selectedPlanDetail.title,
              note: selectedPlanDetail.note,
              timeOfDay: shiftBlockTime(selectedPlanDetail.timeOfDay, selectedPlanDetail.durationMinutes),
              durationMinutes: selectedPlanDetail.durationMinutes,
            },
          });
          closePlannedBlockDetail();
        },
        onComplete: () => {
          if (!selectedPlanDetail) return;
          void handleCompletePlannedBlockWithAlarm(selectedPlanDetail);
        },
        onOpenDayView: () => {
          if (!selectedPlanDetail) return;
          setSelectedCalendarDate(selectedPlanDetail.dateKey);
          setCalendarView("day");
          setActiveTab("calendar");
          closePlannedBlockDetail();
        },
        onRemove: () => {
          if (!selectedPlanDetail || selectedPlanDetail.status !== "active") return;
          deletePlannedBlock(selectedPlanDetail.id);
          closePlannedBlockDetail();
        },
      },
      dailyPlanningModalProps: {
        open: dailyPlanningOpen,
        previewOpen: dailyPlanningPreviewOpen,
        dailyRitualDrafts,
        dailyRitualExpandedId,
        onSetDailyRitualExpandedId: setDailyRitualExpandedId,
        onUpdateDailyRitualDraft: updateDailyRitualDraft,
        isPro,
        onUpgrade: openUpgradeFlow,
        dailyPlanningStatus,
        onClose: () => (dailyPlanningPreviewOpen ? closeDailyPlanningPreview() : setDailyPlanningOpen(false)),
        onSubmit: submitDailyRitual,
        headerIcon: (
          <DailyRitualWaveIcon
            className={styles.dailyRitualCornerIconImage}
            tierColor={shellTierColor}
          />
        ),
        submitDecoration: (
          <DailyRitualSubmitBandana
            className={styles.dailyRitualSubmitBandana}
            streakDays={hasEarnedToday ? displayStreak : displayStreak + 1}
          />
        ),
      },
      themePromptModalProps: {
        open: themePromptOpen,
        themeMode,
        onClose: () => setThemePromptOpen(false),
        onApplyThemeMode: applyThemeMode,
      },
      streakOverlayClusterProps: {
        notificationsBlocked,
        streakSaveQuestionnaireOpen,
        sickDaySaveEligible,
        streakSaveQuestionnairePreview,
        closeStreakSaveQuestionnaire,
        monthlyStreakSaveCount,
        streakSaveMonthlyLimit,
        streakMirrorSaying,
        questions: STREAK_SAVE_ACCOUNTABILITY_QUESTIONS,
        streakSaveAnswers,
        onSetStreakSaveAnswers: setStreakSaveAnswers,
        minWords: STREAK_MIRROR_MIN_WORDS,
        tags: STREAK_MIRROR_TAGS,
        streakMirrorTag,
        onSetStreakMirrorTag: setStreakMirrorTag,
        streakSaveStatus,
        onClaimSickDaySave: () =>
          claimSickDaySave({
            sickDaySaveEligible,
            monthlySaveLimitReached,
            yesterdayKey,
            sessions,
            protectedStreakDateKeys,
            onTrackStreakChange: (previousStreak, nextStreak, source, changedDateKey) =>
              trackStreakChange(previousStreak, nextStreak, source, null, changedDateKey),
            onAfterClaim: () => setActiveTab("mirror"),
          }),
        onDismissSickDaySavePrompt: dismissSickDaySavePrompt,
        sickDaySavePromptOpen,
        rawYesterdayMissed,
        yesterdaySave,
        sickDaySavePromptPreview,
        monthlySaveLimitReached,
        onOpenSickDaySaveReview: openSickDaySaveReview,
        noteUndoItem,
        deletedPlanUndo,
        onUndoDeleteNote: () => void undoDeleteNote(),
        onUndoDeletePlan: undoDeletePlannedBlock,
        streakCelebration,
        onDismissStreakCelebration: () => setStreakCelebration(null),
        getStreakTierColorTheme,
        streakNudge,
        onDismissStreakNudge: () => setStreakNudge(null),
        onStreakNudgeAction: handleStreakNudgeAction,
        currentTierColor: shellTierColor,
        isPro,
        photoUrl: currentUserPhotoUrl,
        nextBandanaMilestone,
      },
      paywallModalProps: {
        open: paywallOpen,
        userId: user?.uid ?? "",
        isPro,
        subscriptionStatus,
        onClose: () => setPaywallOpen(false),
        onRestorePurchases: () => void handleRestorePurchases(),
      },
      kpiDetailModalProps: {
        openKey: kpiDetailOpen,
        content: kpiDetailContent,
        onClose: () => setKpiDetailOpen(null),
      },
      feedbackModalProps: {
        open: feedbackOpen,
        feedbackSubmitting,
        feedbackStatus,
        feedbackCategory,
        feedbackMessage,
        userEmail: user?.email ?? null,
        onClose: () => setFeedbackOpen(false),
        onSetFeedbackStatus: setFeedbackStatus,
        onSetFeedbackCategory: (value: string) => setFeedbackCategory(value as FeedbackCategory),
        onSetFeedbackMessage: setFeedbackMessage,
        onSubmit: submitFeedback,
      },
      onboardingTourProps: {
        open: onboardingOpen,
        step: onboardingStep,
        stepIndex: onboardingStepIndex,
        totalSteps: ONBOARDING_STEPS.length,
        onNext: handleOnboardingNext,
        onSkip: () => closeOnboarding(true),
      },
      quickCardModalProps: {
        selectionPopup,
        quickCardForm,
        onSetQuickCardForm: setQuickCardForm,
        onSetSelectionPopup: setSelectionPopup,
        onSave: () => void handleQuickCardSave(),
        onBoldSelection: () => applyEditorCommand("bold"),
        onItalicSelection: () => applyEditorCommand("italic"),
        onUnderlineSelection: () => applyEditorCommand("underline"),
        onHighlightSelection: () => applyHighlightColor(NOTE_HIGHLIGHTS[0].value),
      },
      mascot,
      onDismissMascot: dismissMascot,
      leaderboardProfileModalProps: {
        selected: selectedLbProfile,
        onClose: () => setSelectedLbProfile(null),
        alreadyFriendUids,
        sentRequestUids,
        incomingRequestUids,
        onSendFriendRequest: handleSendFriendRequest,
      },
    }),
    [
      alreadyFriendUids,
      applyThemeMode,
      attachmentIndicatorLabel,
      closeDailyPlanningPreview,
      closeOnboarding,
      closePlannedBlockDetail,
      closeStreakSaveQuestionnaire,
      currentUserPhotoUrl,
      dailyPlanningOpen,
      dailyPlanningPreviewOpen,
      dailyPlanningStatus,
      dailyRitualDrafts,
      dailyRitualExpandedId,
      deletedPlanUndo,
      dismissMascot,
      dismissSickDaySavePrompt,
      dismissToast,
      feedbackCategory,
      feedbackMessage,
      feedbackOpen,
      feedbackStatus,
      feedbackSubmitting,
      getStreakTierColorTheme,
      handleSendFriendRequest,
      handleOnboardingNext,
      handleQuickCardSave,
      handleRestorePurchases,
      handleTabSelect,
      handleStreakNudgeAction,
      hasEarnedToday,
      incomingRequestUids,
      isPro,
      kpiDetailContent,
      kpiDetailOpen,
      lifetimeFocusMinutes,
      mascot,
      mobileMoreOpen,
      monthlySaveLimitReached,
      monthlyStreakSaveCount,
      nextPlannedBlock,
      noteUndoItem,
      notificationsBlocked,
      onboardingOpen,
      onboardingStep,
      onboardingStepIndex,
      openDailyPlanningPreview,
      openSickDaySaveReview,
      openUpgradeFlow,
      paywallOpen,
      profileDisplayName,
      profileOpen,
      protectedStreakDateKeys,
      quickCardForm,
      rawYesterdayMissed,
      removeXPPop,
      selectedLbProfile,
      selectedPlanDetail,
      sessionReward,
      sessions,
      setDailyPlanningOpen,
      setDailyRitualExpandedId,
      setFeedbackCategory,
      setFeedbackMessage,
      setFeedbackOpen,
      setFeedbackStatus,
      setKpiDetailOpen,
      setMobileMoreOpen,
      setOnboardingOpen,
      setOnboardingStepIndex,
      setProfileOpen,
      setSelectedCalendarDate,
      setSelectedLbProfile,
      setSelectionPopup,
      setQuickCardForm,
      setSessionReward,
      setStreakCelebration,
      setStreakMirrorTag,
      setStreakNudge,
      setStreakSaveAnswers,
      setThemePromptOpen,
      sickDaySaveEligible,
      sickDaySavePromptOpen,
      sickDaySavePromptPreview,
      streakCelebration,
      streakMirrorSaying,
      streakMirrorTag,
      streakNudge,
      streakSaveMonthlyLimit,
      streakSaveQuestionnaireOpen,
      streakSaveQuestionnairePreview,
      streakSaveStatus,
      shellCurrentStreakLabel,
      shellIdentityLine,
      shellLongestStreakLabel,
      shellNextAscentBody,
      shellNextAscentTitle,
      submitDailyRitual,
      subscriptionStatus,
      themeMode,
      trackStreakChange,
      undoDeleteNote,
      undoDeletePlannedBlock,
      updateDailyRitualDraft,
      updatePlannedBlockTone,
      user?.email,
      user?.uid,
      visibleBandanaColor,
      whelToasts,
      xpPops,
      yesterdayKey,
      yesterdaySave,
      sentRequestUids,
    ],
  );

  useEffect(() => {
    if (!authChecked || !user || showIntroSplash || onboardingAutostartedRef.current) return;

    onboardingAutostartedRef.current = true;
    try {
      if (window.localStorage.getItem(onboardingStorageKey(user.uid)) === "seen") {
        return;
      }
    } catch {
      // Ignore storage failures and fall through to showing the tour once.
    }

    const createdAtMs = currentUserCreatedAtISO
      ? new Date(currentUserCreatedAtISO).getTime()
      : Number.NaN;
    const accountAgeMs = Number.isFinite(createdAtMs) ? Date.now() - createdAtMs : Number.POSITIVE_INFINITY;
    if (accountAgeMs > ONBOARDING_NEW_USER_WINDOW_MS) {
      markOnboardingSeen();
      return;
    }

    startOnboarding();
  }, [
    authChecked,
    currentUserCreatedAtISO,
    markOnboardingSeen,
    showIntroSplash,
    startOnboarding,
    user,
  ]);

  useEffect(() => {
    if (!onboardingOpen) return;

    switch (onboardingStep.id) {
      case "schedule":
      case "block":
        setActiveTab("calendar");
        setCalendarView("day");
        setSelectedCalendarDate(todayKey);
        setMobileMoreOpen(false);
        break;
      case "timer":
      case "xp":
        setActiveTab("today");
        setMobileMoreOpen(false);
        break;
      case "notes":
      case "cards":
        setActiveTab("notes");
        setNotesSurface("notes");
        setMobileMoreOpen(false);
        break;
      case "whelmboard":
        setActiveTab("leaderboard");
        setMobileMoreOpen(false);
        break;
      case "replay":
        setActiveTab("settings");
        setMobileMoreOpen(false);
        setSettingsSectionsOpen({
          identity: false,
          internalTools: true,
          protocol: false,
          appearance: false,
          background: false,
          archive: false,
          notifications: false,
          sync: false,
          screenTime: false,
          danger: false,
          legal: false,
        });
        break;
      default:
        break;
    }

    const timer = window.setTimeout(() => {
      const target = Array.from(document.querySelectorAll(onboardingStep.selector)).find((node) => {
        if (!(node instanceof HTMLElement)) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: "auto", block: "center", inline: "center" });
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [
    onboardingOpen,
    onboardingStep,
    setActiveTab,
    setCalendarView,
    setMobileMoreOpen,
    setNotesSurface,
    setSelectedCalendarDate,
    todayKey,
  ]);

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

  if (!user) {
    return (
      <main className={styles.pageShell}>
        <div className={styles.loadingCard}>
          <p className={styles.loadingLabel}>Opening Whelm login...</p>
          <button
            type="button"
            className={styles.secondaryPlanButton}
            onClick={() => window.location.assign("/login")}
          >
            Go to login
          </button>
        </div>
      </main>
    );
  }

  function handleCardsXPEarned(amount: number) {
    if (amount <= 0) return;
    showMascot("cards_session_done");
    triggerXPPop(amount);
    // TODO: reconcile cards-earned XP with the derived xpByDay/lifetimeXpSummary flow before mutating parent XP state.
  }

  return (
    <>
      <HomeShellFrame
        resolvedTheme={resolvedTheme}
        backgroundSkinActive={backgroundSkinActive}
        pageShellStyle={pageShellStyle}
        activeTab={activeTab}
        mobileMoreActive={mobileMoreActive}
        mobileMoreOpen={mobileMoreOpen}
        onSelectTab={handleTabSelect}
        subtitle={`${WHELM_BRAND_THESIS} Plan the line, protect the streak, and keep the day under command.`}
        xpDockStyle={xpDockStyle}
        currentLevel={lifetimeXpSummary.currentLevel}
        progressToNextLevel={lifetimeXpSummary.progressToNextLevel}
        todayXp={lifetimeXpSummary.todayXp}
        dailyCap={lifetimeXpSummary.dailyCap}
        formattedLifetimeXp={formattedLifetimeXp}
        formattedXpToNextLevel={formattedXpToNextLevel}
        tierColor={shellTierColor}
        identityReady={shellStreakRecord.summary.isReady}
        isPro={isPro}
        photoUrl={currentUserPhotoUrl}
        isMobileViewport={isMobileViewport}
        profileDisplayName={profileDisplayName}
        onProfileOpen={() => setProfileOpen(true)}
        onMoreOpen={() => setMobileMoreOpen(true)}
      >
        <HomeActiveTabContent
          activeTab={activeTab}
          todayContainerProps={todayContainerProps}
          scheduleContainerProps={scheduleContainerProps}
          notesContainerProps={notesContainerProps}
          leaderboardTabProps={{
            sectionRef: leaderboardSectionRef,
            primaryRef: leaderboardPrimaryRef,
            leaderboardMetricTab,
            onSetMetricTab: setLeaderboardMetricTab,
            leaderboardCurrentUserRank,
            leaderboardCurrentUserMovement,
            leaderboardSource,
            leaderboardTotalEntries,
            leaderboardRows,
            leaderboardAroundRows,
            leaderboardBandanaHolders,
            leaderboardError,
            leaderboardLoading,
            leaderboardHasEntries,
            leaderboardHasMore,
            leaderboardIsLive,
            seenChallengerIds,
            onSelectProfile: setSelectedLbProfile,
            onLoadMore: () => void handleLeaderboardLoadMore(),
            friends,
            incomingRequests: friendIncomingRequests,
            outgoingRequests: friendOutgoingRequests,
            searchResults: friendSearchResults,
            searchQuery: friendSearchQuery,
            searchLoading: friendSearchLoading,
            friendsLoading,
            friendsError,
            sentRequestUids,
            alreadyFriendUids,
            incomingRequestUids,
            onFriendSearch: handleFriendSearch,
            onSendFriendRequest: handleSendFriendRequest,
            onAcceptFriendRequest: handleAcceptFriendRequest,
            onDeclineFriendRequest: handleDeclineFriendRequest,
            onRemoveFriend: handleRemoveFriend,
            onNudgeFriend: handleNudgeFriend,
            canNudgeFriend,
            nudgeAvailableInMinutes,
          }}
          mirrorTabProps={{
            sectionRef: mirrorSectionRef,
            entriesAnchorRef: mirrorEntriesAnchorRef,
            mirrorSectionsOpen,
            onToggleMirrorSection: (key) =>
              setMirrorSectionsOpen((current) => ({ ...current, [key]: !current[key] })),
            streakMirrorSaying,
            mirrorPrivacyOpen,
            onToggleMirrorPrivacy: () => setMirrorPrivacyOpen((current) => !current),
            monthlyStreakSaveCount,
            streakSaveMonthlyLimit,
            streakSaveSlotsLeft,
            streakMirrorEntries,
            streakMirrorVisibleEntries,
            selectedStreakMirrorEntry,
            isPro,
            onSelectMirrorEntry: (id) => {
              setSelectedStreakMirrorId(id);
              setMirrorSectionsOpen((current) => ({
                ...current,
                entries: true,
                detail: true,
              }));
            },
            proPanelMirrorOpen: proPanelsOpen.mirror,
            onToggleProMirrorPanel: () =>
              setProPanelsOpen((current) => ({ ...current, mirror: !current.mirror })),
            onStartProPreview: () => void handleStartProPreview(),
          }}
          historyTabProps={{
            companionPulse: companionState.pulses.history,
            bandanaColor: visibleBandanaColor,
            sectionRef: historySectionRef,
            primaryRef: historyPrimaryRef,
            historySearch,
            onSetHistorySearch: setHistorySearch,
            historyWindow,
            onSetHistoryWindow: setHistoryWindow,
            plannedBlockHistory,
            historySectionsOpen,
            onToggleHistorySection: toggleHistorySection,
            isPro,
            hasLockedBlockHistory,
            proPanelCalendarOpen: proPanelsOpen.calendar,
            onToggleProCalendarPanel: () =>
              setProPanelsOpen((current) => ({ ...current, calendar: !current.calendar })),
            onStartProPreview: () => void handleStartProPreview(),
            sessionHistoryGroups: isPro ? sessionHistoryGroups : freeSessionHistoryGroups,
            historyGroupsOpen,
            onToggleHistoryGroup: toggleHistoryGroup,
            hasLockedHistoryDays,
            proPanelHistoryOpen: proPanelsOpen.history,
            onToggleProHistoryPanel: () =>
              setProPanelsOpen((current) => ({ ...current, history: !current.history })),
            normalizeTimeLabel,
            stripCompletedBlockPrefix,
          }}
          reportsTabProps={{
            sectionRef: reportsSectionRef,
            primaryRef: reportsPrimaryRef,
            companionPulse: companionState.pulses.reports,
            bandanaColor: visibleBandanaColor,
            isPro,
            proPanelReportsOpen: proPanelsOpen.reports,
            onToggleProReportsPanel: () =>
              setProPanelsOpen((current) => ({ ...current, reports: !current.reports })),
            onStartProPreview: () => void handleStartProPreview(),
            focusMetrics,
            insightRange,
            onSetInsightRange: setInsightRange,
            analyticsDateRange,
            analyticsError,
            analyticsLoading,
            analyticsWeeklySummary,
            analyticsLeadInsight,
            analyticsBestWindow: analyticsBestHours?.bestWindow ?? null,
            analyticsLeadSubject,
            analyticsLeadNotification,
            reportsSectionsOpen,
            onToggleReportsSection: (key) =>
              setReportsSectionsOpen((current) => {
                const nextValue = !current[key];
                return {
                  score: false,
                  insights: false,
                  timing: false,
                  subjects: false,
                  notifications: false,
                  [key]: nextValue,
                };
              }),
            analyticsScoreHistory,
            analyticsScorePath,
            analyticsInsights,
            analyticsTopHours,
            analyticsTopSubjects,
            analyticsTopSubjectMinutes,
            analyticsNotificationPlan,
          }}
          streaksTabProps={{
            sectionRef: streaksSectionRef,
            primaryRef: streaksPrimaryRef,
            streakRulesOpen,
            onToggleStreakRules: () => setStreakRulesOpen((current) => !current),
            streakRuleSummaryLine,
            todayProtectionTitle: streakTodayPresentation.protectionTitle,
            todayProtectionBody: streakTodayPresentation.protectionBody,
            todayProtectionStatusLabel: streakTodayPresentation.protectionStatusLabel,
            rulesBlocksLabel: streakTodayPresentation.rulesBlocksLabel,
            rulesMinutesLabel: streakTodayPresentation.rulesMinutesLabel,
            rulesWordsLabel: streakTodayPresentation.rulesWordsLabel,
            rawYesterdayMissed,
            yesterdaySave,
            sickDaySaveEligible,
            monthlySaveLimitReached,
            yesterdayKey,
            monthlyStreakSaveCount,
            streakSaveMonthlyLimit,
            onOpenStreakSaveQuestionnaire: openStreakSaveQuestionnaire,
            onDeclineSickDaySave: () => declineSickDaySave(rawYesterdayMissed, yesterdayKey),
            onGoToMirror: () => setActiveTab("mirror"),
            onGoToToday: () => setActiveTab("today"),
            streakMonthLabel,
            streakMonthCalendar,
            onPrevMonth: () => setStreakCalendarCursor((current) => shiftMonth(current, -1)),
            onNextMonth: () => setStreakCalendarCursor((current) => shiftMonth(current, 1)),
            sessionMinutesByDay,
            completedBlocksByDay,
            noteWordsByDay,
            streakQualifiedDateKeys,
            onGoToTodayFromCalendar: () => setActiveTab("today"),
          }}
          settingsTabProps={settingsTabProps}
        />

      <BottomNav
        activeTab={activeTab}
        mobileMoreActive={mobileMoreActive}
        mobileMoreOpen={mobileMoreOpen}
        suppressMoreFab={Boolean(
          sessionReward ||
          streakCelebration ||
          streakNudge ||
          sickDaySavePromptOpen ||
          streakSaveQuestionnaireOpen,
        )}
        onTabSelect={handleMobileTabSelect}
        onMoreOpen={() => setMobileMoreOpen(true)}
      />

      </HomeShellFrame>
      <HomeOverlayHost {...overlayHostProps} />
    </>
  );
}
