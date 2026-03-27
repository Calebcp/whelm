"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useRive } from "@rive-app/react-canvas";
import { AnimatePresence, motion } from "motion/react";
import { type User } from "firebase/auth";
import { ref as storageRef } from "firebase/storage";

import BottomNav from "@/components/BottomNav";
import TopAppBar from "@/components/TopAppBar";
import SettingsTab from "@/components/SettingsTab";
import HistoryTab from "@/components/HistoryTab";
import WhelmboardTab from "@/components/WhelmboardTab";
import StreaksTab from "@/components/StreaksTab";
import MirrorTab from "@/components/MirrorTab";
import NotesTab from "@/components/NotesTab";
import ReportsTab from "@/components/ReportsTab";
import ScheduleTab from "@/components/ScheduleTab";
import TodayTab from "@/components/TodayTab";
import SenseiFigure, { type SenseiVariant } from "@/components/SenseiFigure";
import WhelMascot from "@/components/WhelMascot";
import WhelmEmote from "@/components/WhelmEmote";
import WhelmRitualScene from "@/components/WhelmRitualScene";
import CardsTab from "@/components/CardsTab";
import XPPopAnimation, { type XPPop } from "@/components/XPPopAnimation";
import WhelToastContainer, { useToasts } from "@/components/WhelToast";
import { createCard, loadCards, saveCards } from "@/lib/cards-store";
import {
  trackAppOpened,
  trackStreakUpdated,
  trackTaskCreated,
} from "@/lib/analytics-tracker";
import { resolveApiUrl } from "@/lib/api-base";
import { auth, db, storage } from "@/lib/firebase";
import {
  type NoteAttachment,
  type WorkspaceNote,
} from "@/lib/notes-store";
import {
  type PreferencesBackgroundSetting,
  type PreferencesBackgroundSkin,
} from "@/lib/preferences-store";
import { loadSessions } from "@/lib/session-store";
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
import type { WhelmEmoteId } from "@/lib/whelm-emotes";
import { subscribeToUserData } from "@/lib/firestore-sync";
import type { AppTab } from "@/lib/app-tabs";
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
import { usePlannedBlocks } from "@/hooks/usePlannedBlocks";
import { useAccountSettings } from "@/hooks/useAccountSettings";
import { usePreferences } from "@/hooks/usePreferences";
import { useCalendarInteractions } from "@/hooks/useCalendarInteractions";
import { useReflection } from "@/hooks/useReflection";
import { useReportsAnalytics } from "@/hooks/useReportsAnalytics";
import { useSessions } from "@/hooks/useSessions";
import { useStreak } from "@/hooks/useStreak";
import { useTabNavigation } from "@/hooks/useTabNavigation";
import { useUserData } from "@/hooks/useUserData";
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
    id: "aurora",
    label: "Aurora",
    background:
      "radial-gradient(circle at 12% 0%, rgba(62, 115, 255, 0.24), transparent 28%), radial-gradient(circle at 88% 12%, rgba(82, 214, 255, 0.2), transparent 26%), linear-gradient(180deg, rgba(7, 9, 18, 0.92), rgba(14, 18, 34, 0.98))",
  },
  {
    id: "ember",
    label: "Ember",
    background:
      "radial-gradient(circle at 18% 8%, rgba(255, 127, 80, 0.24), transparent 26%), radial-gradient(circle at 82% 0%, rgba(244, 63, 94, 0.18), transparent 24%), linear-gradient(180deg, rgba(19, 8, 12, 0.94), rgba(28, 14, 20, 0.98))",
  },
  {
    id: "forest",
    label: "Forest",
    background:
      "radial-gradient(circle at 10% 10%, rgba(34, 197, 94, 0.2), transparent 24%), radial-gradient(circle at 92% 0%, rgba(45, 212, 191, 0.14), transparent 22%), linear-gradient(180deg, rgba(6, 16, 14, 0.94), rgba(9, 24, 20, 0.98))",
  },
  {
    id: "dawn",
    label: "Dawn",
    background:
      "radial-gradient(circle at 12% 0%, rgba(251, 191, 36, 0.22), transparent 28%), radial-gradient(circle at 88% 10%, rgba(249, 115, 22, 0.18), transparent 26%), linear-gradient(180deg, rgba(20, 14, 9, 0.94), rgba(31, 22, 14, 0.98))",
  },
] as const;

const MIN_PLANNED_BLOCK_MINUTES = 15;
const MAX_PLANNED_BLOCK_MINUTES = 240;
const MIN_PLANNED_BLOCK_GAP_MINUTES = 15;

const WHELM_BRAND_THESIS = "Whelm is where productivity becomes a standard, not a mood.";
const WHELM_PRO_POSITIONING =
  "Whelm Pro is the full version of the system: deeper reports, longer memory, stronger personalization, a cleaner command center, and of course more animated PRO WHELMS!";
const STREAK_MIRROR_MIN_WORDS = 33;
const STREAK_SAVE_MONTHLY_LIMIT = 5;
const CALENDAR_TONES = [
  { value: "Clear", ariaLabel: "Electric blue", accent: "#53b7ff" },
  { value: "Push", ariaLabel: "Solar orange", accent: "#ff9b54" },
  { value: "Deep", ariaLabel: "Voltage violet", accent: "#7c7cff" },
  { value: "Sharp", ariaLabel: "Laser yellow", accent: "#ffe14d" },
  { value: "Steady", ariaLabel: "Neon green", accent: "#47f59a" },
  { value: "Recover", ariaLabel: "Hot pink", accent: "#ff6f9f" },
] as const;
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

type LeaderboardMetricTab = "xp" | "streak";
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
type LeaderboardMovement = {
  delta: number;
  previousRank: number | null;
  direction: "up" | "down" | "same" | "new";
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

type CalendarTone = (typeof CALENDAR_TONES)[number]["value"];

type MonthCell = {
  key: string;
  dayNumber: number | null;
  minutes: number;
  level: 0 | 1 | 2 | 3;
  isCurrentMonth: boolean;
  tone?: CalendarTone;
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
  tone: "Blue" | "Mint" | "Violet" | CalendarTone;
  startMinute: number;
  endMinute: number;
  isCompleted?: boolean;
  noteId?: string;
  planId?: string;
};

type AgendaTimingState = "now" | "next" | "upcoming" | "overdue" | "completed" | "logged";

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
  attachmentCount?: number;
  tone?: CalendarTone;
  durationMinutes: number;
  timeOfDay: string;
  sortOrder: number;
  createdAtISO: string;
  updatedAtISO: string;
  status: "active" | "completed";
  completedAtISO?: string;
};

type DayToneMap = Record<string, CalendarTone>;
type MonthToneMap = Record<string, CalendarTone>;

type KpiDetailKey =
  | "totalFocus"
  | "totalSessions"
  | "averageSession"
  | "bestDay"
  | "weeklyProgress";

function getCalendarToneMeta(tone: CalendarTone | null | undefined) {
  return CALENDAR_TONES.find((item) => item.value === tone) ?? null;
}

function getCalendarToneStyle(tone: CalendarTone | null | undefined): CSSProperties | undefined {
  const meta = getCalendarToneMeta(tone);
  return meta ? ({ ["--calendar-tone-accent" as const]: meta.accent } as CSSProperties) : undefined;
}

function CalendarTonePicker({
  label,
  selectedTone,
  onSelectTone,
  isPro,
  onUpgrade,
}: {
  label: "Month tone" | "Day tone" | "Block tone";
  selectedTone: CalendarTone | null;
  onSelectTone: (tone: CalendarTone | null) => void;
  isPro: boolean;
  onUpgrade: () => void;
}) {
  "use no memo";

  const [open, setOpen] = useState(false);
  const selectedToneStyle = getCalendarToneStyle(selectedTone);

  return (
    <div className={`${styles.calendarTonePanel} ${open ? styles.calendarTonePanelOpen : ""}`}>
      <button
        type="button"
        className={`${styles.calendarToneDisclosureButton} ${
          selectedTone ? styles.calendarToneDisclosureButtonActive : ""
        }`}
        style={selectedToneStyle}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className={styles.calendarToneDisclosureLabel}>{label}</span>
        <span className={styles.calendarToneDisclosureMeta}>
          <span
            className={`${styles.calendarToneDisclosureSwatch} ${
              !selectedTone ? styles.calendarToneDisclosureSwatchOff : ""
            }`}
            style={selectedToneStyle}
            aria-hidden="true"
          >
            <span className={styles.calendarToneDisclosureSwatchFill} />
          </span>
        </span>
      </button>
      {open &&
        (isPro ? (
          <div className={styles.calendarToneSwatchRow}>
            <button
              type="button"
              className={`${styles.calendarToneSwatch} ${styles.calendarToneSwatchReset} ${
                !selectedTone ? styles.calendarToneSwatchActive : ""
              }`}
              onClick={() => onSelectTone(null)}
              aria-label={`Reset ${label.toLowerCase()}`}
              title={`Reset ${label.toLowerCase()}`}
            >
              <span>Off</span>
            </button>
            {CALENDAR_TONES.map((tone) => (
              <button
                key={tone.value}
                type="button"
                className={`${styles.calendarToneSwatch} ${
                  selectedTone === tone.value ? styles.calendarToneSwatchActive : ""
                }`}
                style={getCalendarToneStyle(tone.value)}
                onClick={() => onSelectTone(tone.value)}
                aria-label={tone.ariaLabel}
                title={tone.ariaLabel}
              >
                <span className={styles.calendarToneSwatchFill} />
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.calendarToneLockedPreview}>
            <div className={styles.calendarToneLockedSwatchGrid}>
              {CALENDAR_TONES.map((tone) => (
                <button
                  key={tone.value}
                  type="button"
                  className={styles.calendarToneLockedSwatch}
                  style={getCalendarToneStyle(tone.value)}
                  onClick={onUpgrade}
                  aria-label={`Preview ${tone.value.toLowerCase()} tone in Whelm Pro`}
                >
                  <span className={styles.calendarToneLockedSwatchFill} />
                  <small>{tone.value}</small>
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.calendarToneLockedCard}
              style={getCalendarToneStyle(selectedTone ?? CALENDAR_TONES[0].value)}
              onClick={onUpgrade}
            >
              <div className={styles.calendarToneLockedCardHead}>
                <span>{label}</span>
                <strong>{selectedTone ?? CALENDAR_TONES[0].value}</strong>
              </div>
              <div className={styles.calendarToneLockedCardPreview}>
                <div className={styles.calendarToneLockedCardTime}>9:00 AM</div>
                <div>
                  <strong>Deep focus block</strong>
                  <small>See how premium tone styling lands inside the planner.</small>
                </div>
              </div>
            </button>
            <button type="button" className={styles.inlineUpgrade} onClick={onUpgrade}>
              Enter Whelm Pro Preview
            </button>
          </div>
        ))}
    </div>
  );
}

function CollapsibleSectionCard({
  className,
  label,
  title,
  description,
  open,
  onToggle,
  children,
}: {
  className?: string;
  label: string;
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <motion.article
      className={[styles.card, className].filter(Boolean).join(" ")}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        className={styles.cardCollapseToggle}
        onClick={onToggle}
        aria-expanded={open}
      >
        <div className={styles.cardCollapseCopy}>
          <p className={styles.sectionLabel}>{label}</p>
          <h2 className={styles.cardTitle}>{title}</h2>
          {description ? <p className={styles.accountMeta}>{description}</p> : null}
        </div>
        <span className={styles.cardCollapseState}>{open ? "Hide" : "Open"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className={styles.cardCollapseBody}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}

function AnimatedTabSection({
  className,
  children,
  sectionRef,
}: {
  className?: string;
  children: ReactNode;
  sectionRef?: React.Ref<HTMLElement>;
}) {
  return (
    <motion.section
      className={className}
      ref={sectionRef}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}

function monthKeyLocal(input: Date | string) {
  const value = typeof input === "string" ? new Date(input) : input;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

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
    attachments: [],
    color: "#e7e5e4",
    shellColor: "#fff7d6",
    surfaceStyle: "solid",
    isPinned: false,
    fontFamily: "Avenir Next",
    fontSizePx: 16,
    category: "personal",
    reminderAtISO: "",
    createdAtISO: now,
    updatedAtISO: now,
  };
}

function noteAttachmentKind(mimeType: string, fileName: string): NoteAttachment["kind"] {
  const normalizedMime = mimeType.toLowerCase();
  const extension = fileName.toLowerCase().split(".").pop() || "";

  if (normalizedMime.startsWith("image/")) return "image";
  if (
    normalizedMime.includes("pdf") ||
    normalizedMime.includes("word") ||
    normalizedMime.includes("document") ||
    ["pdf", "doc", "docx", "pages", "rtf"].includes(extension)
  ) {
    return "document";
  }
  if (
    normalizedMime.includes("spreadsheet") ||
    normalizedMime.includes("excel") ||
    ["xls", "xlsx", "csv", "numbers"].includes(extension)
  ) {
    return "spreadsheet";
  }
  if (
    normalizedMime.includes("presentation") ||
    normalizedMime.includes("powerpoint") ||
    ["ppt", "pptx", "key"].includes(extension)
  ) {
    return "presentation";
  }
  if (
    normalizedMime.startsWith("text/") ||
    ["txt", "md"].includes(extension)
  ) {
    return "text";
  }
  if (
    normalizedMime.includes("zip") ||
    normalizedMime.includes("compressed") ||
    ["zip"].includes(extension)
  ) {
    return "archive";
  }
  return "other";
}

function noteAttachmentBadgeLabel(attachment: NoteAttachment) {
  switch (attachment.kind) {
    case "image":
      return "Image";
    case "document":
      return "Document";
    case "spreadsheet":
      return "Sheet";
    case "presentation":
      return "Slides";
    case "archive":
      return "Archive";
    case "text":
      return "Text";
    default:
      return "File";
  }
}

function noteAttachmentGlyph(attachment: Pick<NoteAttachment, "kind">) {
  switch (attachment.kind) {
    case "image":
      return "◫";
    case "document":
      return "▤";
    case "spreadsheet":
      return "▥";
    case "presentation":
      return "◩";
    case "archive":
      return "⬚";
    case "text":
      return "≣";
    default:
      return "•";
  }
}

function formatAttachmentSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(sizeBytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function parseHexColor(value: string) {
  const normalized = value.trim();
  const match = normalized.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return null;

  const hex = match[1];
  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : hex;

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  return { red, green, blue };
}

function relativeLuminance({ red, green, blue }: { red: number; green: number; blue: number }) {
  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
}

function notePreviewStyle(tint: string): CSSProperties {
  const parsed = parseHexColor(tint);
  const luminance = parsed ? relativeLuminance(parsed) : 1;
  const usesDarkInk = luminance > 0.64;

  return {
    ["--note-item-tint" as const]: tint,
    ["--note-item-title" as const]: usesDarkInk ? "#102033" : "#f7fbff",
    ["--note-item-meta" as const]: usesDarkInk ? "rgba(16, 32, 51, 0.72)" : "rgba(247, 251, 255, 0.78)",
    ["--note-item-chip-bg" as const]: usesDarkInk ? "rgba(16, 32, 51, 0.12)" : "rgba(255, 255, 255, 0.16)",
    ["--note-item-chip-color" as const]: usesDarkInk ? "#183a67" : "#f7fbff",
    ["--note-item-text-shadow" as const]: usesDarkInk
      ? "0 1px 0 rgba(255, 255, 255, 0.26)"
      : "0 1px 10px rgba(8, 12, 24, 0.28)",
  } as CSSProperties;
}

function resolveFirebaseStorageBucket() {
  return typeof storage.app.options.storageBucket === "string"
    ? storage.app.options.storageBucket.trim()
    : "";
}

function describeAttachmentUploadError(error: unknown, bucketName: string) {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";

  switch (code) {
    case "storage/unauthorized":
      return "Firebase Storage rejected the upload. Check Storage rules for authenticated writes to users/{uid}/notes/**.";
    case "storage/bucket-not-found":
      return `Firebase Storage bucket "${bucketName}" was not found. Check NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET and confirm Storage is enabled for this project.`;
    case "storage/project-not-found":
      return "Firebase Storage could not find this Firebase project. Check the deployed Firebase project configuration.";
    case "storage/quota-exceeded":
      return "Firebase Storage quota was exceeded. The upload was rejected by the bucket.";
    case "storage/retry-limit-exceeded":
      return `Firebase Storage stopped retrying the upload for bucket "${bucketName}". Check the bucket, Storage rules, and browser network access.`;
    case "storage/canceled":
      return error instanceof Error && error.message
        ? error.message
        : "Attachment upload was canceled.";
    default:
      return error instanceof Error && error.message
        ? error.message
        : "Attachment upload failed.";
  }
}

function bandanaCursorAssetPath(color: string | null | undefined, size: 128 | 256 = 128) {
  const resolved = color ?? "yellow";
  return `/streak/cursor/bandana-${resolved}-${size}.png`;
}

function bandanaImageGlow(color: string | null | undefined): string {
  switch (color) {
    case "yellow": return "rgba(255, 200, 0, 0.5)";
    case "red":    return "rgba(220, 50, 50, 0.5)";
    case "green":  return "rgba(50, 200, 100, 0.5)";
    case "purple": return "rgba(150, 50, 220, 0.5)";
    case "blue":   return "rgba(50, 120, 255, 0.5)";
    case "black":  return "rgba(180, 180, 180, 0.4)";
    case "white":  return "rgba(255, 255, 255, 0.6)";
    default:       return "transparent";
  }
}

function attachmentIndicatorLabel(count: number) {
  return `📎 ${count}`;
}

function noteWordCount(body: string): number {
  return body.trim() === "" ? 0 : body.trim().split(/\s+/).length;
}

function streakNudgeStorageKey(uid: string, dateKey: string) {
  return `whelm:streak-nudges:${uid}:${dateKey}`;
}

function readStreakNudgeSeen(uid: string, dateKey: string) {
  try {
    const raw = window.localStorage.getItem(streakNudgeStorageKey(uid, dateKey));
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function markStreakNudgeSeen(uid: string, dateKey: string, slot: string) {
  const next = readStreakNudgeSeen(uid, dateKey);
  next.add(slot);
  window.localStorage.setItem(streakNudgeStorageKey(uid, dateKey), JSON.stringify([...next]));
}

type LocalNoteDraft = {
  body: string;
  updatedAtISO: string;
};

function noteDraftStorageKey(uid: string, noteId: string) {
  return `whelm:note-draft:${uid}:${noteId}`;
}

function readLocalNoteDraft(uid: string, noteId: string) {
  try {
    const raw = window.localStorage.getItem(noteDraftStorageKey(uid, noteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalNoteDraft;
    if (!parsed || typeof parsed.body !== "string" || typeof parsed.updatedAtISO !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalNoteDraft(uid: string, noteId: string, body: string, updatedAtISO: string) {
  window.localStorage.setItem(
    noteDraftStorageKey(uid, noteId),
    JSON.stringify({ body, updatedAtISO } satisfies LocalNoteDraft),
  );
}

function clearLocalNoteDraft(uid: string, noteId: string) {
  window.localStorage.removeItem(noteDraftStorageKey(uid, noteId));
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

function countWords(value: string) {
  const plainText = value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return plainText ? plainText.split(" ").length : 0;
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
type ProfileAvatarSize = "mini" | "row" | "compact" | "hero";

type ProfileTierTheme = {
  title: string;
  imagePath: string;
};



type PendingNoteAttachment = {
  id: string;
  name: string;
  kind: NoteAttachment["kind"];
  progress: number;
};



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

function getStreakBandanaAssetPath(tierColor: string | null | undefined) {
  const tier =
    STREAK_BANDANA_TIERS.find((item) => item.color === tierColor) ??
    STREAK_BANDANA_TIERS.find((item) => item.color === "yellow");
  return tier ? `/streak/${tier.assetFile}` : "/streak/moveband.riv";
}















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
    case "mirror":
      return <img src="/mirror-icon-tab.png" alt="" className={styles.navIconImage} />;
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
    case "leaderboard":
      return <img src="/leaderboard-icon-tab.png" alt="" className={styles.navIconImage} />;
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
  photoUrl,
}: {
  tierColor: string | null | undefined;
  size: ProfileAvatarSize;
  isPro?: boolean;
  photoUrl?: string | null;
}) {
  const theme = getProfileTierTheme(tierColor, isPro);

  return (
    <div
      className={`${styles.profileAvatarCard} ${
        size === "mini"
          ? styles.profileAvatarCardMini
          : size === "row"
          ? styles.profileAvatarCardRow
          : size === "compact"
            ? styles.profileAvatarCardCompact
            : styles.profileAvatarCardHero
      }`}
      data-tier-color={tierColor ?? "yellow"}
      aria-hidden="true"
    >
      <img src={theme.imagePath} alt="" className={styles.profileAvatarImage} />
      {photoUrl ? (
        <span className={styles.profileAvatarPhotoShell}>
          <img src={photoUrl} alt="" className={styles.profileAvatarPhoto} />
        </span>
      ) : null}
    </div>
  );
}

function tabTitle(tab: AppTab) {
  switch (tab) {
    case "today":
      return "Today";
    case "calendar":
      return "Schedule";
    case "leaderboard":
      return "Whelmboard";
    case "mirror":
      return "Streak Mirror";
    case "notes":
      return "Notes+";
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

function getLeaderboardBandanaMeta(streak: number) {
  const tier = getStreakBandanaTier(streak);
  const theme = getStreakTierColorTheme(tier?.color);

  return {
    tier,
    theme,
    label: tier ? tier.label : "No bandana",
    shortLabel: tier ? tier.label.replace(" Bandana", "") : "None",
  };
}

function formatLeaderboardXp(totalXp: number) {
  return `${totalXp.toLocaleString()} XP`;
}

function compareLeaderboardEntries(
  left: LeaderboardEntry,
  right: LeaderboardEntry,
  tab: LeaderboardMetricTab,
) {
  if (tab === "xp") {
    return (
      right.totalXp - left.totalXp ||
      right.currentStreak - left.currentStreak ||
      left.createdAtISO.localeCompare(right.createdAtISO)
    );
  }

  return (
    right.currentStreak - left.currentStreak ||
    right.totalXp - left.totalXp ||
    left.createdAtISO.localeCompare(right.createdAtISO)
  );
}

function movementForRanks(currentRank: number, previousRank: number | null): LeaderboardMovement {
  if (previousRank === null) {
    return { delta: 0, previousRank, direction: "new" };
  }

  const delta = previousRank - currentRank;
  if (delta > 0) return { delta, previousRank, direction: "up" };
  if (delta < 0) return { delta, previousRank, direction: "down" };
  return { delta: 0, previousRank, direction: "same" };
}

function leaderboardMovementLabel(movement: LeaderboardMovement, tab: LeaderboardMetricTab) {
  if (movement.direction === "new") return tab === "xp" ? "New challenger" : "New";
  if (movement.direction === "same") return tab === "xp" ? "No movement" : "Flat";
  const magnitude = Math.abs(movement.delta);
  return movement.direction === "up"
    ? `${tab === "xp" ? "Up" : "+"}${magnitude}`
    : `${tab === "xp" ? "Down" : "-"}${magnitude}`;
}

function LeaderboardMovementIndicator({
  movement,
  tab,
}: {
  movement: LeaderboardMovement;
  tab: LeaderboardMetricTab;
}) {
  const label = leaderboardMovementLabel(movement, tab);
  const directionClassName =
    movement.direction === "up"
      ? styles.leaderboardMovementUp
      : movement.direction === "down"
        ? styles.leaderboardMovementDown
        : movement.direction === "new"
          ? styles.leaderboardMovementNew
          : styles.leaderboardMovementSame;

  if (tab === "xp") {
    return (
      <span className={`${styles.leaderboardMovementBadge} ${directionClassName}`}>
        <span className={styles.leaderboardMovementArrow}>
          {movement.direction === "up"
            ? "▲"
            : movement.direction === "down"
              ? "▼"
              : movement.direction === "new"
                ? "✦"
                : "•"}
        </span>
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span className={`${styles.leaderboardMovementSubtle} ${directionClassName}`}>
      {label}
    </span>
  );
}

function LeaderboardRow({
  entry,
  rank,
  movement,
  tab,
  onClick,
}: {
  entry: LeaderboardEntry;
  rank: number;
  movement: LeaderboardMovement;
  tab: LeaderboardMetricTab;
  onClick?: () => void;
}) {
  const bandana = getLeaderboardBandanaMeta(entry.currentStreak);
  const rankAccent =
    rank === 1 ? styles.leaderboardRowGold
    : rank === 2 ? styles.leaderboardRowSilver
    : rank === 3 ? styles.leaderboardRowBronze
    : "";
  // Enforce 16-char display limit (existing users may have longer stored names)
  const displayName = entry.username.slice(0, 16);

  return (
    <motion.article
      className={`${styles.leaderboardRow} ${rankAccent} ${
        entry.isCurrentUser ? styles.leaderboardRowCurrentUser : ""
      } ${onClick ? styles.leaderboardRowClickable : ""}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.26,
        delay: Math.min((rank - 1) * 0.035, 0.18),
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <span className={styles.leaderboardRowRank}>#{rank}</span>
      <div className={styles.leaderboardAvatarWrap}>
        <WhelmProfileAvatar
          tierColor={bandana.tier?.color}
          size="mini"
          isPro={entry.isProStyle}
          photoUrl={entry.avatarUrl}
        />
      </div>
      <div className={styles.leaderboardRowIdentity}>
        <strong className={styles.leaderboardRowUsername}>{displayName}</strong>
        <div className={styles.leaderboardRowMeta}>
          {bandana.tier ? (
            <img
              src={bandanaCursorAssetPath(bandana.tier.color, 128)}
              alt={bandana.tier.label}
              className={styles.leaderboardBandanaImg}
              style={{ filter: `drop-shadow(0 0 5px ${bandanaImageGlow(bandana.tier.color)})` }}
            />
          ) : (
            <span className={styles.leaderboardBandanaChip}>None</span>
          )}
          {entry.isCurrentUser ? <span className={styles.leaderboardYouBadge}>You</span> : null}
          <LeaderboardMovementIndicator movement={movement} tab={tab} />
        </div>
      </div>
      <div className={styles.leaderboardRowStats}>
        {tab === "xp" ? (
          <>
            <span className={styles.leaderboardRowXp}>{formatLeaderboardXp(entry.totalXp)}</span>
            <span className={styles.leaderboardRowStreak}>{entry.currentStreak}d</span>
          </>
        ) : (
          <span className={styles.leaderboardRowStreakStat}>
            <span>{entry.currentStreak} days</span>
            {bandana.tier ? (
              <img
                src={bandanaCursorAssetPath(bandana.tier.color, 128)}
                alt={bandana.tier.label}
                className={styles.leaderboardBandanaImgStat}
                style={{ filter: `drop-shadow(0 0 4px ${bandanaImageGlow(bandana.tier.color)})` }}
              />
            ) : null}
          </span>
        )}
      </div>
    </motion.article>
  );
}

function LeaderboardPodiumCard({
  row,
  tab,
}: {
  row: { entry: LeaderboardEntry; rank: number; movement: LeaderboardMovement };
  tab: LeaderboardMetricTab;
}) {
  const bandana = getLeaderboardBandanaMeta(row.entry.currentStreak);
  const rowStyle = {
    "--leaderboard-accent": bandana.theme.accent,
    "--leaderboard-accent-strong": bandana.theme.accentStrong,
    "--leaderboard-accent-deep": bandana.theme.accentDeep,
    "--leaderboard-accent-glow": bandana.theme.accentGlow,
    "--leaderboard-shell": bandana.theme.shell,
    "--leaderboard-text-strong": bandana.theme.textStrong,
    "--leaderboard-text-soft": bandana.theme.textSoft,
  } as CSSProperties;

  return (
    <motion.article
      className={`${styles.leaderboardPodiumCard} ${
        row.entry.isCurrentUser ? styles.leaderboardPodiumCardCurrentUser : ""
      } ${row.rank === 1 ? styles.leaderboardPodiumCardFirst : ""}`}
      style={rowStyle}
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.38, delay: Math.min((row.rank - 1) * 0.06, 0.18), ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.leaderboardPodiumTopline}>
        <span className={styles.leaderboardPodiumPlace}>#{row.rank}</span>
        <LeaderboardMovementIndicator movement={row.movement} tab={tab} />
      </div>
      <div className={styles.leaderboardPodiumAvatar}>
        <WhelmProfileAvatar
          tierColor={bandana.tier?.color}
          size="row"
          isPro={row.entry.isProStyle}
          photoUrl={row.entry.avatarUrl}
        />
      </div>
      <div className={styles.leaderboardPodiumIdentity}>
        <strong>{row.entry.username}</strong>
        <span>{bandana.shortLabel}</span>
      </div>
      <div className={styles.leaderboardPodiumStats}>
        <div>
          <span>{tab === "xp" ? "XP" : "Streak"}</span>
          <strong>
            {tab === "xp" ? formatLeaderboardXp(row.entry.totalXp) : `${row.entry.currentStreak}d`}
          </strong>
        </div>
        <div>
          <span>Level</span>
          <strong>Lv {row.entry.level}</strong>
        </div>
      </div>
      {row.entry.isCurrentUser ? <span className={styles.leaderboardYouBadge}>You</span> : null}
    </motion.article>
  );
}

function resolveAgendaTimingState(
  dateKey: string,
  startMinute: number,
  endMinute: number,
  completed?: boolean,
): AgendaTimingState {
  if (completed) return "completed";
  const todayKey = dayKeyLocal(new Date());
  if (dateKey < todayKey) return "overdue";
  if (dateKey > todayKey) return "upcoming";
  const currentMinute = new Date().getHours() * 60 + new Date().getMinutes();
  if (currentMinute >= startMinute && currentMinute < endMinute) return "now";
  if (currentMinute < startMinute) return "next";
  return "overdue";
}

function mobileTabDescription(tab: AppTab) {
  switch (tab) {
    case "calendar":
      return "Plan blocks and read the day clearly.";
    case "leaderboard":
      return "Check rank, prestige, and movement.";
    case "reports":
      return "Read patterns, timing, and performance.";
    case "streaks":
      return "Protect the run and track milestones.";
    case "history":
      return "Review the record without guesswork.";
    case "mirror":
      return "Private reset and accountability space.";
    case "settings":
      return "Tune system behavior and account state.";
    default:
      return "Open the next lane.";
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

function dayToneStorageKey(uid: string) {
  return `whelm:day-tones:${uid}`;
}

function monthToneStorageKey(uid: string) {
  return `whelm:month-tones:${uid}`;
}

function streakMirrorStorageKey(uid: string) {
  return `whelm:streak-mirror:${uid}`;
}

function sickDaySaveStorageKey(uid: string) {
  return `whelm:sick-day-saves:${uid}`;
}

function sickDaySaveDismissalsStorageKey(uid: string) {
  return `whelm:sick-day-save-dismissals:${uid}`;
}

function dailyPlanningPromptSeenStorageKey(uid: string, dateKey: string) {
  return `whelm:daily-planning-prompt-seen:${uid}:${dateKey}`;
}

function readDailyPlanningPromptSeen(uid: string, dateKey: string) {
  try {
    return window.localStorage.getItem(dailyPlanningPromptSeenStorageKey(uid, dateKey)) === "1";
  } catch {
    return false;
  }
}

function markDailyPlanningPromptSeen(uid: string, dateKey: string) {
  window.localStorage.setItem(dailyPlanningPromptSeenStorageKey(uid, dateKey), "1");
}

function clearLocalAccountData(uid: string) {
  window.localStorage.removeItem(`whelm:notes:${uid}`);
  window.localStorage.removeItem(`whelm:sessions:${uid}`);
  window.localStorage.removeItem(plannedBlocksStorageKey(uid));
  window.localStorage.removeItem(`whelm:preferences:${uid}`);
  window.localStorage.removeItem(dayToneStorageKey(uid));
  window.localStorage.removeItem(monthToneStorageKey(uid));
  window.localStorage.removeItem(senseiStyleStorageKey(uid));
  window.localStorage.removeItem(streakMirrorStorageKey(uid));
  window.localStorage.removeItem(sickDaySaveStorageKey(uid));
  window.localStorage.removeItem(sickDaySaveDismissalsStorageKey(uid));
  window.localStorage.removeItem("whelm-pro-state-v1");
}

function loadDayTones(uid: string): DayToneMap {
  try {
    const raw = window.localStorage.getItem(dayToneStorageKey(uid));
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(
          ([dateKey, tone]) =>
            /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && Boolean(getCalendarToneMeta(tone as CalendarTone)),
        )
        .map(([dateKey, tone]) => [dateKey, tone as CalendarTone]),
    );
  } catch {
    return {};
  }
}

function saveDayTones(uid: string, tones: DayToneMap) {
  window.localStorage.setItem(dayToneStorageKey(uid), JSON.stringify(tones));
}

function loadMonthTones(uid: string): MonthToneMap {
  try {
    const raw = window.localStorage.getItem(monthToneStorageKey(uid));
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(
          ([monthKey, tone]) =>
            /^\d{4}-\d{2}$/.test(monthKey) && Boolean(getCalendarToneMeta(tone as CalendarTone)),
        )
        .map(([monthKey, tone]) => [monthKey, tone as CalendarTone]),
    );
  } catch {
    return {};
  }
}

function saveMonthTones(uid: string, tones: MonthToneMap) {
  window.localStorage.setItem(monthToneStorageKey(uid), JSON.stringify(tones));
}

function notesShellBackground(
  themeMode: ThemeMode,
  shellColor?: string,
  pageColor?: string,
  accent?: string,
  accentStrong?: string,
  glow?: string,
) {
  return {
    ["--note-surface-tint" as const]:
      shellColor ?? (themeMode === "dark" ? "#182038" : "#fff7d6"),
    ["--note-page-tone" as const]:
      pageColor ?? (themeMode === "dark" ? "#182038" : "#fffaf0"),
    ["--note-bandana-accent" as const]: accent ?? "#59c7ff",
    ["--note-bandana-accent-strong" as const]: accentStrong ?? "#2f86ff",
    ["--note-bandana-glow" as const]: glow ?? "rgba(84, 173, 255, 0.34)",
  } as CSSProperties;
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

function createDailyRitualDrafts(existing: PlannedBlock[]): DailyRitualBlockDraft[] {
  const seeded: DailyRitualBlockDraft[] = existing
    .slice(0, 3)
    .map((item, index) => ({
      id: `existing-${item.id}-${index}`,
      existingBlockId: item.id,
      title: item.title,
      note: item.note,
      tone: item.tone ?? null,
      timeOfDay: item.timeOfDay,
      durationMinutes: item.durationMinutes,
    }));

  while (seeded.length < 3) {
    const nextIndex = seeded.length;
    seeded.push({
      id: `new-${nextIndex}`,
      title: "",
      note: "",
      tone: null,
      timeOfDay: ["09:00", "13:00", "17:00"][nextIndex] || "09:00",
      durationMinutes: 30,
    });
  }

  return seeded;
}

function syncDailyRitualDrafts(
  existing: PlannedBlock[],
  current: DailyRitualBlockDraft[],
): DailyRitualBlockDraft[] {
  const synced: DailyRitualBlockDraft[] = existing
    .slice(0, 3)
    .map((item, index) => ({
      id: `existing-${item.id}-${index}`,
      existingBlockId: item.id,
      title: item.title,
      note: item.note,
      tone: item.tone ?? null,
      timeOfDay: item.timeOfDay,
      durationMinutes: item.durationMinutes,
    }));

  const openDrafts = current
    .filter((draft) => !draft.existingBlockId)
    .map((draft) => ({
      ...draft,
      id: draft.id.startsWith("new-") ? draft.id : `new-${draft.id}`,
    }));

  while (synced.length < 3 && openDrafts.length > 0) {
    const nextIndex = synced.length;
    const nextDraft = openDrafts.shift()!;
    synced.push({
      ...nextDraft,
      id: `new-${nextIndex}`,
    });
  }

  while (synced.length < 3) {
    const nextIndex = synced.length;
    synced.push({
      id: `new-${nextIndex}`,
      title: "",
      note: "",
      tone: null,
      timeOfDay: ["09:00", "13:00", "17:00"][nextIndex] || "09:00",
      durationMinutes: 30,
    });
  }

  return synced;
}

const DESKTOP_PRIMARY_TABS: Array<{ key: AppTab; label: string }> = [
  { key: "calendar", label: "Schedule" },
  { key: "today", label: "Today" },
  { key: "notes", label: "Notes+" },
  { key: "leaderboard", label: "Whelmboard" },
];

const MOBILE_PRIMARY_TABS: Array<{ key: AppTab; label: string }> = [
  { key: "calendar", label: "Schedule" },
  { key: "today", label: "Today" },
  { key: "notes", label: "Notes+" },
  { key: "leaderboard", label: "Whelmboard" },
];

const MOBILE_MORE_TABS: AppTab[] = [
  "mirror",
  "streaks",
  "history",
  "reports",
  "settings",
];

const INTRO_SPLASH_MIN_MS = 1500;
const INTRO_SPLASH_MAX_MS = 2200;
function StreakBandana({
  streakDays,
  className,
}: {
  streakDays: number;
  className?: string;
}) {
  "use no memo";

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

function DailyRitualSubmitBandana({
  className,
  streakDays,
}: {
  className?: string;
  streakDays: number;
}) {
  return (
    <div className={[styles.dailyRitualSubmitBandanaWrap, className].filter(Boolean).join(" ")} aria-hidden="true">
      <StreakBandana streakDays={streakDays} className={styles.dailyRitualSubmitBandanaCanvas} />
    </div>
  );
}

function XpBandanaLevelMark({
  className,
  tierColor,
  level,
}: {
  className?: string;
  tierColor: string | null | undefined;
  level: number;
}) {
  "use no memo";

  const { RiveComponent } = useRive({
    src: getStreakBandanaAssetPath(tierColor),
    autoplay: true,
  });

  return (
    <div className={[styles.xpBandanaLevelMark, className].filter(Boolean).join(" ")} aria-hidden="true">
      <RiveComponent className={styles.xpBandanaLevelCanvas} />
      <span className={styles.xpBandanaLevelValue}>{level}</span>
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
  bandanaColor = "yellow",
  compact = false,
  emoteVideoSrc,
  autoPlayEmote = false,
}: {
  message: string;
  variant: SenseiVariant;
  bandanaColor?: import("@/lib/whelm-mascot").WhelBandanaColor;
  compact?: boolean;
  emoteVideoSrc?: string;
  autoPlayEmote?: boolean;
}) {
  return (
    <SenseiFigure
      variant={variant}
      bandanaColor={bandanaColor}
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
  bandanaColor = "yellow",
}: {
  eyebrow: string;
  title: string;
  body: string;
  variant: SenseiVariant;
  bandanaColor?: import("@/lib/whelm-mascot").WhelBandanaColor;
}) {
  return (
    <article className={styles.companionPulse}>
      <div className={styles.companionPulseFigureWrap}>
        <SenseiFigure variant={variant} bandanaColor={bandanaColor} size="badge" className={styles.companionPulseFigure} />
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

function ProUnlockCard({
  title,
  body,
  open,
  onToggle,
  onPreview,
  preview,
}: {
  title: string;
  body: string;
  open: boolean;
  onToggle: () => void;
  onPreview: () => void;
  preview?: ReactNode;
}) {
  return (
    <div className={styles.proUnlockCard}>
      <button type="button" className={styles.proUnlockToggle} onClick={onToggle}>
        <div>
          <p className={styles.sectionLabel}>Whelm Pro Available</p>
          <strong>{title}</strong>
          <p className={styles.proUnlockMeta}>Premium surface, deeper system.</p>
        </div>
        <span>{open ? "Hide" : "Open"}</span>
      </button>
      {open ? (
        <div className={styles.proUnlockBody}>
          {preview ? <div className={styles.proUnlockPreview}>{preview}</div> : null}
          <p className={styles.accountMeta}>{body}</p>
          <div className={styles.proUnlockValueRow}>
            <span>Sharper visuals</span>
            <span>Deeper memory</span>
            <span>Full command reports</span>
          </div>
          <div className={styles.noteFooterActions}>
            <button type="button" className={styles.inlineUpgrade} onClick={onPreview}>
              Enter Whelm Pro Preview
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SessionRewardToast({
  reward,
  onDismiss,
}: {
  reward: SessionRewardState;
  onDismiss: () => void;
}) {
  const tierTheme = getStreakTierColorTheme(reward.tierUnlocked?.color);
  const rewardStyle = {
    "--reward-accent": tierTheme.accent,
    "--reward-accent-strong": tierTheme.accentStrong,
    "--reward-accent-glow": tierTheme.accentGlow,
  } as CSSProperties;

  return (
    <motion.div
      className={styles.sessionRewardToast}
      style={rewardStyle}
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.98 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
    >
      <button type="button" className={styles.sessionRewardClose} onClick={onDismiss} aria-label="Dismiss reward">
        ×
      </button>
      <div className={styles.sessionRewardTop}>
        <div>
          <p className={styles.sectionLabel}>Session complete</p>
          <h3 className={styles.sessionRewardTitle}>+{reward.xpGained} XP secured</h3>
          <p className={styles.sessionRewardBody}>
            {reward.minutesSpent} minutes banked. Today now holds {reward.todayXp} XP.
          </p>
        </div>
        <div className={styles.sessionRewardBadge}>
          <span>{reward.minutesSpent}m</span>
        </div>
      </div>
      <div className={styles.sessionRewardStats}>
        <div className={styles.sessionRewardStat}>
          <span>Streak</span>
          <strong>
            {reward.streakAfter}d
            {reward.streakDelta > 0 ? ` · +${reward.streakDelta}` : ""}
          </strong>
        </div>
        <div className={styles.sessionRewardStat}>
          <span>Level</span>
          <strong>{reward.leveledUp ? "Level up" : "Progress"}</strong>
        </div>
        <div className={styles.sessionRewardStat}>
          <span>Tier</span>
          <strong>{reward.tierUnlocked?.label ?? "Holding line"}</strong>
        </div>
      </div>
    </motion.div>
  );
}

function StreakCelebrationToast({
  celebration,
  onDismiss,
}: {
  celebration: StreakCelebrationState;
  onDismiss: () => void;
}) {
  const tierTheme = getStreakTierColorTheme(celebration.tier?.color);
  const rewardStyle = {
    "--reward-accent": tierTheme.accent,
    "--reward-accent-strong": tierTheme.accentStrong,
    "--reward-accent-glow": tierTheme.accentGlow,
  } as CSSProperties;

  return (
    <motion.div
      className={`${styles.sessionRewardToast} ${styles.streakCelebrationToast}`}
      style={rewardStyle}
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.98 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        className={styles.sessionRewardClose}
        onClick={onDismiss}
        aria-label="Dismiss streak celebration"
      >
        ×
      </button>
      <div className={styles.sessionRewardTop}>
        <div>
          <p className={styles.sectionLabel}>Streak secured</p>
          <h3 className={styles.sessionRewardTitle}>Congratulations. {celebration.todayLabel} is protected.</h3>
          <p className={styles.sessionRewardBody}>
            That last point pushed you over the line. Your streak now holds at {celebration.streakAfter} day
            {celebration.streakAfter === 1 ? "" : "s"}.
          </p>
        </div>
        <div className={styles.sessionRewardBadge}>
          <span>{celebration.streakAfter}d</span>
        </div>
      </div>
      <div className={styles.sessionRewardStats}>
        <div className={styles.sessionRewardStat}>
          <span>Today</span>
          <strong>Protected</strong>
        </div>
        <div className={styles.sessionRewardStat}>
          <span>Streak</span>
          <strong>{celebration.streakAfter} day line</strong>
        </div>
        <div className={styles.sessionRewardStat}>
          <span>Tier</span>
          <strong>{celebration.tier?.label ?? "Holding line"}</strong>
        </div>
      </div>
    </motion.div>
  );
}

function StreakNudgeToast({
  nudge,
  onDismiss,
  onAction,
}: {
  nudge: StreakNudgeState;
  onDismiss: () => void;
  onAction: (tab: AppTab) => void;
}) {
  return (
    <motion.div
      className={styles.streakNudgeToast}
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <button type="button" className={styles.sessionRewardClose} onClick={onDismiss} aria-label="Dismiss streak nudge">
        ×
      </button>
      <p className={styles.sectionLabel}>Streak at risk</p>
      <h3 className={styles.streakNudgeTitle}>{nudge.title}</h3>
      <p className={styles.streakNudgeBody}>{nudge.body}</p>
      <div className={styles.noteFooterActions}>
        <button
          type="button"
          className={styles.reportButton}
          onClick={() => onAction(nudge.actionTab)}
        >
          {nudge.actionLabel}
        </button>
        <button type="button" className={styles.secondaryPlanButton} onClick={onDismiss}>
          Later
        </button>
      </div>
    </motion.div>
  );
}

function NoteAttachmentsSection({
  note,
  pendingUploads,
  uploadBusy,
  uploadStatus,
  onAttach,
  onOpen,
  onRemove,
}: {
  note: WorkspaceNote;
  pendingUploads: PendingNoteAttachment[];
  uploadBusy: boolean;
  uploadStatus: string;
  onAttach: () => void;
  onOpen: (attachment: NoteAttachment) => void;
  onRemove: (attachment: NoteAttachment) => void;
}) {
  const hasAttachments = note.attachments.length > 0;
  const hasPendingUploads = pendingUploads.length > 0;

  return (
    <section className={styles.noteAttachmentsSection}>
      <div className={styles.noteAttachmentsHeader}>
        <div className={styles.noteAttachmentsSummary}>
          <p className={styles.noteAttachmentsEyebrow}>Files</p>
          <strong className={styles.noteAttachmentsTitle}>
            {hasAttachments
              ? `${note.attachments.length} attached`
              : "Keep files with this note"}
          </strong>
        </div>
        <button
          type="button"
          className={styles.noteAttachmentAddButton}
          onClick={onAttach}
          disabled={uploadBusy}
        >
          {uploadBusy ? "Adding..." : "Add file"}
        </button>
      </div>
      {uploadStatus ? <p className={styles.noteAttachmentStatus}>{uploadStatus}</p> : null}
      {hasPendingUploads ? (
        <div className={styles.noteAttachmentsRail}>
          {pendingUploads.map((attachment) => (
            <article key={attachment.id} className={styles.noteAttachmentPendingCard}>
              <div className={styles.noteAttachmentPendingTop}>
                <span className={styles.noteAttachmentGlyph}>{noteAttachmentGlyph(attachment)}</span>
                <span className={styles.noteAttachmentBadge}>Uploading</span>
              </div>
              <strong className={styles.noteAttachmentName}>{attachment.name}</strong>
              <div className={styles.noteAttachmentProgressTrack}>
                <span
                  className={styles.noteAttachmentProgressFill}
                  style={{ width: `${Math.max(6, attachment.progress)}%` }}
                />
              </div>
              <span className={styles.noteAttachmentInfo}>{Math.round(attachment.progress)}%</span>
            </article>
          ))}
        </div>
      ) : null}
      {hasAttachments ? (
        <div className={styles.noteAttachmentsRail}>
          {note.attachments.map((attachment) => (
            <article
              key={attachment.id}
              className={`${styles.noteAttachmentCard} ${
                attachment.kind === "image" ? styles.noteAttachmentCardImage : ""
              }`}
            >
              {attachment.kind === "image" ? (
                <button
                  type="button"
                  className={styles.noteAttachmentPreviewButton}
                  onClick={() => onOpen(attachment)}
                >
                  <img
                    src={attachment.downloadUrl}
                    alt={attachment.name}
                    className={styles.noteAttachmentPreviewImage}
                  />
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.noteAttachmentFileFace}
                  onClick={() => onOpen(attachment)}
                >
                  <span className={styles.noteAttachmentGlyph}>{noteAttachmentGlyph(attachment)}</span>
                  <span className={styles.noteAttachmentBadge}>{noteAttachmentBadgeLabel(attachment)}</span>
                </button>
              )}
              <div className={styles.noteAttachmentMeta}>
                <strong className={styles.noteAttachmentName}>{attachment.name}</strong>
                <span className={styles.noteAttachmentInfo}>
                  {noteAttachmentBadgeLabel(attachment)} · {formatAttachmentSize(attachment.sizeBytes)}
                </span>
              </div>
              <div className={styles.noteAttachmentActions}>
                <button
                  type="button"
                  className={styles.noteAttachmentOpenButton}
                  onClick={() => onOpen(attachment)}
                >
                  Open
                </button>
                <button
                  type="button"
                  className={styles.noteAttachmentRemoveButton}
                  onClick={() => onRemove(attachment)}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <span className={styles.noteAttachmentsEmpty}>
          <span className={styles.noteAttachmentEmptyGlyph}>＋</span>
          <p>No files attached</p>
        </span>
      )}
    </section>
  );
}

export default function HomePage() {
  "use no memo";

  const router = useRouter();
  const liveTodayKey = dayKeyLocal(new Date());

  const [showIntroSplash, setShowIntroSplash] = useState(true);
  const [introFinished, setIntroFinished] = useState(false);
  const [introMinElapsed, setIntroMinElapsed] = useState(false);
  const [landingWisdomMinute, setLandingWisdomMinute] = useState(() => Math.floor(Date.now() / 60000));
  const [mobileTodayOverviewOpen, setMobileTodayOverviewOpen] = useState(false);
  const [senseiReaction, setSenseiReaction] = useState("");
  const [trendRange, setTrendRange] = useState<TrendRange>(7);
  const [activeTab, setActiveTab] = useState<AppTab>("calendar");
  const [selectedLbProfile, setSelectedLbProfile] = useState<{ entry: LeaderboardEntry; rank: number } | null>(null);
  const [insightMetric, setInsightMetric] = useState<InsightMetric>("focus");
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [dayTones, setDayTones] = useState<DayToneMap>({});
  const [monthTones, setMonthTones] = useState<MonthToneMap>({});
  const { toasts: whelToasts, showToast, dismissToast } = useToasts();
  const [historySectionsOpen, setHistorySectionsOpen] = useState({
    completed: false,
    incomplete: false,
  });
  const [historyGroupsOpen, setHistoryGroupsOpen] = useState<Record<string, boolean>>({});
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [streakRulesOpen, setStreakRulesOpen] = useState(false);
  const [settingsSectionsOpen, setSettingsSectionsOpen] = useState({
    identity: false,
    internalTools: false,
    protocol: false,
    appearance: false,
    background: false,
    sync: false,
    screenTime: false,
    danger: false,
  });
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
    proPanelsOpen,
    setProPanelsOpen,
    screenTimeStatus,
    screenTimeSupported,
    screenTimeReason,
    screenTimeBusy,
    deletingAccount,
    accountDangerStatus,
    submitFeedback,
    handleRestoreFreeTier,
    handleStartProPreview,
    handleRequestScreenTimeAuth,
    handleOpenScreenTimeSettings,
    handleDeleteAccount,
    openUpgradeFlow,
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
    planTitle,
    setPlanTitle,
    planNote,
    setPlanNote,
    planAttachmentCount,
    setPlanAttachmentCount,
    planNoteExpanded,
    setPlanNoteExpanded,
    planTone,
    setPlanTone,
    planDuration,
    setPlanDuration,
    planTime,
    setPlanTime,
    planStatus,
    setPlanStatus,
    planConflictWarning,
    setPlanConflictWarning,
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
    dayPortalComposerOpen,
    setDayPortalComposerOpen,
    selectedPlanDetailId,
    setSelectedPlanDetailId,
    plannerSectionsOpen,
    setPlannerSectionsOpen,
    deletedPlanUndo,
    dailyPlanningPreviewOpen,
    setDailyPlanningPreviewOpen,
    mobileBlockSheetOpen,
    setMobileBlockSheetOpen,
    selectedDateKey,
    selectedDateCanAddBlocks,
    selectedDatePlans,
    handleBlocksSnapshot,
    handleUserSignedOut: handlePlannedBlocksSignedOut,
    persistPlannedBlocks,
    selectCalendarDate,
    jumpToToday,
    openCalendarBlockComposer,
    openPrefilledBlockComposer,
    closeDailyPlanningPreview,
    addPlannedBlock,
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
    handleUserSignedIn,
    handleUserSignedOut,
    createWorkspaceNote,
    updateSelectedNote,
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
  const onSignOut = useCallback(() => {
    handlePlannedBlocksSignedOut();
    handleUserSignedOut();
  }, [handlePlannedBlocksSignedOut, handleUserSignedOut]);

  const {
    user,
    authChecked,
    setAuthChecked,
    sessionsSyncedRef,
    sessions,
    setSessions,
    sessionMinutesByDay,
    streakQualifiedDateKeys,
    streak,
    bandanaColor,
    mascot,
    showMascot,
    dismissMascot,
    xpByDay,
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
    onSignIn: handleUserSignedIn,
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
    effectiveBackgroundSetting,
    backgroundSkinActive,
    setThemePromptOpen,
    applyPreferencesSnapshot,
    applyThemeMode,
    applyBackgroundSetting,
    applyCompanionStyle,
    updateBackgroundSkin,
    handleBackgroundUpload,
  } = usePreferences({
    user,
    isPro,
    defaultBackgroundSkin: DEFAULT_BACKGROUND_SKIN,
  });

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
  } = useStreak({
    streak,
    streakQualifiedDateKeys,
    sessionMinutesByDay,
    noteWordsByDay,
    completedBlocksByDay,
    sickDaySaves,
    sickDaySaveDismissals,
    lifetimeXpSummary,
  });

  useEffect(() => {
    if (!pendingXpPop) return;
    triggerXPPop(pendingXpPop.amount);
    clearPendingXpPop();
  }, [clearPendingXpPop, pendingXpPop, triggerXPPop]);

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
    let monthMinutes = 0;
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

      if (sessionDate >= monthStart && sessionDate <= now) {
        monthMinutes += session.minutes;
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
      monthMinutes,
      activeDaysInMonth,
      disciplineScore,
      calendar,
      monthCalendar,
      trendPoints7: buildTrendPoints(7),
      trendPoints30: buildTrendPoints(30),
      trendPoints90: buildTrendPoints(90),
    };
  }, [sessions, streak]);

  const trendPoints = useMemo(() => {
    if (trendRange === 30) return focusMetrics.trendPoints30;
    if (trendRange === 90) return focusMetrics.trendPoints90;
    return focusMetrics.trendPoints7;
  }, [focusMetrics, trendRange]);

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
  const freeSessionHistoryGroups = useMemo<SessionHistoryMonthGroup[]>(() => {
    return sessionHistoryGroups
      .map((monthGroup) => {
        const weeks = monthGroup.weeks
          .map((weekGroup) => {
            const days = weekGroup.days.filter((dayGroup) =>
              isDateKeyWithinRecentWindow(dayGroup.key.replace(/^day-/, ""), PRO_HISTORY_FREE_DAYS),
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
  }, [sessionHistoryGroups]);
  const hasLockedHistoryDays = useMemo(() => {
    const totalDays = sessionHistoryGroups.reduce(
      (sum, monthGroup) =>
        sum +
        monthGroup.weeks.reduce(
          (weekSum, weekGroup) =>
            weekSum +
            weekGroup.days.filter(
              (dayGroup) =>
                !isDateKeyWithinRecentWindow(dayGroup.key.replace(/^day-/, ""), PRO_HISTORY_FREE_DAYS),
            ).length,
          0,
        ),
      0,
    );
    return totalDays > 0;
  }, [sessionHistoryGroups]);

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
    activeTab,
    focusMetrics,
    notes,
    sessions,
    trendPoints,
    streak,
    setSenseiReaction,
  });

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
  const senseiActiveTab =
    activeTab === "streaks" || activeTab === "leaderboard"
      ? "reports"
      : activeTab === "mirror"
        ? "notes"
        : activeTab;

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
    if (!user) return;
    setDayTones(loadDayTones(user.uid));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setMonthTones(loadMonthTones(user.uid));
  }, [user]);

  useEffect(() => {
    function onOnline() {
      if (!user || notes.length === 0) return;
      void handleRetrySync();
    }

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [notes, user]);

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
      }
    }

    function onPageHide() {
      void flushSelectedNoteDraft();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    if (!user) {
      return () => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("pagehide", onPageHide);
      };
    }

    const unsub = subscribeToUserData(user.uid, {
      onNotes: (notes) => {
        setNotes(notes);
        setSelectedNoteId((current) => current ?? notes[0]?.id ?? null);
        setNotesSyncStatus("synced");
        setNotesSyncMessage("");
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
        });
      },
      onReflection: handleReflectionSnapshot,
      onSessions: (sessions) => {
        if (sessionsSyncedRef.current) {
          setSessions(sessions);
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
    };
  }, [handleReflectionSnapshot, user]);

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

  function openTimeBlockFlow(dateKey: string) {
    const nextDateKey = normalizePlannableDateKey(dateKey);
    setSelectedCalendarDate(nextDateKey);
    setActiveTab("calendar");
    setCalendarView("day");
    setMobileBlockSheetOpen(true);
    setDayPortalComposerOpen(true);
    setPlanAttachmentCount(0);
    if (nextDateKey !== dateKey) {
      showToast("Past dates stay read-only. Add the block to today or a future day.", "warning");
    }
    setPlanConflictWarning(null);
  }

  function openSickDaySaveReview() {
    dismissSickDaySavePrompt();
    if (sickDaySaveEligible) {
      openStreakSaveQuestionnaire();
      return;
    }
    setActiveTab("mirror");
  }

  function openDailyPlanningPreview() {
    setDailyPlanningStatus("");
    setDailyPlanningPreviewOpen(true);
    setDailyPlanningOpen(true);
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

  function convertNoteToPlannedBlock(note: WorkspaceNote) {
    const reminderDate = note.reminderAtISO ? new Date(note.reminderAtISO) : null;
    const rawDateKey = reminderDate ? dayKeyLocal(reminderDate) : selectedDateKey;
    const dateKey = normalizePlannableDateKey(rawDateKey);
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
      attachmentCount: note.attachments.length,
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
  const selectedDatePlanGroups = useMemo(() => {
    const sameDate = plannedBlocks
      .filter(
        (item) =>
          item.dateKey === selectedDateKey &&
          (isPro || isDateKeyWithinRecentWindow(item.dateKey, PRO_HISTORY_FREE_DAYS)),
      )
      .sort((a, b) => a.sortOrder - b.sortOrder || a.timeOfDay.localeCompare(b.timeOfDay));
    return {
      active: sameDate.filter((item) => item.status === "active" && !isDateKeyBeforeToday(item.dateKey)),
      completed: sameDate.filter((item) => item.status === "completed"),
      incomplete: sameDate.filter((item) => item.status === "active" && isDateKeyBeforeToday(item.dateKey)),
      visible: sameDate,
    };
  }, [isPro, plannedBlocks, selectedDateKey]);
  const selectedDateDayTone = isPro ? (dayTones[selectedDateKey] ?? null) : null;
  const visiblePlanTone = (tone: CalendarTone | null | undefined) => (isPro ? (tone ?? null) : null);
  const plannedBlockById = useMemo(
    () => new Map(plannedBlocks.map((item) => [item.id, item])),
    [plannedBlocks],
  );
  const plannedBlockHistory = useMemo(() => {
    const sorted = [...plannedBlocks]
      .filter((item) => isPro || isDateKeyWithinRecentWindow(item.dateKey, PRO_HISTORY_FREE_DAYS))
      .sort((a, b) => {
        if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);
        return a.timeOfDay.localeCompare(b.timeOfDay);
      });
    return {
      completed: sorted.filter((item) => item.status === "completed"),
      incomplete: sorted.filter((item) => item.status === "active" && isDateKeyBeforeToday(item.dateKey)),
    };
  }, [isPro, plannedBlocks]);
  const hasLockedBlockHistory = useMemo(
    () =>
      !isPro &&
      plannedBlocks.some(
        (item) => !isDateKeyWithinRecentWindow(item.dateKey, PRO_HISTORY_FREE_DAYS),
      ),
    [isPro, plannedBlocks],
  );
  const calendarEntriesByDate = useMemo(() => {
    const entries = new Map<string, CalendarEntry[]>();

    function pushEntry(dateKey: string, entry: CalendarEntry) {
      const list = entries.get(dateKey) ?? [];
      list.push(entry);
      entries.set(dateKey, list);
    }

    plannedBlocks.forEach((item) => {
      if (!isPro && !isDateKeyWithinRecentWindow(item.dateKey, PRO_HISTORY_FREE_DAYS)) return;
      // Active past-date blocks are shown as overdue — do not filter them out
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
            ? `Completed block: ${item.title} (${item.durationMinutes} minutes) at ${normalizeTimeLabel(
                item.timeOfDay,
              )}.`
            : `Planned block: ${item.title} (${item.durationMinutes} minutes) at ${normalizeTimeLabel(
                item.timeOfDay,
              )}.`,
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
      if (!isPro && !isDateKeyWithinRecentWindow(dateKey, PRO_HISTORY_FREE_DAYS)) return;
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
  }, [isPro, notes, plannedBlocks, sessions]);
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

    // Compute overlapIds first
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

    // Assign columns for side-by-side overlap layout
    const colMap = new Map<string, number>();
    const totalColsMap = new Map<string, number>();
    // Sort by startMinute so earlier blocks get lower columns
    const sorted = [...itemsWithOverlaps].sort(
      (a, b) => a.startMinute - b.startMinute || a.id.localeCompare(b.id),
    );
    sorted.forEach((item) => {
      const usedCols = new Set(
        item.overlapIds
          .map((id) => colMap.get(id))
          .filter((c): c is number => c !== undefined),
      );
      let col = 0;
      while (usedCols.has(col)) col++;
      colMap.set(item.id, col);
    });
    // totalCols per item = max col among itself + all overlapping items + 1
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
  const calendarEntryById = useMemo(() => {
    const byId = new Map<string, CalendarEntry>();
    calendarEntriesByDate.forEach((items) => {
      items.forEach((entry) => byId.set(entry.id, entry));
    });
    return byId;
  }, [calendarEntriesByDate]);
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
    setPlanConflictWarning,
    planDuration,
    planTime,
    planTitle,
    planNote,
    openCalendarBlockComposer,
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

  useEffect(() => {
    if (!authChecked || user) return;

    router.replace("/login");

    const timeoutId = window.setTimeout(() => {
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [authChecked, router, user]);

  const lastSession = sessions[0];
  const latestNote = orderedNotes[0] ?? null;
  const nextPlannedBlock = todayActivePlannedBlocks[0] ?? null;
  const mobileMoreActive = MOBILE_MORE_TABS.includes(activeTab);
  const recentNotes = filteredNotes.slice(0, 4);
  const todayLabel = new Date().toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
  const todaySessionNoteCount = sessions.filter((session) => {
    return dayKeyLocal(session.completedAtISO) === todayKey && Boolean(session.note?.trim());
  }).length;
  const profileTierTheme = getProfileTierTheme(streakBandanaTier?.color, isPro);
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
  });
  const selectedDateAgendaStateSummary = useMemo(() => {
    const plans = selectedDateEntries.filter((entry) => entry.source === "plan");
    const activeNow = plans.find(
      (entry) => resolveAgendaTimingState(selectedDateKey, entry.startMinute, entry.endMinute, entry.isCompleted) === "now",
    );
    const nextUp = plans.find(
      (entry) => resolveAgendaTimingState(selectedDateKey, entry.startMinute, entry.endMinute, entry.isCompleted) === "next",
    );
    const overdueCount = plans.filter(
      (entry) => resolveAgendaTimingState(selectedDateKey, entry.startMinute, entry.endMinute, entry.isCompleted) === "overdue",
    ).length;

    return {
      activeNow,
      nextUp,
      overdueCount,
      reminderCount: selectedDateEntries.filter((entry) => entry.source === "reminder").length,
      focusMinutes: selectedDateFocusedMinutes,
    };
  }, [selectedDateEntries, selectedDateFocusedMinutes, selectedDateKey]);

  const lifetimeFocusMinutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
  const notificationsBlocked = dailyPlanningLocked || dailyPlanningOpen || dailyPlanningPreviewOpen;
  const previousStreakProtectedTodayRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (streakProtectedToday) {
      setStreakNudge(null);
    }
  }, [streakProtectedToday]);

  useEffect(() => {
    if (!notificationsBlocked) return;
    setStreakNudge(null);
    setSessionReward(null);
    setStreakCelebration(null);
  }, [notificationsBlocked]);

  useEffect(() => {
    if (!authChecked || !user) {
      previousStreakProtectedTodayRef.current = streakProtectedToday;
      return;
    }

    const previousProtected = previousStreakProtectedTodayRef.current;
    previousStreakProtectedTodayRef.current = streakProtectedToday;

    if (previousProtected === null) return;
    if (notificationsBlocked || !streakRuleV2ActiveToday) return;
    if (previousProtected || !streakProtectedToday) return;

    setStreakCelebration({
      id: `${todayKey}-${Date.now()}`,
      streakAfter: displayStreak,
      todayLabel,
      tier: getStreakBandanaTier(displayStreak),
    });
  }, [
    authChecked,
    displayStreak,
    notificationsBlocked,
    streakProtectedToday,
    streakRuleV2ActiveToday,
    todayKey,
    todayLabel,
    user,
  ]);

  useEffect(() => {
    if (notificationsBlocked) return;
    if (!user || !authChecked || !plannedBlocksHydrated || !streakNudgeDraft) return;
    if (streakNudge) return;

    const now = new Date();
    const hour = now.getHours();
    const slot = hour >= 19 ? "evening" : hour >= 13 ? "midday" : hour >= 9 ? "morning" : null;
    if (!slot) return;

    const seen = readStreakNudgeSeen(user.uid, todayKey);
    if (seen.has(slot)) return;

    setStreakNudge({
      id: `${todayKey}-${slot}`,
      ...streakNudgeDraft,
    });
    markStreakNudgeSeen(user.uid, todayKey, slot);
  }, [
    authChecked,
    landingWisdomMinute,
    notificationsBlocked,
    plannedBlocksHydrated,
    streakNudge,
    streakNudgeDraft,
    todayKey,
    user,
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

  function handleStreakNudgeAction(tab: AppTab) {
    setStreakNudge(null);
    setActiveTab(tab);
    if (tab === "today") {
      window.setTimeout(() => scrollToSection(todayTimerRef.current ?? todaySectionRef.current), 80);
      return;
    }
    if (tab === "notes") {
      window.setTimeout(() => scrollToSection(notesEditorRef.current ?? notesSectionRef.current), 80);
      return;
    }
    if (tab === "calendar") {
      setCalendarView("day");
      setSelectedCalendarDate(todayKey);
      window.setTimeout(() => scrollToSection(calendarTimelineRef.current ?? calendarSectionRef.current), 80);
    }
  }

  const maxTrendMinutes = Math.max(30, ...trendPoints.map((point) => point.minutes));
  const trendPath = trendPoints
    .map((point, index) => {
      const x = (index / Math.max(1, trendPoints.length - 1)) * 100;
      const y = 100 - (point.minutes / maxTrendMinutes) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  const streakHeroEmoteId: WhelmEmoteId =
    streak >= 100 ? "whelm.proud" : streak >= 50 ? "whelm.ready" : "whelm.encourage";
  const pageShellBackgroundStyle = getPageShellBackgroundStyle(
    resolvedTheme,
    effectiveBackgroundSetting,
    backgroundSkin,
  );
  const pageShellStyle = {
    ...pageShellBackgroundStyle,
    ...(backgroundSkinActive
      ? {
          ["--glass-surface-opacity" as const]: String(backgroundSkin.surfaceOpacity),
          ["--glass-surface-opacity-strong" as const]: String(
            Math.min(0.99, backgroundSkin.surfaceOpacity + 0.08),
          ),
          ["--glass-blur" as const]: `${backgroundSkin.blur}px`,
          ["--glass-border-alpha" as const]: themeMode === "light" ? "0.18" : "0.24",
          ["--glass-highlight-alpha" as const]: themeMode === "light" ? "0.5" : "0.08",
          ["--glass-shadow-alpha" as const]: themeMode === "light" ? "0.16" : "0.34",
        }
      : {}),
  } as CSSProperties;

  function handleCardsXPEarned(amount: number) {
    if (amount <= 0) return;
    showMascot("cards_session_done");
    triggerXPPop(amount);
    // TODO: reconcile cards-earned XP with the derived xpByDay/lifetimeXpSummary flow before mutating parent XP state.
  }

  return (
    <>
      <main
        className={`${styles.pageShell} ${
          resolvedTheme === "light" ? styles.themeLight : styles.themeDark
        } ${backgroundSkinActive ? styles.pageShellGlass : ""}`}
        style={pageShellStyle}
      >
      <div className={styles.pageFrame}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>WHELM</p>
            <h1 className={styles.title}>Enter Whelm Flow.</h1>
            <p className={styles.subtitle}>
              {WHELM_BRAND_THESIS} Plan the line, protect the streak, and keep the day under command.
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
              onClick={() => handleTabSelect(tab.key)}
            >
              <span className={styles.tabIcon}>{iconForTab(tab.key)}</span>
              <span>{tab.label}</span>
            </button>
          ))}
          <button
            type="button"
            className={`${styles.tabButton} ${mobileMoreActive || mobileMoreOpen ? styles.tabButtonActive : ""}`}
            onClick={() => handleTabSelect("more")}
          >
            <span className={styles.tabIcon}>{iconForNavKey("more")}</span>
            <span>More</span>
          </button>
        </nav>

        <section className={styles.screen}>
          <TopAppBar
            activeTab={activeTab}
            xpDockStyle={xpDockStyle}
            currentLevel={lifetimeXpSummary.currentLevel}
            progressToNextLevel={lifetimeXpSummary.progressToNextLevel}
            formattedLifetimeXp={formattedLifetimeXp}
            formattedXpToNextLevel={formattedXpToNextLevel}
            tierColor={streakBandanaTier?.color}
            isPro={isPro}
            photoUrl={currentUserPhotoUrl}
            isMobileViewport={isMobileViewport}
            profileDisplayName={profileDisplayName}
            onProfileOpen={() => setProfileOpen(true)}
            onMoreOpen={() => setMobileMoreOpen(true)}
          />

          {activeTab === "today" && (
            <TodayTab
              todaySectionRef={todaySectionRef}
              todayTimerRef={todayTimerRef}
              todaySummaryRef={todaySummaryRef}
              isMobileViewport={isMobileViewport}
              isPro={isPro}
              resolvedTheme={resolvedTheme}
              todaySessionNoteCount={todaySessionNoteCount}
              focusMetrics={{
                disciplineScore: focusMetrics.disciplineScore,
                todayMinutes: focusMetrics.todayMinutes,
                todaySessions: focusMetrics.todaySessions,
                weekMinutes: focusMetrics.weekMinutes,
              }}
              streak={streak}
              mobileTodayOverviewOpen={mobileTodayOverviewOpen}
              nextPlannedBlock={nextPlannedBlock}
              dueReminderNotes={dueReminderNotes}
              lastSession={lastSession}
              lastSessionHoursAgo={lastSessionHoursAgo}
              latestNote={latestNote}
              orderedNotes={orderedNotes}
              todayActivePlannedBlocksCount={todayActivePlannedBlocks.length}
              senseiGuidance={{
                tone: senseiGuidance.tone,
                ritual: senseiGuidance.ritual,
                voiceMode: senseiGuidance.voiceMode,
                actionLabel: senseiGuidance.actionLabel,
                actionTab: senseiGuidance.actionTab,
              }}
              todayHeroCopy={{
                eyebrow: todayHeroCopy.eyebrow,
                title: todayHeroCopy.title,
                body: todayHeroCopy.body,
                signatureLine: todayHeroCopy.signatureLine,
              }}
              companionStageLabel={companionState.stage}
              nextSenseiMilestone={nextSenseiMilestone}
              senseiReaction={senseiReaction}
              bandanaColor={bandanaColor}
              reportCopyStatus={reportCopyStatus}
              onOpenSessionNotes={() => setActiveTab("history")}
              onSessionStart={handleSessionStarted}
              onSessionAbandon={handleSessionAbandoned}
              onSessionComplete={(note, minutesSpent, sessionContext) =>
                void completeSession(note, minutesSpent, sessionContext)
              }
              onToggleMobileTodayOverview={() => setMobileTodayOverviewOpen((open) => !open)}
              onTodayPrimaryAction={handleTodayPrimaryAction}
              onSetSelectedNoteId={setSelectedNoteId}
              onOpenNotesTab={openNotesTab}
              onCreateWorkspaceNote={() => void createWorkspaceNote()}
              onCopyWeeklyReport={() => void copyWeeklyReport()}
              onUpgrade={openUpgradeFlow}
              senseiActionTabTitle={tabTitle(senseiGuidance.actionTab as AppTab)}
              userEmail={user.email ?? ""}
            />
          )}

          {activeTab === "calendar" && (
            <ScheduleTab
              sectionRef={calendarSectionRef}
              calendarMonthRef={calendarMonthRef}
              calendarPlannerRef={calendarPlannerRef}
              calendarHeroRef={calendarHeroRef}
              calendarTimelineRef={calendarTimelineRef}
              mobileDayTimelineScrollRef={mobileDayTimelineScrollRef}
              calendarView={calendarView}
              calendarMonthLabel={calendarMonthLabel}
              calendarMonthInput={calendarMonthInput}
              calendarJumpDate={calendarJumpDate}
              selectedCalendarMonthKey={selectedCalendarMonthKey}
              mobileCalendarControlsOpen={mobileCalendarControlsOpen}
              calendarAuxPanel={calendarAuxPanel}
              isMobileViewport={isMobileViewport}
              mobileStreakJumpStyle={mobileStreakJumpStyle}
              streak={streak}
              isPro={isPro}
              dynamicMonthCalendar={dynamicMonthCalendar}
              calendarEntriesByDate={calendarEntriesByDate}
              selectedMonthTone={selectedMonthTone}
              calendarHoverEntryId={calendarHoverEntryId}
              calendarPinnedEntryId={calendarPinnedEntryId}
              activeCalendarPreview={activeCalendarPreview}
              selectedDateKey={selectedDateKey}
              isSelectedDateToday={isSelectedDateToday}
              selectedDateSummary={selectedDateSummary}
              selectedDateFocusedMinutes={selectedDateFocusedMinutes}
              selectedDatePlans={selectedDatePlans}
              selectedDateEntries={selectedDateEntries}
              selectedDateDayTone={selectedDateDayTone}
              selectedDateCanAddBlocks={selectedDateCanAddBlocks}
              dayPortalComposerOpen={dayPortalComposerOpen}
              bandanaColor={bandanaColor}
              currentTimeMarker={currentTimeMarker}
              dayViewTimeline={dayViewTimeline}
              mobileDayTimelineHeight={mobileDayTimelineHeight}
              activatedCalendarEntryId={activatedCalendarEntryId}
              activeOverlapPickerItem={activeOverlapPickerItem}
              activeDayViewPreviewItem={activeDayViewPreviewItem}
              planTitle={planTitle}
              planNoteExpanded={planNoteExpanded}
              planNote={planNote}
              planTone={planTone}
              planConflictWarning={planConflictWarning}
              planTime={planTime}
              planDuration={planDuration}
              planStatus={planStatus}
              plannerSectionsOpen={plannerSectionsOpen}
              selectedDatePlanGroups={selectedDatePlanGroups}
              selectedDateAgendaStateSummary={selectedDateAgendaStateSummary}
              mobileAgendaEntriesOpen={mobileAgendaEntriesOpen}
              mobileBlockSheetOpen={mobileBlockSheetOpen}
              draggedPlanId={draggedPlanId}
              plannedBlockById={plannedBlockById}
              focusMetricsCalendar={focusMetrics.calendar}
              historicalStreaksByDay={historicalStreaksByDay}
              calendarCompanionPulse={companionState.pulses.calendar}
              onPrevMonth={() => setCalendarCursor((current) => shiftMonth(current, -1))}
              onNextMonth={() => setCalendarCursor((current) => shiftMonth(current, 1))}
              onSetCalendarView={setCalendarView}
              onSetCalendarCursor={setCalendarCursor}
              onSetCalendarJumpDate={setCalendarJumpDate}
              onCalendarJumpGo={() => {
                if (!calendarJumpDate) return;
                selectCalendarDate(calendarJumpDate);
              }}
              onToggleMobileCalendarControls={() => setMobileCalendarControlsOpen((open) => !open)}
              onSetCalendarAuxPanel={setCalendarAuxPanel}
              onGoToStreaks={() => {
                setMobileMoreOpen(false);
                setActiveTab("streaks");
              }}
              onApplyMonthTone={applyMonthTone}
              onSelectCalendarDate={selectCalendarDate}
              onSetCalendarHoverEntryId={setCalendarHoverEntryId}
              onSetCalendarPinnedEntryId={setCalendarPinnedEntryId}
              onOpenPlannedBlockDetail={openPlannedBlockDetail}
              onApplyDayTone={applyDayTone}
              onOpenCalendarBlockComposer={openCalendarBlockComposer}
              onSetDayPortalComposerOpen={setDayPortalComposerOpen}
              onScrollCalendarTimelineToNow={scrollCalendarTimelineToNow}
              onShowCalendarHoverPreview={showCalendarHoverPreview}
              onScheduleCalendarHoverPreviewClear={scheduleCalendarHoverPreviewClear}
              onClearCalendarHoverPreviewDelay={clearCalendarHoverPreviewDelay}
              onSetOverlapPickerEntryId={setOverlapPickerEntryId}
              onOpenNotesTab={openNotesTab}
              onSetSelectedNoteId={setSelectedNoteId}
              onSetActiveTabHistory={() => setActiveTab("history")}
              onCompletePlannedBlock={completePlannedBlock}
              onSetPlanTitle={setPlanTitle}
              onSetPlanNoteExpanded={setPlanNoteExpanded}
              onSetPlanNote={setPlanNote}
              onSetPlanTone={setPlanTone}
              onSetPlanConflictWarning={setPlanConflictWarning}
              onSetPlanTime={setPlanTime}
              onSetPlanDuration={setPlanDuration}
              onAddPlannedBlock={addPlannedBlock}
              onUpdatePlannedBlockTime={updatePlannedBlockTime}
              onDeletePlannedBlock={deletePlannedBlock}
              onReorderPlannedBlocks={reorderPlannedBlocks}
              onSetDraggedPlanId={setDraggedPlanId}
              onSetPlannerSectionsOpen={setPlannerSectionsOpen}
              onSetMobileAgendaEntriesOpen={setMobileAgendaEntriesOpen}
              onSetMobileBlockSheetOpen={setMobileBlockSheetOpen}
              onUpgrade={openUpgradeFlow}
            />
          )}

          {activeTab === "leaderboard" && (
            <WhelmboardTab
              sectionRef={leaderboardSectionRef}
              primaryRef={leaderboardPrimaryRef}
              leaderboardMetricTab={leaderboardMetricTab}
              onSetMetricTab={setLeaderboardMetricTab}
              leaderboardCurrentUserRank={leaderboardCurrentUserRank}
              leaderboardCurrentUserMovement={leaderboardCurrentUserMovement}
              leaderboardSource={leaderboardSource}
              leaderboardTotalEntries={leaderboardTotalEntries}
              leaderboardRows={leaderboardRows}
              leaderboardAroundRows={leaderboardAroundRows}
              leaderboardBandanaHolders={leaderboardBandanaHolders}
              leaderboardError={leaderboardError}
              leaderboardLoading={leaderboardLoading}
              leaderboardHasEntries={leaderboardHasEntries}
              leaderboardHasMore={leaderboardHasMore}
              seenChallengerIds={seenChallengerIds}
              onSelectProfile={setSelectedLbProfile}
              onLoadMore={() => void handleLeaderboardLoadMore()}
            />
          )}

          {activeTab === "mirror" && (
            <MirrorTab
              sectionRef={mirrorSectionRef}
              entriesAnchorRef={mirrorEntriesAnchorRef}
              mirrorSectionsOpen={mirrorSectionsOpen}
              onToggleMirrorSection={(key) =>
                setMirrorSectionsOpen((current) => ({ ...current, [key]: !current[key] }))
              }
              streakMirrorSaying={streakMirrorSaying}
              mirrorPrivacyOpen={mirrorPrivacyOpen}
              onToggleMirrorPrivacy={() => setMirrorPrivacyOpen((current) => !current)}
              monthlyStreakSaveCount={monthlyStreakSaveCount}
              streakSaveMonthlyLimit={STREAK_SAVE_MONTHLY_LIMIT}
              streakSaveSlotsLeft={streakSaveSlotsLeft}
              streakMirrorEntries={streakMirrorEntries}
              streakMirrorVisibleEntries={streakMirrorVisibleEntries}
              selectedStreakMirrorEntry={selectedStreakMirrorEntry}
              isPro={isPro}
              onSelectMirrorEntry={(id) => {
                setSelectedStreakMirrorId(id);
                setMirrorSectionsOpen((current) => ({
                  ...current,
                  entries: true,
                  detail: true,
                }));
              }}
              proPanelMirrorOpen={proPanelsOpen.mirror}
              onToggleProMirrorPanel={() =>
                setProPanelsOpen((current) => ({ ...current, mirror: !current.mirror }))
              }
              onStartProPreview={() => void handleStartProPreview()}
            />
          )}

          {activeTab === "notes" && (
            <NotesTab
              sectionRef={notesSectionRef}
              notesSurface={notesSurface}
              onSetNotesSurface={setNotesSurface}
              uid={user?.uid ?? ""}
              onCardsXPEarned={handleCardsXPEarned}
              isMobileViewport={isMobileViewport}
              notes={notes}
              selectedNoteId={selectedNoteId}
              selectedNote={selectedNote}
              filteredNotes={filteredNotes}
              recentNotes={recentNotes}
              selectedNoteWordCount={selectedNoteWordCount}
              hasLockedNotesHistory={hasLockedNotesHistory}
              resolvedTheme={resolvedTheme}
              selectedNoteSurfaceColor={selectedNoteSurfaceColor}
              selectedNotePageColor={selectedNotePageColor}
              xpTierTheme={xpTierTheme}
              streakBandanaTier={streakBandanaTier}
              bandanaColor={bandanaColor}
              notesSearch={notesSearch}
              onSetNotesSearch={setNotesSearch}
              notesCategoryFilter={notesCategoryFilter}
              onSetNotesCategoryFilter={setNotesCategoryFilter}
              mobileNotesRecentOpen={mobileNotesRecentOpen}
              onSetMobileNotesRecentOpen={setMobileNotesRecentOpen}
              mobileNotesEditorOpen={mobileNotesEditorOpen}
              onSetMobileNotesEditorOpen={setMobileNotesEditorOpen}
              mobileNotesToolsOpen={mobileNotesToolsOpen}
              onSetMobileNotesToolsOpen={setMobileNotesToolsOpen}
              colorPickerOpen={colorPickerOpen}
              onSetColorPickerOpen={setColorPickerOpen}
              shellColorPickerOpen={shellColorPickerOpen}
              onSetShellColorPickerOpen={setShellColorPickerOpen}
              textColorPickerOpen={textColorPickerOpen}
              onSetTextColorPickerOpen={setTextColorPickerOpen}
              highlightPickerOpen={highlightPickerOpen}
              onSetHighlightPickerOpen={setHighlightPickerOpen}
              editorBandanaCaret={editorBandanaCaret}
              onSetEditorBandanaCaret={setEditorBandanaCaret}
              notesSyncStatus={notesSyncStatus}
              notesSyncMessage={notesSyncMessage}
              noteAttachmentBusy={noteAttachmentBusy}
              noteAttachmentStatus={noteAttachmentStatus}
              pendingNoteAttachments={pendingNoteAttachments}
              noteAttachmentInputRef={noteAttachmentInputRef}
              notesStartRef={notesStartRef}
              notesRecentRef={notesRecentRef}
              notesEditorRef={notesEditorRef}
              editorRef={editorRef}
              noteBodyShellRef={noteBodyShellRef}
              onNoteAttachmentInput={handleNoteAttachmentInput}
              onOpenAttachmentPicker={openNoteAttachmentPicker}
              onOpenNoteAttachment={openNoteAttachment}
              onRemoveNoteAttachment={(attachment) => void removeNoteAttachment(attachment)}
              onConvertNoteToBlock={convertNoteToPlannedBlock}
              onDeleteNote={(noteId) => void deleteNote(noteId)}
              onCreateNote={() => void createWorkspaceNote()}
              onTogglePinned={(noteId) => void togglePinned(noteId)}
              onUpdateSelectedNote={(patch) => void updateSelectedNote(patch)}
              onCaptureEditorDraft={captureEditorDraft}
              onSaveEditorSelection={saveEditorSelection}
              onApplyEditorCommand={applyEditorCommand}
              onCheckEditorSelection={checkEditorSelection}
              onUpdateEditorBandanaCaret={updateEditorBandanaCaret}
              onFlushNoteDraft={() => void flushSelectedNoteDraft()}
              onMobileCreateNote={() => void handleMobileCreateNote()}
              onOpenMobileEditor={openMobileNoteEditor}
              onOpenCurrentMobileNote={handleOpenCurrentMobileNote}
              onRetrySync={() => void handleRetrySync()}
              onApplyHighlightColor={applyHighlightColor}
              onScrollToSection={scrollToSection}
              onSetSelectedNoteId={setSelectedNoteId}
              isPro={isPro}
              proPanelNotesOpen={proPanelsOpen.notes}
              onToggleProNotesPanel={() => setProPanelsOpen((current) => ({ ...current, notes: !current.notes }))}
              onStartProPreview={() => void handleStartProPreview()}
              onOpenUpgradeFlow={openUpgradeFlow}
            />
          )}

          {activeTab === "history" && (
            <HistoryTab
              companionPulse={companionState.pulses.history}
              bandanaColor={bandanaColor}
              sectionRef={historySectionRef}
              primaryRef={historyPrimaryRef}
              plannedBlockHistory={plannedBlockHistory}
              historySectionsOpen={historySectionsOpen}
              onToggleHistorySection={(key) =>
                setHistorySectionsOpen((current) => ({ ...current, [key]: !current[key] }))
              }
              isPro={isPro}
              hasLockedBlockHistory={hasLockedBlockHistory}
              proPanelCalendarOpen={proPanelsOpen.calendar}
              onToggleProCalendarPanel={() =>
                setProPanelsOpen((current) => ({ ...current, calendar: !current.calendar }))
              }
              onStartProPreview={() => void handleStartProPreview()}
              sessionHistoryGroups={isPro ? sessionHistoryGroups : freeSessionHistoryGroups}
              historyGroupsOpen={historyGroupsOpen}
              onToggleHistoryGroup={(key) =>
                setHistoryGroupsOpen((current) => ({ ...current, [key]: !current[key] }))
              }
              hasLockedHistoryDays={hasLockedHistoryDays}
              proPanelHistoryOpen={proPanelsOpen.history}
              onToggleProHistoryPanel={() =>
                setProPanelsOpen((current) => ({ ...current, history: !current.history }))
              }
              normalizeTimeLabel={normalizeTimeLabel}
              stripCompletedBlockPrefix={stripCompletedBlockPrefix}
            />
          )}

          {activeTab === "reports" && (
            <ReportsTab
              sectionRef={reportsSectionRef}
              primaryRef={reportsPrimaryRef}
              companionPulse={companionState.pulses.reports}
              bandanaColor={bandanaColor}
              isPro={isPro}
              proPanelReportsOpen={proPanelsOpen.reports}
              onToggleProReportsPanel={() =>
                setProPanelsOpen((current) => ({ ...current, reports: !current.reports }))
              }
              onStartProPreview={() => void handleStartProPreview()}
              focusMetrics={focusMetrics}
              insightRange={insightRange}
              onSetInsightRange={setInsightRange}
              analyticsDateRange={analyticsDateRange}
              analyticsError={analyticsError}
              analyticsLoading={analyticsLoading}
              analyticsWeeklySummary={analyticsWeeklySummary}
              analyticsLeadInsight={analyticsLeadInsight}
              analyticsBestWindow={analyticsBestHours?.bestWindow ?? null}
              analyticsLeadSubject={analyticsLeadSubject}
              analyticsLeadNotification={analyticsLeadNotification}
              reportsSectionsOpen={reportsSectionsOpen}
              onToggleReportsSection={(key) =>
                setReportsSectionsOpen((current) => ({ ...current, [key]: !current[key] }))
              }
              analyticsScoreHistory={analyticsScoreHistory}
              analyticsScorePath={analyticsScorePath}
              analyticsInsights={analyticsInsights}
              analyticsTopHours={analyticsTopHours}
              analyticsTopSubjects={analyticsTopSubjects}
              analyticsTopSubjectMinutes={analyticsTopSubjectMinutes}
              analyticsNotificationPlan={analyticsNotificationPlan}
            />
          )}

          {activeTab === "streaks" && (
            <StreaksTab
              sectionRef={streaksSectionRef}
              primaryRef={streaksPrimaryRef}
              streakRulesOpen={streakRulesOpen}
              onToggleStreakRules={() => setStreakRulesOpen((current) => !current)}
              streakRuleSummaryLine={streakRuleSummaryLine}
              streakProgressBlocksLabel={streakProgressBlocksLabel}
              streakProgressMinutesLabel={streakProgressMinutesLabel}
              streakProgressWordsLabel={streakProgressWordsLabel}
              streakProtectedToday={streakProtectedToday}
              streakStatusLine={streakStatusLine}
              rawYesterdayMissed={rawYesterdayMissed}
              yesterdaySave={yesterdaySave}
              sickDaySaveEligible={sickDaySaveEligible}
              monthlySaveLimitReached={monthlySaveLimitReached}
              yesterdayKey={yesterdayKey}
              monthlyStreakSaveCount={monthlyStreakSaveCount}
              streakSaveMonthlyLimit={STREAK_SAVE_MONTHLY_LIMIT}
              onOpenStreakSaveQuestionnaire={openStreakSaveQuestionnaire}
              onDeclineSickDaySave={() => declineSickDaySave(rawYesterdayMissed, yesterdayKey)}
              onGoToMirror={() => setActiveTab("mirror")}
              onGoToToday={() => setActiveTab("today")}
              streakMonthLabel={streakMonthLabel}
              streakMonthCalendar={streakMonthCalendar}
              onPrevMonth={() => setStreakCalendarCursor((current) => shiftMonth(current, -1))}
              onNextMonth={() => setStreakCalendarCursor((current) => shiftMonth(current, 1))}
              sessionMinutesByDay={sessionMinutesByDay}
              completedBlocksByDay={completedBlocksByDay}
              noteWordsByDay={noteWordsByDay}
              streakQualifiedDateKeys={streakQualifiedDateKeys}
              onGoToTodayFromCalendar={() => setActiveTab("today")}
            />
          )}

          {activeTab === "settings" && (
            <SettingsTab
              companionPulse={companionState.pulses.settings}
              bandanaColor={bandanaColor}
              sectionRef={settingsSectionRef}
              primaryRef={settingsPrimaryRef}
              streakBandanaTier={streakBandanaTier}
              isPro={isPro}
              photoUrl={currentUserPhotoUrl}
              displayName={user.displayName}
              email={user.email}
              profileTierTheme={profileTierTheme}
              nextBandanaMilestone={nextBandanaMilestone}
              proSource={proSource}
              streak={streak}
              companionStyle={companionStyle}
              themeMode={themeMode}
              sectionsOpen={settingsSectionsOpen}
              onToggleSection={(key) =>
                setSettingsSectionsOpen((current) => ({ ...current, [key]: !current[key] }))
              }
              onFeedbackOpen={() => {
                setFeedbackOpen(true);
                setFeedbackStatus("");
              }}
              onStartProPreview={() => void handleStartProPreview()}
              onRestoreFreeTier={() => void handleRestoreFreeTier()}
              onSignOut={() => void handleSignOut()}
              onApplyCompanionStyle={applyCompanionStyle}
              onApplyThemeMode={applyThemeMode}
              appBackgroundSetting={appBackgroundSetting}
              backgroundSkin={backgroundSkin}
              backgroundUploadInputRef={backgroundUploadInputRef}
              onBackgroundUpload={handleBackgroundUpload}
              onApplyBackgroundSetting={applyBackgroundSetting}
              onUpdateBackgroundSkin={updateBackgroundSkin}
              proPanelBackgroundOpen={proPanelsOpen.background}
              onToggleProBackgroundPanel={() =>
                setProPanelsOpen((current) => ({ ...current, background: !current.background }))
              }
              notesSyncStatus={notesSyncStatus}
              notesSyncMessage={notesSyncMessage}
              onRetrySync={() => void handleRetrySync()}
              screenTimeSupported={screenTimeSupported}
              screenTimeStatus={screenTimeStatus}
              screenTimeReason={screenTimeReason}
              screenTimeBusy={screenTimeBusy}
              onRequestScreenTimeAuth={() => void handleRequestScreenTimeAuth()}
              onOpenScreenTimeSettings={() => void handleOpenScreenTimeSettings()}
              deletingAccount={deletingAccount}
              onDeleteAccount={() => void handleDeleteAccount()}
              accountDangerStatus={accountDangerStatus}
              onPreviewStreakMirror={openStreakSaveQuestionnairePreview}
              onPreviewDailyCommitment={openDailyPlanningPreview}
              onPreviewStreakAlert={openSickDaySavePromptPreview}
            />
          )}
        </section>
      </div>

      <BottomNav
        activeTab={activeTab}
        mobileMoreActive={mobileMoreActive}
        mobileMoreOpen={mobileMoreOpen}
        onTabSelect={handleMobileTabSelect}
        onMoreOpen={() => setMobileMoreOpen(true)}
      />

      <AnimatePresence>
        {!notificationsBlocked && sessionReward ? (
          <SessionRewardToast reward={sessionReward} onDismiss={() => setSessionReward(null)} />
        ) : null}
      </AnimatePresence>

      <XPPopAnimation pops={xpPops} onDone={removeXPPop} />
      <WhelToastContainer toasts={whelToasts} onDismiss={dismissToast} />

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
              <WhelmProfileAvatar
                tierColor={streakBandanaTier?.color}
                size="hero"
                isPro={isPro}
                photoUrl={currentUserPhotoUrl}
              />
              <div className={styles.profileHeroCopy}>
                <p className={styles.sectionLabel}>Whelm Identity</p>
                <h3 className={styles.profileHeroTitle}>{profileDisplayName}</h3>
                <p className={styles.accountMeta}>
                  {profileTierTheme.title} · {streakBandanaTier?.label ?? "No bandana yet"}
                </p>
              </div>
            </article>

            <article className={styles.profileCommandCard}>
              <span>Current directive</span>
              <strong>{nextPlannedBlock?.title ?? "No active block queued"}</strong>
              <small>
                {nextPlannedBlock
                  ? `${normalizeTimeLabel(nextPlannedBlock.timeOfDay)} · ${nextPlannedBlock.durationMinutes}m`
                  : "Open Schedule or Today and place the next deliberate move."}
              </small>
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
                Open Streaks
              </button>
              <button
                type="button"
                className={styles.secondaryPlanButton}
                onClick={() => {
                  setProfileOpen(false);
                  setMobileMoreOpen(true);
                }}
              >
                More tabs
              </button>
            </div>
          </div>
        </div>
      )}

      {mobileMoreOpen && (
        <div className={styles.feedbackOverlay} onClick={() => setMobileMoreOpen(false)}>
          <div className={styles.mobileMoreSheet} onClick={(event) => event.stopPropagation()}>
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>Quick links</h2>
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
                  onClick={() => handleTabSelect(tab)}
                >
                  <span className={styles.bottomTabIcon}>{iconForTab(tab)}</span>
                  <strong>{tabTitle(tab)}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedPlanDetail && (
        <div className={styles.feedbackOverlay} onClick={closePlannedBlockDetail}>
          <div className={styles.feedbackModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.feedbackHeader}>
              <div>
                <p className={styles.sectionLabel}>Block Detail</p>
                <h2 className={styles.feedbackTitle}>{selectedPlanDetail.title}</h2>
              </div>
              <button
                type="button"
                className={styles.feedbackClose}
                onClick={closePlannedBlockDetail}
              >
                Close
              </button>
            </div>
            <p className={styles.feedbackMeta}>
              {new Date(`${selectedPlanDetail.dateKey}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}{" "}
              • {normalizeTimeLabel(selectedPlanDetail.timeOfDay)} • {selectedPlanDetail.durationMinutes}m
              {selectedPlanDetail.attachmentCount
                ? ` • ${attachmentIndicatorLabel(selectedPlanDetail.attachmentCount)}`
                : ""}
            </p>
            {selectedPlanDetail.note.trim() ? (
              <div className={styles.blockDetailNote}>
                <strong>Block note</strong>
                <p>{selectedPlanDetail.note}</p>
              </div>
            ) : (
              <p className={styles.accountMeta}>No block note was added yet.</p>
            )}
            <div className={styles.calendarTonePanel}>
              <CalendarTonePicker
                label="Block tone"
                selectedTone={visiblePlanTone(selectedPlanDetail.tone)}
                onSelectTone={(tone) => updatePlannedBlockTone(selectedPlanDetail.id, tone)}
                isPro={isPro}
                onUpgrade={openUpgradeFlow}
              />
            </div>
            <div className={styles.noteFooterActions}>
              {selectedPlanDetail.status !== "completed" ? (
                <button
                  type="button"
                  className={styles.planCompleteButton}
                  onClick={() => void completePlannedBlock(selectedPlanDetail)}
                >
                  Complete block
                </button>
              ) : null}
              <button
                type="button"
                className={styles.secondaryPlanButton}
                onClick={() => {
                  setSelectedCalendarDate(selectedPlanDetail.dateKey);
                  setCalendarView("day");
                  setActiveTab("calendar");
                  closePlannedBlockDetail();
                }}
              >
                Open in day view
              </button>
              {selectedPlanDetail.status !== "completed" ? (
                <button
                  type="button"
                  className={styles.planDeleteButton}
                  onClick={() => {
                    deletePlannedBlock(selectedPlanDetail.id);
                    closePlannedBlockDetail();
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}


      {dailyPlanningOpen && dailyPlanningPreviewOpen && (
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
                <p className={styles.sectionLabel}>Daily Commitments</p>
                <h2 className={styles.feedbackTitle}>Claim today before it claims you.</h2>
              </div>
            </div>
            <p className={styles.feedbackMeta}>
              <strong className={styles.dailyRitualCallout}>3 daily commitments to enter.</strong>{" "}
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
                        <strong>Commitment {index + 1}</strong>
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
                        {isPro ? (
                          <CalendarTonePicker
                            label="Block tone"
                            selectedTone={draft.tone}
                            onSelectTone={(tone) => updateDailyRitualDraft(draft.id, { tone })}
                            isPro={isPro}
                            onUpgrade={openUpgradeFlow}
                          />
                        ) : null}
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
                  <DailyRitualSubmitBandana
                    className={styles.dailyRitualSubmitBandana}
                    streakDays={hasEarnedToday ? displayStreak : displayStreak + 1}
                  />
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
                Dark
              </button>
              <button
                type="button"
                className={`${styles.companionStyleButton} ${
                  themeMode === "light" ? styles.companionStyleButtonActive : ""
                }`}
                onClick={() => applyThemeMode("light")}
              >
                Light
              </button>
              <button
                type="button"
                className={`${styles.companionStyleButton} ${
                  themeMode === "system" ? styles.companionStyleButtonActive : ""
                }`}
                onClick={() => applyThemeMode("system")}
              >
                Auto
              </button>
            </div>
          </div>
        </div>
      )}

      {streakSaveQuestionnaireOpen && (sickDaySaveEligible || streakSaveQuestionnairePreview) && (
        <div className={styles.feedbackOverlay} onClick={closeStreakSaveQuestionnaire}>
          <div
            className={`${styles.feedbackModal} ${styles.feedbackModalScrollable}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>Streak Mirror check-in</h2>
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
                : "Private to you. No one else sees these reflections. Whelm keeps them only to support honest reflection and accountability inside the app."}
            </p>
            <div className={styles.mirrorModalBanner}>
              <strong>{monthlyStreakSaveCount}/{STREAK_SAVE_MONTHLY_LIMIT} used this month</strong>
              <span>{streakMirrorSaying}</span>
            </div>
            <div className={styles.feedbackFormStack}>
              {STREAK_SAVE_ACCOUNTABILITY_QUESTIONS.map((question, index) => {
                const currentAnswer = streakSaveAnswers[question] ?? "";
                const wordCount = countWords(currentAnswer);
                const metMinimum = wordCount >= STREAK_MIRROR_MIN_WORDS;
                return (
                  <label key={question} className={styles.planLabel}>
                    {index + 1}. {question}
                    <textarea
                      value={currentAnswer}
                      onChange={(event) =>
                        setStreakSaveAnswers((current) => ({
                          ...current,
                          [question]: event.target.value.slice(0, 2500),
                        }))
                      }
                      className={styles.feedbackTextarea}
                      rows={5}
                    />
                    <span className={`${styles.mirrorWordCount} ${metMinimum ? styles.mirrorWordCountMet : ""}`}>
                      {wordCount} / {STREAK_MIRROR_MIN_WORDS} words
                      {metMinimum ? " met" : ""}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className={styles.mirrorTagSection}>
              <p className={styles.feedbackLabel}>What best describes the miss?</p>
                    <div className={styles.mirrorTagRow}>
                      {STREAK_MIRROR_TAGS.map((tag) => (
                        <button
                          key={tag.value}
                          type="button"
                          className={`${styles.mirrorTagButton} ${
                            streakMirrorTag === tag.value ? styles.mirrorTagButtonActive : ""
                          }`}
                          style={{ ["--mirror-accent" as const]: tag.accent } as CSSProperties}
                          onClick={() => setStreakMirrorTag(tag.value)}
                        >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
            {streakSaveStatus && <p className={styles.feedbackStatus}>{streakSaveStatus}</p>}
            <div className={styles.noteFooterActions}>
              <button
                type="button"
                className={styles.feedbackSubmit}
                onClick={() =>
                  claimSickDaySave({
                    sickDaySaveEligible,
                    monthlySaveLimitReached,
                    yesterdayKey,
                    sessions,
                    protectedStreakDateKeys,
                    onTrackStreakChange: (previousStreak, nextStreak, source, changedDateKey) =>
                      trackStreakChange(previousStreak, nextStreak, source, null, changedDateKey),
                    onAfterClaim: () => setActiveTab("mirror"),
                  })
                }
                disabled={
                  !streakSaveQuestionnairePreview &&
                  (STREAK_SAVE_ACCOUNTABILITY_QUESTIONS.some(
                    (question) =>
                      countWords(streakSaveAnswers[question] ?? "") < STREAK_MIRROR_MIN_WORDS,
                  ) ||
                    !streakMirrorTag)
                }
              >
                {streakSaveQuestionnairePreview ? "Close preview" : "Save to Streak Mirror"}
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

      {!notificationsBlocked && sickDaySavePromptOpen && ((rawYesterdayMissed && !yesterdaySave) || sickDaySavePromptPreview) && (
        <div className={styles.feedbackOverlay} onClick={dismissSickDaySavePrompt}>
          <div className={styles.feedbackModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>
                {sickDaySaveEligible ? "Your streak is at risk from yesterday" : "Your streak reset yesterday"}
              </h2>
              <button
                type="button"
                className={styles.feedbackClose}
                onClick={dismissSickDaySavePrompt}
              >
                Later
              </button>
            </div>
            <p className={styles.feedbackMeta}>
              {sickDaySaveEligible
                ? "You missed yesterday, so the streak will reset unless you use a private Streak Mirror save. Open it now if the miss was genuinely caused by sickness."
                : monthlySaveLimitReached
                  ? "You missed yesterday and the streak reset. Your Streak Mirror is still there to review patterns, but this month has already used all available saves."
                  : "You missed yesterday and the streak reset. Open Streak Mirror to review what happened and reset clearly."}
            </p>
            <div className={styles.noteFooterActions}>
              <button
                type="button"
                className={styles.feedbackSubmit}
                onClick={openSickDaySaveReview}
              >
                {sickDaySaveEligible ? "Open Streak Mirror save" : "Open Streak Mirror"}
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

      {!notificationsBlocked && (noteUndoItem || deletedPlanUndo) && (
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

      <AnimatePresence>
        {!notificationsBlocked && streakCelebration ? (
          <StreakCelebrationToast
            celebration={streakCelebration}
            onDismiss={() => setStreakCelebration(null)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {!notificationsBlocked && streakNudge ? (
          <StreakNudgeToast
            nudge={streakNudge}
            onDismiss={() => setStreakNudge(null)}
            onAction={handleStreakNudgeAction}
          />
        ) : null}
      </AnimatePresence>

      {paywallOpen && (
        <div className={styles.feedbackOverlay} onClick={() => setPaywallOpen(false)}>
          <div className={styles.paywallModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>Upgrade to Whelm Pro</h2>
              <button type="button" className={styles.feedbackClose} onClick={() => setPaywallOpen(false)}>
                Close
              </button>
            </div>
            <p className={styles.paywallCopy}>
              {WHELM_PRO_POSITIONING}
            </p>
            <div className={styles.planGrid}>
              <article className={`${styles.planCard} ${styles.planCardFeatured}`}>
                <p className={styles.planName}>Whelm Pro Founding Release</p>
                <p className={styles.planPrice}>Soon</p>
                <p className={styles.planMeta}>early users will receive a strong launch offer</p>
              </article>
            </div>
            <ul className={styles.proList}>
              <li>Deeper command reports and score history</li>
              <li>Longer memory across streaks, history, and reflections</li>
              <li>Stronger personalization, cleaner command surfaces, and more animated PRO WHELMS!</li>
            </ul>
            <div className={styles.paywallActions}>
              <button type="button" className={styles.feedbackSubmit} onClick={() => setPaywallOpen(false)}>
                Stay in Whelm Free
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

      {selectionPopup && !quickCardForm ? (
        <button
          type="button"
          className={styles.selectionCardPopup}
          style={{ left: selectionPopup.x, top: selectionPopup.y }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setQuickCardForm({ front: "", back: selectionPopup.text });
            setSelectionPopup(null);
          }}
        >
          📇 Create Card
        </button>
      ) : null}

      {quickCardForm ? (
        <div className={styles.feedbackOverlay} onClick={() => setQuickCardForm(null)}>
          <div className={styles.feedbackModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>Create Card from Note</h2>
              <button type="button" className={styles.feedbackClose} onClick={() => setQuickCardForm(null)}>
                ✕
              </button>
            </div>
            <label className={styles.planLabel}>
              Front (question)
              <input
                autoFocus
                value={quickCardForm.front}
                onChange={(event) => setQuickCardForm((current) => current ? { ...current, front: event.target.value } : null)}
                className={styles.planControl}
                placeholder="What does this text answer?"
              />
            </label>
            <label className={styles.planLabel}>
              Back (answer)
              <textarea
                value={quickCardForm.back}
                onChange={(event) => setQuickCardForm((current) => current ? { ...current, back: event.target.value } : null)}
                className={styles.feedbackTextarea}
                rows={5}
              />
            </label>
            <div className={styles.feedbackFooter}>
              <button
                type="button"
                className={styles.feedbackSubmit}
                onClick={() => void handleQuickCardSave()}
                disabled={!quickCardForm.front.trim() || !quickCardForm.back.trim()}
              >
                Save Card
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mascot.visible ? (
        <WhelMascot
          pose={mascot.pose}
          bandanaColor={mascot.bandanaColor}
          message={mascot.message}
          onDismiss={dismissMascot}
        />
      ) : null}

      {/* ── Leaderboard player profile modal ── */}
      {selectedLbProfile ? (() => {
        const { entry, rank } = selectedLbProfile;
        const profileBandana = getLeaderboardBandanaMeta(entry.currentStreak);
        const joinDate = (() => {
          try {
            return new Date(entry.createdAtISO).toLocaleDateString("en-US", { month: "long", year: "numeric" });
          } catch {
            return null;
          }
        })();
        return (
          <div
            className={styles.feedbackOverlay}
            onClick={() => setSelectedLbProfile(null)}
          >
            <div
              className={styles.lbProfileSheet}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.lbProfileHeader}>
                <span className={styles.sectionLabel}>Player Profile</span>
                <button
                  type="button"
                  className={styles.feedbackClose}
                  onClick={() => setSelectedLbProfile(null)}
                  aria-label="Close profile"
                >
                  ✕
                </button>
              </div>

              <div className={styles.lbProfileHero}>
                <WhelmProfileAvatar
                  tierColor={profileBandana.tier?.color}
                  size="compact"
                  isPro={entry.isProStyle}
                  photoUrl={entry.avatarUrl}
                />
                <div className={styles.lbProfileHeroMeta}>
                  <div className={styles.lbProfileNameRow}>
                    <strong className={styles.lbProfileUsername}>
                      {entry.username.slice(0, 16)}
                    </strong>
                    {entry.isCurrentUser ? (
                      <span className={styles.leaderboardYouBadge}>You</span>
                    ) : null}
                  </div>
                  <p className={styles.lbProfileRank}>Rank #{rank}</p>
                  {profileBandana.tier ? (
                    <span
                      className={styles.lbProfileBandanaBadge}
                      style={{
                        background: profileBandana.theme.shell,
                        color: profileBandana.theme.accent,
                        borderColor: profileBandana.theme.accent,
                      }}
                    >
                      {profileBandana.tier.label}
                    </span>
                  ) : (
                    <span className={styles.lbProfileBandanaBadge} style={{ opacity: 0.5 }}>
                      No bandana yet
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.lbProfileStatsGrid}>
                <div className={styles.lbProfileStat}>
                  <span className={styles.lbProfileStatValue}>{entry.totalXp.toLocaleString()}</span>
                  <span className={styles.lbProfileStatLabel}>Total XP</span>
                </div>
                <div className={styles.lbProfileStat}>
                  <span className={styles.lbProfileStatValue}>Lv {entry.level}</span>
                  <span className={styles.lbProfileStatLabel}>Level</span>
                </div>
                <div className={styles.lbProfileStat}>
                  <span className={styles.lbProfileStatValue}>{entry.currentStreak}</span>
                  <span className={styles.lbProfileStatLabel}>Streak days</span>
                </div>
                {(entry.bestStreak ?? 0) > 0 ? (
                  <div className={styles.lbProfileStat}>
                    <span className={styles.lbProfileStatValue}>{entry.bestStreak}</span>
                    <span className={styles.lbProfileStatLabel}>Best streak</span>
                  </div>
                ) : null}
                {(entry.totalFocusHours ?? 0) > 0 ? (
                  <div className={styles.lbProfileStat}>
                    <span className={styles.lbProfileStatValue}>{entry.totalFocusHours}h</span>
                    <span className={styles.lbProfileStatLabel}>Focus hours</span>
                  </div>
                ) : null}
              </div>

              {joinDate ? (
                <p className={styles.lbProfileJoinDate}>Member since {joinDate}</p>
              ) : null}
            </div>
          </div>
        );
      })() : null}
    </>
  );
}
