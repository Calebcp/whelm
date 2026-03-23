"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useRive } from "@rive-app/react-canvas";
import { AnimatePresence, motion } from "motion/react";
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
import MilestoneReveal from "@/components/MilestoneReveal";
import WhelmEmote from "@/components/WhelmEmote";
import WhelmRitualScene from "@/components/WhelmRitualScene";
import {
  trackAppOpened,
  trackLeaderboardAroundMeLoaded,
  trackLeaderboardPageLoaded,
  trackLeaderboardTabSwitched,
  trackLeaderboardViewed,
  trackSessionAbandoned,
  trackSessionCompleted,
  trackSessionStarted,
  trackStreakUpdated,
  trackTaskCompleted,
  trackTaskCreated,
} from "@/lib/analytics-tracker";
import { resolveApiUrl } from "@/lib/api-base";
import { auth } from "@/lib/firebase";
import {
  loadNotes,
  retryNotesSync,
  saveNotes,
  saveNotesLocally,
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
import {
  getStreakBandanaTier,
  STREAK_BANDANA_TIERS,
  type StreakBandanaTier,
} from "@/lib/streak-bandanas";
import { buildPerformanceNotificationPlan } from "@/lib/performance-notifications";
import type { LeaderboardPageResponse, LeaderboardSnapshotEntry } from "@/lib/leaderboard";
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
const STREAK_RULE_V2_START_DATE = "2026-03-22";
const XP_DAILY_TARGET = 120;
const XP_DAILY_CAP = 150;
const XP_FOCUS_DAILY_CAP = 90;
const XP_COMPLETED_BLOCK_XP = 25;
const XP_COMPLETED_BLOCK_DAILY_CAP = 50;
const XP_STREAK_DAILY_BONUS = 10;
const XP_COMBO_BONUS = 15;
const XP_DEEP_WORK_BONUS = 25;
const XP_WRITING_ENTRY_THRESHOLD = 33;
const XP_WRITING_ENTRY_BONUS = 10;
const XP_WRITING_BONUS_THRESHOLD = 100;
const XP_WRITING_BONUS_XP = 10;
const XP_WRITING_DAILY_CAP = 20;
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

type FeedbackCategory = "bug" | "feature" | "other";
type TrendRange = 7 | 30 | 90;
type CalendarView = "month" | "day";
type ThemeMode = "dark" | "light";
type DailyRitualBlockDraft = {
  id: string;
  existingBlockId?: string;
  title: string;
  note: string;
  tone: CalendarTone | null;
  timeOfDay: string;
  durationMinutes: number;
};
type AppTab =
  | "today"
  | "calendar"
  | "leaderboard"
  | "mirror"
  | "notes"
  | "streaks"
  | "history"
  | "reports"
  | "settings";
type LeaderboardMetricTab = "xp" | "streak";
type LeaderboardEntry = {
  id: string;
  username: string;
  createdAtISO: string;
  level: number;
  totalXp: number;
  currentStreak: number;
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
  tone?: CalendarTone;
  durationMinutes: number;
  timeOfDay: string;
  sortOrder: number;
  createdAtISO: string;
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

type SickDaySave = {
  id: string;
  dateKey: string;
  claimedAtISO: string;
  reason: "sick";
};

type StreakMirrorTag = (typeof STREAK_MIRROR_TAGS)[number]["value"];

type StreakMirrorEntry = {
  id: string;
  dateKey: string;
  createdAtISO: string;
  updatedAtISO: string;
  tag: StreakMirrorTag;
  answers: Record<string, string>;
  source: "streak_save";
};

function getStreakMirrorTagMeta(tag: StreakMirrorTag) {
  return STREAK_MIRROR_TAGS.find((item) => item.value === tag) ?? STREAK_MIRROR_TAGS[0];
}

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

function isDateKeyWithinRecentWindow(dateKey: string, days: number) {
  const cutoff = dayKeyLocal(addDaysLocal(new Date(), -(Math.max(1, days) - 1)));
  return dateKey >= cutoff;
}

function normalizePlannableDateKey(dateKey: string) {
  return isDateKeyBeforeToday(dateKey) ? dayKeyLocal(new Date()) : dateKey;
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

type DayXpSummary = {
  dateKey: string;
  streakLength: number;
  multiplier: number;
  baseActionXp: number;
  completedBlocksXp: number;
  focusXp: number;
  writingXp: number;
  multipliedBaseXp: number;
  streakDailyXp: number;
  streakMilestoneXp: number;
  deepWorkXp: number;
  comboXp: number;
  totalXp: number;
};

type SessionRewardState = {
  id: string;
  minutesSpent: number;
  xpGained: number;
  todayXp: number;
  streakAfter: number;
  streakDelta: number;
  leveledUp: boolean;
  tierUnlocked: StreakBandanaTier | null;
};

type LifetimeXpSummary = {
  totalXp: number;
  todayXp: number;
  todayTarget: number;
  dailyCap: number;
  currentLevel: number;
  currentLevelFloorXp: number;
  nextLevelXp: number;
  progressInLevel: number;
  progressToNextLevel: number;
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

function getXpMultiplierForStreak(streakLength: number) {
  switch (getStreakBandanaTier(streakLength)?.color) {
    case "white":
      return 2.4;
    case "black":
      return 2;
    case "blue":
      return 1.6;
    case "purple":
      return 1.35;
    case "green":
      return 1.2;
    case "red":
      return 1.1;
    case "yellow":
    default:
      return 1;
  }
}

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

function getXpWritingBonus(wordCount: number) {
  if (wordCount >= XP_WRITING_BONUS_THRESHOLD) {
    return XP_WRITING_DAILY_CAP;
  }

  if (wordCount >= XP_WRITING_ENTRY_THRESHOLD) {
    return XP_WRITING_ENTRY_BONUS;
  }

  return 0;
}

function doesDateQualifyForStreak({
  dateKey,
  focusMinutes,
  completedBlocks,
  noteWords,
  todayKey,
  protectedDateKeys,
}: {
  dateKey: string;
  focusMinutes: number;
  completedBlocks: number;
  noteWords: number;
  todayKey: string;
  protectedDateKeys: string[];
}) {
  if (protectedDateKeys.includes(dateKey)) return true;
  if (dateKey < STREAK_RULE_V2_START_DATE) return focusMinutes > 0;
  if (dateKey > todayKey) return false;
  return completedBlocks >= 1 && (focusMinutes >= 30 || noteWords >= 33);
}

function buildDayXpSummaryForDate({
  dateKey,
  sessionMinutesByDay,
  completedBlocksByDay,
  noteWordsByDay,
  streakQualifiedDateKeys,
}: {
  dateKey: string;
  sessionMinutesByDay: Map<string, number>;
  completedBlocksByDay: Map<string, number>;
  noteWordsByDay: Map<string, number>;
  streakQualifiedDateKeys: string[];
}) {
  const focusMinutes = sessionMinutesByDay.get(dateKey) ?? 0;
  const completedBlocks = completedBlocksByDay.get(dateKey) ?? 0;
  const noteWords = noteWordsByDay.get(dateKey) ?? 0;
  const streakLength = computeStreakEndingAtDateKey([], dateKey, streakQualifiedDateKeys);
  const multiplier = getXpMultiplierForStreak(streakLength);
  const completedBlocksXp = Math.min(XP_COMPLETED_BLOCK_DAILY_CAP, completedBlocks * XP_COMPLETED_BLOCK_XP);
  const focusXp = Math.min(XP_FOCUS_DAILY_CAP, focusMinutes);
  const writingXp = getXpWritingBonus(noteWords);
  const baseActionXp = completedBlocksXp + focusXp + writingXp;
  const multipliedBaseXp = Math.round(baseActionXp * multiplier);
  const streakDailyXp = streakLength > 0 ? XP_STREAK_DAILY_BONUS : 0;
  const streakMilestoneXp = streakLength > 0 ? getXpMilestoneBonus(streakLength) : 0;
  const deepWorkXp = focusMinutes >= 90 ? XP_DEEP_WORK_BONUS : 0;
  const comboXp =
    completedBlocks >= 1 && (focusMinutes >= 30 || noteWords >= XP_WRITING_ENTRY_THRESHOLD)
      ? XP_COMBO_BONUS
      : 0;

  return {
    dateKey,
    streakLength,
    multiplier,
    baseActionXp,
    completedBlocksXp,
    focusXp,
    writingXp,
    multipliedBaseXp,
    streakDailyXp,
    streakMilestoneXp,
    deepWorkXp,
    comboXp,
    totalXp: Math.min(
      XP_DAILY_CAP,
      multipliedBaseXp + streakDailyXp + streakMilestoneXp + deepWorkXp + comboXp,
    ),
  } satisfies DayXpSummary;
}

function getXpMilestoneBonus(streakLength: number) {
  if (streakLength === 100) return 350;
  if (streakLength === 30) return 120;
  if (streakLength === 7) return 40;
  return 0;
}

function getXpRequiredToReachLevel(level: number) {
  if (level <= 1) return 0;

  let total = 0;
  for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
    total += Math.round(85 * currentLevel ** 1.45);
  }

  return total;
}

function formatXpMultiplier(multiplier: number) {
  return `x${multiplier.toFixed(multiplier % 1 === 0 ? 1 : 2).replace(/\.?0+$/, "")}`;
}

function getLifetimeXpSummary(totalXp: number, todayXp: number): LifetimeXpSummary {
  let currentLevel = 1;
  let nextLevelXp = getXpRequiredToReachLevel(2);

  while (totalXp >= nextLevelXp) {
    currentLevel += 1;
    nextLevelXp = getXpRequiredToReachLevel(currentLevel + 1);
  }

  const currentLevelFloorXp = getXpRequiredToReachLevel(currentLevel);
  const progressInLevel = Math.max(0, totalXp - currentLevelFloorXp);
  const levelRange = Math.max(1, nextLevelXp - currentLevelFloorXp);

  return {
    totalXp,
    todayXp,
    todayTarget: XP_DAILY_TARGET,
    dailyCap: XP_DAILY_CAP,
    currentLevel,
    currentLevelFloorXp,
    nextLevelXp,
    progressInLevel,
    progressToNextLevel: Math.min(1, progressInLevel / levelRange),
  };
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

function movementFromSnapshot(entry: LeaderboardSnapshotEntry): LeaderboardMovement {
  return {
    delta: entry.movement,
    previousRank: entry.previousRank,
    direction: entry.movementDirection,
  };
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
}: {
  entry: LeaderboardEntry;
  rank: number;
  movement: LeaderboardMovement;
  tab: LeaderboardMetricTab;
}) {
  const bandana = getLeaderboardBandanaMeta(entry.currentStreak);
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
      className={`${styles.leaderboardRow} ${
        entry.isCurrentUser ? styles.leaderboardRowCurrentUser : ""
      }`}
      style={rowStyle}
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.34,
        delay: Math.min((rank - 1) * 0.045, 0.24),
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className={styles.leaderboardRowTop}>
        <div className={styles.leaderboardIdentity}>
          <div className={styles.leaderboardRankStack}>
            <div className={styles.leaderboardRankBadge}>#{rank}</div>
            <LeaderboardMovementIndicator movement={movement} tab={tab} />
          </div>
          <div className={styles.leaderboardIdentityCopy}>
            <div className={styles.leaderboardNameLine}>
              <WhelmProfileAvatar
                tierColor={bandana.tier?.color}
                size="mini"
                isPro={entry.isProStyle}
                photoUrl={entry.avatarUrl}
              />
              <strong>{entry.username}</strong>
              {entry.isCurrentUser ? <span className={styles.leaderboardYouBadge}>You</span> : null}
            </div>
            <div className={styles.leaderboardMetaRow}>
              <span className={styles.leaderboardBandanaChip}>{bandana.shortLabel}</span>
              {entry.isCurrentUser ? (
                <span className={styles.leaderboardCurrentUserAura}>Current account</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className={styles.leaderboardLevelPill}>Lv {entry.level}</div>
      </div>

      <div className={styles.leaderboardStatsGrid}>
        <div className={styles.leaderboardStat}>
          <span>Bandana</span>
          <strong>{bandana.label}</strong>
        </div>
        <div className={styles.leaderboardStat}>
          <span>Total XP</span>
          <strong>{formatLeaderboardXp(entry.totalXp)}</strong>
        </div>
        <div className={styles.leaderboardStat}>
          <span>Current streak</span>
          <strong>{entry.currentStreak}d</strong>
        </div>
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

function themeModeStorageKey(uid: string) {
  return `whelm:theme-mode:${uid}`;
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

function clearLocalAccountData(uid: string) {
  window.localStorage.removeItem(`whelm:notes:${uid}`);
  window.localStorage.removeItem(`whelm:sessions:${uid}`);
  window.localStorage.removeItem(plannedBlocksStorageKey(uid));
  window.localStorage.removeItem(dayToneStorageKey(uid));
  window.localStorage.removeItem(monthToneStorageKey(uid));
  window.localStorage.removeItem(senseiStyleStorageKey(uid));
  window.localStorage.removeItem(streakMirrorStorageKey(uid));
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
        tone: getCalendarToneMeta((item as Partial<PlannedBlock>).tone as CalendarTone | undefined)?.value,
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

function loadStreakMirrorEntries(uid: string): StreakMirrorEntry[] {
  try {
    const raw = window.localStorage.getItem(streakMirrorStorageKey(uid));
    const parsed = raw ? (JSON.parse(raw) as StreakMirrorEntry[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.dateKey === "string" &&
          typeof item.createdAtISO === "string" &&
          typeof item.updatedAtISO === "string" &&
          typeof item.tag === "string" &&
          item.answers &&
          typeof item.answers === "object",
      )
      .map((item) => ({
        ...item,
        tag: getStreakMirrorTagMeta(item.tag as StreakMirrorTag).value,
        source: "streak_save" as const,
        answers: Object.fromEntries(
          STREAK_SAVE_ACCOUNTABILITY_QUESTIONS.map((question) => [
            question,
            String(item.answers[question] ?? "").slice(0, 2500),
          ]),
        ),
      }))
      .sort((a, b) => (a.updatedAtISO < b.updatedAtISO ? 1 : -1));
  } catch {
    return [];
  }
}

function saveStreakMirrorEntries(uid: string, entries: StreakMirrorEntry[]) {
  window.localStorage.setItem(streakMirrorStorageKey(uid), JSON.stringify(entries));
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

function notesShellBackground(themeMode: ThemeMode, shellColor?: string, pageColor?: string) {
  return {
    ["--note-surface-tint" as const]:
      shellColor ?? (themeMode === "dark" ? "#182038" : "#fff7d6"),
    ["--note-page-tone" as const]:
      pageColor ?? (themeMode === "dark" ? "#182038" : "#fffaf0"),
  } as CSSProperties;
}

function backgroundSettingStorageKey(uid: string) {
  return `whelm:background-setting:${uid}`;
}

function backgroundSkinStorageKey(uid: string) {
  return `whelm:background-skin:${uid}`;
}

function loadBackgroundSetting(uid: string): AppBackgroundSetting {
  try {
    const raw = window.localStorage.getItem(backgroundSettingStorageKey(uid));
    if (!raw) return { kind: "default" };
    const parsed = JSON.parse(raw) as AppBackgroundSetting;
    if (parsed.kind === "preset" && typeof parsed.value === "string") return parsed;
    if (parsed.kind === "upload" && typeof parsed.value === "string") return parsed;
    return { kind: "default" };
  } catch {
    return { kind: "default" };
  }
}

function saveBackgroundSetting(uid: string, setting: AppBackgroundSetting) {
  window.localStorage.setItem(backgroundSettingStorageKey(uid), JSON.stringify(setting));
}

function loadBackgroundSkin(uid: string): BackgroundSkinSetting {
  try {
    const raw = window.localStorage.getItem(backgroundSkinStorageKey(uid));
    if (!raw) return DEFAULT_BACKGROUND_SKIN;
    const parsed = JSON.parse(raw) as Partial<BackgroundSkinSetting>;
    const mode = parsed.mode === "solid" ? "solid" : "glass";
    const dim = Math.min(0.96, Math.max(0.02, Number(parsed.dim) || DEFAULT_BACKGROUND_SKIN.dim));
    const surfaceOpacity = Math.min(
      0.98,
      Math.max(0.08, Number(parsed.surfaceOpacity) || DEFAULT_BACKGROUND_SKIN.surfaceOpacity),
    );
    const blur = Math.min(40, Math.max(0, Number(parsed.blur) || DEFAULT_BACKGROUND_SKIN.blur));
    const imageFit = parsed.imageFit === "fill" ? "fill" : "fit";
    return { mode, dim, surfaceOpacity, blur, imageFit };
  } catch {
    return DEFAULT_BACKGROUND_SKIN;
  }
}

function saveBackgroundSkin(uid: string, skin: BackgroundSkinSetting) {
  window.localStorage.setItem(backgroundSkinStorageKey(uid), JSON.stringify(skin));
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

const DESKTOP_PRIMARY_TABS: Array<{ key: AppTab; label: string }> = [
  { key: "calendar", label: "Schedule" },
  { key: "today", label: "Today" },
  { key: "notes", label: "Notes" },
  { key: "leaderboard", label: "Whelmboard" },
];

const MOBILE_PRIMARY_TABS: Array<{ key: AppTab; label: string }> = [
  { key: "calendar", label: "Schedule" },
  { key: "today", label: "Today" },
  { key: "notes", label: "Notes" },
  { key: "leaderboard", label: "Whelmboard" },
];

const MOBILE_MORE_TABS: AppTab[] = [
  "mirror",
  "streaks",
  "history",
  "reports",
  "settings",
];

const LEADERBOARD_SEED_DATA: ReadonlyArray<{
  id: string;
  username: string;
  totalXp: number;
  currentStreak: number;
  createdAtISO: string;
}> = [
  { id: "seed-1", username: "Astra Vale", totalXp: 28640, currentStreak: 123, createdAtISO: "2024-01-04T08:30:00.000Z" },
  { id: "seed-2", username: "Soren Pike", totalXp: 21480, currentStreak: 74, createdAtISO: "2024-01-12T12:15:00.000Z" },
  { id: "seed-3", username: "Mira Sol", totalXp: 18420, currentStreak: 33, createdAtISO: "2024-02-09T10:20:00.000Z" },
  { id: "seed-4", username: "Kael Mercer", totalXp: 15110, currentStreak: 18, createdAtISO: "2024-02-21T07:10:00.000Z" },
  { id: "seed-5", username: "Talia Reed", totalXp: 12340, currentStreak: 8, createdAtISO: "2024-03-03T09:45:00.000Z" },
  { id: "seed-6", username: "Juno Hart", totalXp: 9780, currentStreak: 4, createdAtISO: "2024-03-18T14:05:00.000Z" },
  { id: "seed-7", username: "Ren Kade", totalXp: 8325, currentStreak: 2, createdAtISO: "2024-04-06T16:25:00.000Z" },
  { id: "seed-8", username: "Ivo Lane", totalXp: 6940, currentStreak: 1, createdAtISO: "2024-04-19T11:50:00.000Z" },
  { id: "seed-9", username: "Nova Chen", totalXp: 5420, currentStreak: 57, createdAtISO: "2024-05-08T13:30:00.000Z" },
  { id: "seed-10", username: "Eden Cross", totalXp: 11960, currentStreak: 21, createdAtISO: "2024-05-12T15:40:00.000Z" },
] as const;

const LEADERBOARD_PREVIOUS_SNAPSHOT: ReadonlyArray<{
  id: string;
  username: string;
  totalXp: number;
  currentStreak: number;
  createdAtISO: string;
}> = [
  { id: "seed-1", username: "Astra Vale", totalXp: 27880, currentStreak: 121, createdAtISO: "2024-01-04T08:30:00.000Z" },
  { id: "seed-2", username: "Soren Pike", totalXp: 21310, currentStreak: 73, createdAtISO: "2024-01-12T12:15:00.000Z" },
  { id: "seed-3", username: "Mira Sol", totalXp: 18340, currentStreak: 31, createdAtISO: "2024-02-09T10:20:00.000Z" },
  { id: "seed-4", username: "Kael Mercer", totalXp: 14810, currentStreak: 17, createdAtISO: "2024-02-21T07:10:00.000Z" },
  { id: "seed-5", username: "Talia Reed", totalXp: 12180, currentStreak: 8, createdAtISO: "2024-03-03T09:45:00.000Z" },
  { id: "seed-6", username: "Juno Hart", totalXp: 9610, currentStreak: 4, createdAtISO: "2024-03-18T14:05:00.000Z" },
  { id: "seed-7", username: "Ren Kade", totalXp: 8250, currentStreak: 2, createdAtISO: "2024-04-06T16:25:00.000Z" },
  { id: "seed-8", username: "Ivo Lane", totalXp: 6895, currentStreak: 1, createdAtISO: "2024-04-19T11:50:00.000Z" },
  { id: "seed-9", username: "Nova Chen", totalXp: 5210, currentStreak: 54, createdAtISO: "2024-05-08T13:30:00.000Z" },
  { id: "seed-10", username: "Eden Cross", totalXp: 12040, currentStreak: 19, createdAtISO: "2024-05-12T15:40:00.000Z" },
] as const;

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

export default function HomePage() {
  "use no memo";

  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [notes, setNotes] = useState<WorkspaceNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [shellColorPickerOpen, setShellColorPickerOpen] = useState(false);
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
  const [isPro, setIsPro] = useState(true);
  const [proSource, setProSource] = useState<"preview" | "store" | "none">("preview");
  const [appBackgroundSetting, setAppBackgroundSetting] = useState<AppBackgroundSetting>({
    kind: "default",
  });
  const [backgroundSkin, setBackgroundSkin] = useState<BackgroundSkinSetting>(DEFAULT_BACKGROUND_SKIN);
  const [proPanelsOpen, setProPanelsOpen] = useState({
    notes: false,
    calendar: false,
    history: false,
    reports: false,
    background: false,
    mirror: false,
  });
  const [trendRange, setTrendRange] = useState<TrendRange>(7);
  const [activeTab, setActiveTab] = useState<AppTab>("calendar");
  const [leaderboardMetricTab, setLeaderboardMetricTab] = useState<LeaderboardMetricTab>("xp");
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardPageItems, setLeaderboardPageItems] = useState<LeaderboardSnapshotEntry[]>([]);
  const [leaderboardAroundMeItems, setLeaderboardAroundMeItems] = useState<LeaderboardSnapshotEntry[]>([]);
  const [leaderboardCursor, setLeaderboardCursor] = useState<string | null>(null);
  const [leaderboardHasMore, setLeaderboardHasMore] = useState(false);
  const [leaderboardSnapshotDate, setLeaderboardSnapshotDate] = useState<string | null>(null);
  const [leaderboardSource, setLeaderboardSource] = useState<LeaderboardPageResponse["source"]>("fallback");
  const [leaderboardTotalEntries, setLeaderboardTotalEntries] = useState(0);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [insightRange, setInsightRange] = useState<TrendRange>(30);
  const [insightMetric, setInsightMetric] = useState<InsightMetric>("focus");
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [selectedInsightCategory, setSelectedInsightCategory] = useState<NoteCategory | null>(
    null,
  );
  const [notesSearch, setNotesSearch] = useState("");
  const [notesCategoryFilter, setNotesCategoryFilter] = useState<"all" | NoteCategory>("all");
  const [plannedBlocks, setPlannedBlocks] = useState<PlannedBlock[]>([]);
  const [dayTones, setDayTones] = useState<DayToneMap>({});
  const [monthTones, setMonthTones] = useState<MonthToneMap>({});
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
  const [planTone, setPlanTone] = useState<CalendarTone | null>(null);
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
  const [selectedPlanDetailId, setSelectedPlanDetailId] = useState<string | null>(null);
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
  const [streakRulesOpen, setStreakRulesOpen] = useState(false);
  const [mirrorSectionsOpen, setMirrorSectionsOpen] = useState({
    summary: false,
    entries: false,
    detail: false,
  });
  const [mirrorPrivacyOpen, setMirrorPrivacyOpen] = useState(false);
  const [streakMirrorEntries, setStreakMirrorEntries] = useState<StreakMirrorEntry[]>([]);
  const [selectedStreakMirrorId, setSelectedStreakMirrorId] = useState<string | null>(null);
  const [streakMirrorTag, setStreakMirrorTag] = useState<StreakMirrorTag | null>(null);
  const [streakSaveAnswers, setStreakSaveAnswers] = useState<Record<string, string>>({});
  const [streakSaveStatus, setStreakSaveStatus] = useState("");
  const [milestoneRevealTier, setMilestoneRevealTier] = useState<StreakBandanaTier | null>(null);
  const [sessionReward, setSessionReward] = useState<SessionRewardState | null>(null);
  const [dailyPlanningPreviewOpen, setDailyPlanningPreviewOpen] = useState(false);
  const [mobileNotesRecentOpen, setMobileNotesRecentOpen] = useState(false);
  const [mobileNotesEditorOpen, setMobileNotesEditorOpen] = useState(false);
  const [mobileNotesToolsOpen, setMobileNotesToolsOpen] = useState<
    "format" | "type" | "color" | null
  >(null);
  const [mobileBlockSheetOpen, setMobileBlockSheetOpen] = useState(false);
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
  const reportsInsightToastRef = useRef<string | null>(null);
  const backgroundUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [mobileCalendarControlsOpen, setMobileCalendarControlsOpen] = useState(false);
  const [mobileAgendaEntriesOpen, setMobileAgendaEntriesOpen] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const syncInFlightRef = useRef(false);
  const notesRef = useRef<WorkspaceNote[]>([]);
  const selectedNoteIdRef = useRef<string | null>(null);
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
  const notesSectionRef = useRef<HTMLElement | null>(null);
  const notesStartRef = useRef<HTMLElement | null>(null);
  const notesRecentRef = useRef<HTMLElement | null>(null);
  const notesEditorRef = useRef<HTMLElement | null>(null);
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
  const appOpenTrackedRef = useRef<string | null>(null);
  const mobileDayTimelineScrollRef = useRef<HTMLDivElement | null>(null);
  const tabScrollPositionsRef = useRef<Partial<Record<AppTab, number>>>({});
  const lastTabTapRef = useRef<{ key: AppTab | "more"; at: number } | null>(null);
  const guidedRevealSeenRef = useRef<Partial<Record<AppTab, boolean>>>({});
  const previousActiveTabRef = useRef<AppTab | null>(null);
  const dayTimelineMotionRef = useRef<"guide" | "restore">("restore");
  const activeMotionCancelRef = useRef<(() => void) | null>(null);
  const authReadyRef = useRef(false);
  const activatedCalendarEntryTimeoutRef = useRef<number | null>(null);
  const calendarHoverPreviewTimeoutRef = useRef<number | null>(null);
  const previousStreakTierRef = useRef<StreakBandanaTier | null | undefined>(undefined);

  const protectedStreakDateKeys = useMemo(
    () => sickDaySaves.map((save) => save.dateKey),
    [sickDaySaves],
  );
  const sessionMinutesByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of sessions) {
      const key = dayKeyLocal(session.completedAtISO);
      map.set(key, (map.get(key) ?? 0) + session.minutes);
    }
    return map;
  }, [sessions]);
  const noteWordsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const note of notes) {
      const dateKey = dayKeyLocal(note.updatedAtISO);
      map.set(dateKey, (map.get(dateKey) ?? 0) + countWords(note.body));
    }
    return map;
  }, [notes]);
  const completedBlocksByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const block of plannedBlocks) {
      if (block.status !== "completed") continue;
      map.set(block.dateKey, (map.get(block.dateKey) ?? 0) + 1);
    }
    return map;
  }, [plannedBlocks]);
  const streakQualifiedDateKeys = useMemo(() => {
    const todayKey = dayKeyLocal(new Date());
    const qualifyingDays = new Set(protectedStreakDateKeys);

    for (const [dateKey, minutes] of sessionMinutesByDay.entries()) {
      if (dateKey < STREAK_RULE_V2_START_DATE) {
        qualifyingDays.add(dateKey);
        continue;
      }

      const completedBlocks = completedBlocksByDay.get(dateKey) ?? 0;
      const noteWords = noteWordsByDay.get(dateKey) ?? 0;
      if (dateKey <= todayKey && completedBlocks >= 1 && (minutes >= 30 || noteWords >= 33)) {
        qualifyingDays.add(dateKey);
      }
    }

    return [...qualifyingDays].sort();
  }, [completedBlocksByDay, noteWordsByDay, protectedStreakDateKeys, sessionMinutesByDay]);
  const streak = useMemo(
    () => computeStreak([], streakQualifiedDateKeys),
    [streakQualifiedDateKeys],
  );

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

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  );
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    selectedNoteIdRef.current = selectedNoteId;
  }, [selectedNoteId]);

  const selectedNoteSurfaceColor = isPro ? selectedNote?.shellColor : undefined;
  const selectedNotePageColor = isPro ? selectedNote?.color : undefined;
  const selectedNoteWordCount = selectedNote
    ? countWords(editorBodyDraft || selectedNote.body)
    : 0;

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
  const visibleNotes = useMemo(
    () =>
      isPro
        ? orderedNotes
        : orderedNotes.filter((note) =>
            isDateKeyWithinRecentWindow(dayKeyLocal(note.updatedAtISO), PRO_HISTORY_FREE_DAYS),
          ),
    [isPro, orderedNotes],
  );
  const hasLockedNotesHistory = useMemo(
    () =>
      !isPro &&
      orderedNotes.some(
        (note) => !isDateKeyWithinRecentWindow(dayKeyLocal(note.updatedAtISO), PRO_HISTORY_FREE_DAYS),
      ),
    [isPro, orderedNotes],
  );

  const filteredNotes = useMemo(() => {
    const query = notesSearch.trim().toLowerCase();
    return visibleNotes.filter((note) => {
      const categoryMatch =
        notesCategoryFilter === "all" || (note.category || "personal") === notesCategoryFilter;
      const textMatch =
        query.length === 0 ||
        note.title.toLowerCase().includes(query) ||
        note.body.toLowerCase().includes(query);
      return categoryMatch && textMatch;
    });
  }, [notesCategoryFilter, notesSearch, visibleNotes]);

  const dueReminderNotes = useMemo(() => {
    const todayKey = dayKeyLocal(new Date());
    return visibleNotes.filter((note) => {
      if (!note.reminderAtISO) return false;
      return dayKeyLocal(note.reminderAtISO) === todayKey;
    });
  }, [visibleNotes]);
  useEffect(() => {
    if (selectedNoteId && !visibleNotes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(visibleNotes[0]?.id ?? null);
    }
  }, [selectedNoteId, visibleNotes]);

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
      const response = await fetch(resolveApiUrl(path), {
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
        if (authReadyRef.current) {
          setAuthChecked(true);
        }
        return;
      }

      authReadyRef.current = true;
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
    let cancelled = false;

    const waitForAuthReady =
      typeof auth.authStateReady === "function" ? auth.authStateReady() : Promise.resolve();

    waitForAuthReady.catch(() => undefined).finally(() => {
      if (cancelled || authReadyRef.current) return;
      authReadyRef.current = true;
      setUser(auth.currentUser);
      setAuthChecked(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const loaded = loadPlannedBlocks(user.uid);
    setPlannedBlocks(loaded);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setDayTones(loadDayTones(user.uid));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setMonthTones(loadMonthTones(user.uid));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setAppBackgroundSetting(loadBackgroundSetting(user.uid));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setBackgroundSkin(loadBackgroundSkin(user.uid));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    saveBackgroundSetting(user.uid, appBackgroundSetting);
  }, [appBackgroundSetting, user]);

  useEffect(() => {
    if (!user) return;
    saveBackgroundSkin(user.uid, backgroundSkin);
  }, [backgroundSkin, user]);

  useEffect(() => {
    if (!user) return;
    const loaded = loadStreakMirrorEntries(user.uid);
    setStreakMirrorEntries(loaded);
    setSelectedStreakMirrorId(loaded[0]?.id ?? null);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setSickDaySaves(loadSickDaySaves(user.uid));
    setSickDaySaveDismissals(loadSickDaySaveDismissals(user.uid));
  }, [user]);

  useEffect(() => {
    const visible = isPro ? streakMirrorEntries : streakMirrorEntries.slice(0, 2);
    if (visible.length === 0) {
      setSelectedStreakMirrorId(null);
      return;
    }
    if (!selectedStreakMirrorId || !visible.some((entry) => entry.id === selectedStreakMirrorId)) {
      setSelectedStreakMirrorId(visible[0].id);
    }
  }, [isPro, selectedStreakMirrorId, streakMirrorEntries]);

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
    const dismissed = sickDaySaveDismissals.includes(yesterdayDateKey);

    if (yesterdayMissed && !yesterdayAlreadyProtected && priorRun > 0 && !dismissed) {
      setSickDaySavePromptOpen(true);
    }
  }, [sessions, sickDaySaveDismissals, sickDaySaves, user]);

  useEffect(() => {
    async function pullLatest() {
      if (!user || syncInFlightRef.current) return;
      if (notesSyncStatus !== "synced") return;
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
      if (document.visibilityState === "hidden") {
        void flushSelectedNoteDraft();
        return;
      }

      if (document.visibilityState === "visible") {
        void pullLatest();
      }
    }

    function onPageHide() {
      void flushSelectedNoteDraft();
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [editorBodyDraft, notesSyncStatus, selectedNote, user]);

  useEffect(() => {
    setColorPickerOpen(false);
    setTextColorPickerOpen(false);
    setHighlightPickerOpen(false);
  }, [selectedNoteId]);

  useEffect(() => {
    let nextHtml = selectedNote ? normalizeBodyForEditor(selectedNote.body) : "";

    if (user && selectedNote) {
      const localDraft = readLocalNoteDraft(user.uid, selectedNote.id);
      if (localDraft && localDraft.updatedAtISO >= selectedNote.updatedAtISO) {
        nextHtml = normalizeBodyForEditor(localDraft.body);
      }
    }

    setEditorBodyDraft(nextHtml);
  }, [selectedNote, selectedNoteId, user]);

  useEffect(() => {
    if (!editorRef.current) return;

    if (editorRef.current.innerHTML !== editorBodyDraft) {
      editorRef.current.innerHTML = editorBodyDraft;
    }
  }, [editorBodyDraft, selectedNoteId, isMobileViewport, mobileNotesEditorOpen]);

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

    const todayKey = dayKeyLocal(new Date());
    const previousStreak = computeStreak(sessions, protectedStreakDateKeys);
    const previousTodayXp =
      xpByDay.find((day) => day.dateKey === todayKey)?.totalXp ??
      buildDayXpSummaryForDate({
        dateKey: todayKey,
        sessionMinutesByDay,
        completedBlocksByDay,
        noteWordsByDay,
        streakQualifiedDateKeys,
      }).totalXp;
    const previousTotalXp = lifetimeXpSummary.totalXp;
    const previousLevel = lifetimeXpSummary.currentLevel;
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
    const nextSessionMinutesByDay = new Map(sessionMinutesByDay);
    nextSessionMinutesByDay.set(todayKey, (nextSessionMinutesByDay.get(todayKey) ?? 0) + minutesSpent);
    const todayFocusMinutesAfter = nextSessionMinutesByDay.get(todayKey) ?? 0;
    const todayCompletedBlocksAfter = completedBlocksByDay.get(todayKey) ?? 0;
    const todayNoteWordsAfter = noteWordsByDay.get(todayKey) ?? 0;
    const qualifiesTodayAfter = doesDateQualifyForStreak({
      dateKey: todayKey,
      focusMinutes: todayFocusMinutesAfter,
      completedBlocks: todayCompletedBlocksAfter,
      noteWords: todayNoteWordsAfter,
      todayKey,
      protectedDateKeys: protectedStreakDateKeys,
    });
    const nextQualifiedDateKeys = qualifiesTodayAfter
      ? [...new Set([...streakQualifiedDateKeys, todayKey])].sort()
      : streakQualifiedDateKeys;
    const nextTodaySummary = buildDayXpSummaryForDate({
      dateKey: todayKey,
      sessionMinutesByDay: nextSessionMinutesByDay,
      completedBlocksByDay,
      noteWordsByDay,
      streakQualifiedDateKeys: nextQualifiedDateKeys,
    });
    const nextTodayXp = nextTodaySummary.totalXp;
    const xpGained = Math.max(0, nextTodayXp - previousTodayXp);
    const nextTotalXp = previousTotalXp + xpGained;
    const nextLevel = getLifetimeXpSummary(nextTotalXp, nextTodayXp).currentLevel;
    const nextStreak = computeStreak(nextSessions, protectedStreakDateKeys);
    const previousTier = getStreakBandanaTier(previousStreak);
    const nextTier = getStreakBandanaTier(nextStreak);
    const tierUnlocked =
      nextTier && (previousTier?.minDays ?? 0) < nextTier.minDays ? nextTier : null;
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
      nextStreak,
      "session_completed",
      sessionContext?.sessionId ?? null,
    );
    setSenseiReaction(
      buildSenseiReaction({
        source: "timer",
        minutesSpent,
        todaySessions: countSessionsForDate(nextSessions, todayKey),
        streak: nextStreak,
      }),
    );
    setSessionReward({
      id: `${Date.now()}`,
      minutesSpent,
      xpGained,
      todayXp: nextTodayXp,
      streakAfter: nextStreak,
      streakDelta: Math.max(0, nextStreak - previousStreak),
      leveledUp: nextLevel > previousLevel,
      tierUnlocked,
    });
  }

  async function createWorkspaceNote() {
    if (!user) return null;

    const nextNote = createNote();
    const nextNotes = [nextNote, ...notesRef.current];
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    setSelectedNoteId(nextNote.id);
    setActiveTab("notes");
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
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
        | "shellColor"
        | "surfaceStyle"
        | "isPinned"
        | "fontFamily"
        | "fontSizePx"
        | "category"
        | "reminderAtISO"
      >
    >,
  ) {
    if (!user) return;

    const currentSelectedNoteId = selectedNoteIdRef.current;
    if (!currentSelectedNoteId) return;

    const now = new Date().toISOString();
    const nextNotes = notesRef.current.map((note) =>
      note.id === currentSelectedNoteId ? { ...note, ...patch, updatedAtISO: now } : note,
    );
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
    const result = await saveNotes(user, nextNotes);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }

  async function flushSelectedNoteDraft() {
    if (!user) return;

    const currentSelectedNoteId = selectedNoteIdRef.current;
    if (!currentSelectedNoteId) return;

    const currentNote = notesRef.current.find((note) => note.id === currentSelectedNoteId);
    if (!currentNote) return;

    const nextBody = editorRef.current?.innerHTML ?? editorBodyDraft;
    if (nextBody === currentNote.body) return;

    const now = new Date().toISOString();
    const nextNotes = notesRef.current.map((note) =>
      note.id === currentSelectedNoteId ? { ...note, body: nextBody, updatedAtISO: now } : note,
    );
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    writeLocalNoteDraft(user.uid, currentSelectedNoteId, nextBody, now);
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
    const result = await saveNotes(user, nextNotes);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }

  async function togglePinned(noteId: string) {
    if (!user) return;
    const target = notesRef.current.find((note) => note.id === noteId);
    if (!target) return;

    const now = new Date().toISOString();
    const nextNotes = notesRef.current.map((note) =>
      note.id === noteId
        ? { ...note, isPinned: !note.isPinned, updatedAtISO: now }
        : note,
    );
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
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

  useEffect(() => {
    if (!sessionReward) return;
    const timeoutId = window.setTimeout(() => {
      setSessionReward((current) => (current?.id === sessionReward.id ? null : current));
    }, 4200);
    return () => window.clearTimeout(timeoutId);
  }, [sessionReward]);

  function captureEditorDraft() {
    if (!editorRef.current) return;
    const nextBody = editorRef.current.innerHTML;
    setEditorBodyDraft(nextBody);

    const currentSelectedNoteId = selectedNoteIdRef.current;
    if (!user || !currentSelectedNoteId) return;

    const currentNote = notesRef.current.find((note) => note.id === currentSelectedNoteId);
    if (!currentNote || currentNote.body === nextBody) return;

    const now = new Date().toISOString();
    const nextNotes = notesRef.current.map((note) =>
      note.id === currentSelectedNoteId ? { ...note, body: nextBody, updatedAtISO: now } : note,
    );
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    writeLocalNoteDraft(user.uid, currentSelectedNoteId, nextBody, now);
    saveNotesLocally(user.uid, nextNotes);
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
    const deleted = notesRef.current.find((note) => note.id === noteId) || null;
    const nextNotes = notesRef.current.filter((note) => note.id !== noteId);
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    setSelectedNoteId((current) => (current === noteId ? nextNotes[0]?.id ?? null : current));
    clearLocalNoteDraft(user.uid, noteId);
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
    const result = await saveNotes(user, nextNotes);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
    setNoteUndoItem(deleted);
    window.setTimeout(() => setNoteUndoItem(null), 5000);
  }

  async function undoDeleteNote() {
    if (!user || !noteUndoItem) return;
    const restored = [noteUndoItem, ...notesRef.current];
    notesRef.current = restored;
    setNotes(restored);
    setSelectedNoteId(noteUndoItem.id);
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
    const result = await saveNotes(user, restored);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
    setNoteUndoItem(null);
  }

  async function handleRetrySync() {
    if (!user) return;
    setNotesSyncStatus("syncing");
    const result = await retryNotesSync(user, notesRef.current);

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
      const response = await fetch(resolveApiUrl("/api/feedback"), {
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
    const userLabel = user?.displayName || user?.email || "Whelm user";
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
    const code = window.prompt("Enter the Whelm Pro preview code.");
    if (code === null) return;
    if (code.trim() !== "1234") {
      window.alert("Incorrect preview code.");
      return;
    }
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
          resolveApiUrl(`/api/notes?uid=${encodeURIComponent(currentUser.uid)}`),
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
          resolveApiUrl(`/api/sessions?uid=${encodeURIComponent(currentUser.uid)}`),
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

  function scrollWindowToY(target: number, options?: { immediate?: boolean; duration?: number; onComplete?: () => void }) {
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
        return todaySectionRef.current;
      case "calendar":
        return calendarSectionRef.current;
      case "leaderboard":
        return leaderboardSectionRef.current;
      case "mirror":
        return mirrorSectionRef.current;
      case "notes":
        return notesSectionRef.current;
      case "history":
        return historySectionRef.current;
      case "reports":
        return reportsSectionRef.current;
      case "streaks":
        return streaksSectionRef.current;
      case "settings":
        return settingsSectionRef.current;
      default:
        return null;
    }
  }

  function primaryAnchorForTab(tab: AppTab) {
    switch (tab) {
      case "today":
        return todayTimerRef.current ?? todaySummaryRef.current;
      case "calendar":
        return calendarTimelineRef.current ?? calendarHeroRef.current ?? calendarMonthRef.current;
      case "leaderboard":
        return leaderboardPrimaryRef.current ?? leaderboardSectionRef.current;
      case "mirror":
        return mirrorEntriesAnchorRef.current ?? mirrorSectionRef.current;
      case "notes":
        return notesEditorRef.current ?? notesRecentRef.current ?? notesStartRef.current ?? notesSectionRef.current;
      case "history":
        return historyPrimaryRef.current ?? historySectionRef.current;
      case "reports":
        return reportsPrimaryRef.current ?? reportsSectionRef.current;
      case "streaks":
        return streaksPrimaryRef.current ?? streaksSectionRef.current;
      case "settings":
        return settingsPrimaryRef.current ?? settingsSectionRef.current;
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

  function scrollTabToTop(tab: AppTab) {
    cancelActiveMotion();
    if (tab === "calendar" && isMobileViewport) {
      const timelineContainer = mobileDayTimelineScrollRef.current ?? calendarTimelineRef.current;
      if (timelineContainer) {
        scrollElementToY(timelineContainer, 0, {
          duration: 320,
        });
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
    const container = mobileDayTimelineScrollRef.current;
    if (!container) return null;

    const targetMinute =
      currentTimeMarker?.minute ??
      dayViewTimeline.items[0]?.startMinute ??
      dayViewTimeline.startMinute;
    const relative =
      (targetMinute - dayViewTimeline.startMinute) / Math.max(1, dayViewTimeline.totalMinutes);
    const contentHeight = container.scrollHeight;
    const viewportHeight = container.clientHeight;
    return Math.max(0, relative * contentHeight - viewportHeight * 0.5);
  }

  function scrollCalendarTimelineToNow(options?: { immediate?: boolean; guided?: boolean }) {
    const container = mobileDayTimelineScrollRef.current;
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
  }

  function handleTabSelect(tab: AppTab | "more") {
    const now = Date.now();
    const previousTap = lastTabTapRef.current;
    const isDoubleTap =
      previousTap &&
      previousTap.key === tab &&
      now - previousTap.at < 360;

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
    const nextDateKey = normalizePlannableDateKey(options.dateKey);
    setSelectedCalendarDate(nextDateKey);
    setPlanTitle(options.title);
    setPlanNote(options.note);
    setPlanNoteExpanded(Boolean(options.note));
    setPlanTime(options.timeOfDay);
    setPlanDuration(options.durationMinutes);
    setPlanStatus(
      nextDateKey !== options.dateKey
        ? "Past dates stay read-only. This block was moved to today."
        : "",
    );
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
    const nextDateKey = normalizePlannableDateKey(dateKey);
    setSelectedCalendarDate(nextDateKey);
    setActiveTab("calendar");
    setCalendarView("day");
    setMobileBlockSheetOpen(true);
    setDayPortalComposerOpen(true);
    setPlanStatus(
      nextDateKey !== dateKey
        ? "Past dates stay read-only. Add the block to today or a future day."
        : "",
    );
    setPlanConflictWarning(null);
  }

  function openSickDaySaveReview() {
    setSickDaySavePromptOpen(false);
    setSickDaySavePromptPreview(false);
    if (sickDaySaveEligible) {
      openStreakSaveQuestionnaire();
      return;
    }
    setActiveTab("mirror");
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
    setStreakMirrorTag(null);
    setStreakSaveStatus("");
    setStreakSaveQuestionnairePreview(false);
    setStreakSaveQuestionnaireOpen(true);
  }

  function openStreakSaveQuestionnairePreview() {
    setStreakSaveAnswers({});
    setStreakMirrorTag(null);
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
    setStreakMirrorTag(null);
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
    const incompleteQuestion = STREAK_SAVE_ACCOUNTABILITY_QUESTIONS.find((question) => {
      const answer = streakSaveAnswers[question]?.trim() ?? "";
      return countWords(answer) < STREAK_MIRROR_MIN_WORDS;
    });
    if (incompleteQuestion) {
      setStreakSaveStatus(`Each reflection needs at least ${STREAK_MIRROR_MIN_WORDS} words.`);
      return;
    }
    if (!streakMirrorTag) {
      setStreakSaveStatus("Choose the pattern tag that best describes the miss.");
      return;
    }
    if (monthlyStreakSaveCount >= STREAK_SAVE_MONTHLY_LIMIT) {
      setStreakSaveStatus("This month has already used all 5 streak saves.");
      return;
    }

    const normalizedAnswers = Object.fromEntries(
      STREAK_SAVE_ACCOUNTABILITY_QUESTIONS.map((question) => [
        question,
        (streakSaveAnswers[question] ?? "").trim(),
      ]),
    );

    const previousStreak = computeStreak(sessions, protectedStreakDateKeys);
    const nowIso = new Date().toISOString();
    const nextSave: SickDaySave = {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`,
      dateKey: yesterdayKey,
      claimedAtISO: nowIso,
      reason: "sick",
    };
    const nextSaves = [nextSave, ...sickDaySaves.filter((save) => save.dateKey !== yesterdayKey)].sort((a, b) =>
      a.claimedAtISO < b.claimedAtISO ? 1 : -1,
    );
    const nextMirrorEntry: StreakMirrorEntry = {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-mirror`,
      dateKey: yesterdayKey,
      createdAtISO: nowIso,
      updatedAtISO: nowIso,
      tag: streakMirrorTag,
      answers: normalizedAnswers,
      source: "streak_save",
    };
    const nextMirrorEntries = [nextMirrorEntry, ...streakMirrorEntries].sort((a, b) =>
      a.updatedAtISO < b.updatedAtISO ? 1 : -1,
    );
    setSickDaySaves(nextSaves);
    setStreakMirrorEntries(nextMirrorEntries);
    setSelectedStreakMirrorId(nextMirrorEntry.id);
    saveSickDaySaves(user.uid, nextSaves);
    saveStreakMirrorEntries(user.uid, nextMirrorEntries);
    trackStreakChange(
      previousStreak,
      computeStreak(sessions, nextSaves.map((save) => save.dateKey)),
      "sick_day_save",
      null,
      yesterdayKey,
    );
    setSickDaySavePromptOpen(false);
    setStreakSaveQuestionnaireOpen(false);
    setStreakMirrorTag(null);
    setStreakSaveStatus("");
    setActiveTab("mirror");
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
    handleTabSelect(tab);
  }

  async function handleLeaderboardLoadMore() {
    if (!user || !leaderboardHasMore || !leaderboardCursor) return;
    setLeaderboardLoading(true);
    setLeaderboardError("");

    try {
      const token = await user.getIdToken();
      const url = new URL(resolveApiUrl("/api/leaderboard"), window.location.origin);
      url.searchParams.set("metric", leaderboardMetricTab);
      url.searchParams.set("limit", "20");
      url.searchParams.set("userId", user.uid);
      url.searchParams.set("cursor", leaderboardCursor);
      url.searchParams.set("aroundWindow", "2");

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const body = (await response.json()) as LeaderboardPageResponse | { error?: string };
      if (!response.ok) {
        throw new Error(("error" in body && body.error) || "Failed to load more leaderboard entries.");
      }

      const payload = body as LeaderboardPageResponse;
      setLeaderboardPageItems((current) => [...current, ...payload.items]);
      setLeaderboardCursor(payload.nextCursor);
      setLeaderboardHasMore(payload.hasMore);
      setLeaderboardSnapshotDate(payload.snapshotDate);
      setLeaderboardSource(payload.source);
      setLeaderboardTotalEntries(payload.totalEntries);

      void trackLeaderboardPageLoaded(user, {
        metric: leaderboardMetricTab,
        pageSize: payload.items.length,
        cursor: leaderboardCursor,
        snapshotDate: payload.snapshotDate,
      }).catch(() => undefined);
    } catch (error: unknown) {
      setLeaderboardError(
        error instanceof Error ? error.message : "Failed to load more leaderboard entries.",
      );
    } finally {
      setLeaderboardLoading(false);
    }
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
    });
  }

  const selectedDateKey = selectedCalendarDate || dayKeyLocal(new Date());
  const selectedDateCanAddBlocks = !isDateKeyBeforeToday(selectedDateKey);
  const selectedCalendarMonthKey = monthKeyLocal(calendarCursor);
  const selectedMonthTone = isPro ? (monthTones[selectedCalendarMonthKey] ?? null) : null;
  const calendarMonthLabel = calendarCursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const calendarMonthInput = monthInputFromDate(calendarCursor);
  const historicalStreaksByDay = useMemo(
    () => computeHistoricalStreaks([], streakQualifiedDateKeys),
    [streakQualifiedDateKeys],
  );
  const xpByDay = useMemo(() => {
    const allDayKeys = new Set<string>();
    const todayKey = dayKeyLocal(new Date());

    for (const key of sessionMinutesByDay.keys()) {
      if (key <= todayKey) allDayKeys.add(key);
    }
    for (const key of noteWordsByDay.keys()) {
      if (key <= todayKey) allDayKeys.add(key);
    }
    for (const key of completedBlocksByDay.keys()) {
      if (key <= todayKey) allDayKeys.add(key);
    }
    for (const key of protectedStreakDateKeys) {
      if (key <= todayKey) allDayKeys.add(key);
    }

    return [...allDayKeys]
      .sort()
      .map<DayXpSummary>((dateKey) =>
        buildDayXpSummaryForDate({
          dateKey,
          sessionMinutesByDay,
          completedBlocksByDay,
          noteWordsByDay,
          streakQualifiedDateKeys,
        }),
      );
  }, [
    completedBlocksByDay,
    noteWordsByDay,
    streakQualifiedDateKeys,
    sessionMinutesByDay,
  ]);
  const lifetimeXpSummary = useMemo(() => {
    const totalXp = xpByDay.reduce((sum, day) => sum + day.totalXp, 0);
    const todayKey = dayKeyLocal(new Date());
    const todayXp = xpByDay.find((day) => day.dateKey === todayKey)?.totalXp ?? 0;
    return getLifetimeXpSummary(totalXp, todayXp);
  }, [xpByDay]);
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
      visible: sameDate.filter(
        (item) => item.status === "completed" || !isDateKeyBeforeToday(item.dateKey),
      ),
    };
  }, [isPro, plannedBlocks, selectedDateKey]);
  const selectedDatePlans = selectedDatePlanGroups.active;
  const selectedDateDayTone = isPro ? (dayTones[selectedDateKey] ?? null) : null;
  const visiblePlanTone = (tone: CalendarTone | null | undefined) => (isPro ? (tone ?? null) : null);
  const plannedBlockById = useMemo(
    () => new Map(plannedBlocks.map((item) => [item.id, item])),
    [plannedBlocks],
  );
  const selectedPlanDetail = selectedPlanDetailId
    ? plannedBlockById.get(selectedPlanDetailId) ?? null
    : null;
  useEffect(() => {
    if (selectedPlanDetailId && !plannedBlockById.has(selectedPlanDetailId)) {
      setSelectedPlanDetailId(null);
    }
  }, [plannedBlockById, selectedPlanDetailId]);
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
      if (item.status === "active" && isDateKeyBeforeToday(item.dateKey)) return;
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
    const shouldGuide =
      isMobileViewport &&
      savedTop == null &&
      !hasSeenGuidedReveal;

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
    if (!selectedDateCanAddBlocks) {
      setPlanStatus("Past dates stay read-only. Blocks can only be added to today or a future day.");
      return false;
    }
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
      tone: isPro ? planTone ?? undefined : undefined,
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
    setPlanTone(null);
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
    if (isDateKeyBeforeToday(block.dateKey)) {
      setPlanStatus("Past dates stay read-only. This block can no longer be rescheduled there.");
      return;
    }
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

  useEffect(() => {
    setPlanTone(null);
  }, [selectedDateKey]);

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

  function applyBackgroundSetting(nextSetting: AppBackgroundSetting) {
    setAppBackgroundSetting(nextSetting);
  }

  function openPlannedBlockDetail(blockId: string) {
    setSelectedPlanDetailId(blockId);
  }

  function closePlannedBlockDetail() {
    setSelectedPlanDetailId(null);
  }

  function applyDayTone(dateKey: string, tone: CalendarTone | null) {
    if (!user || !isPro) return;
    const next = { ...dayTones };
    if (tone) {
      next[dateKey] = tone;
    } else {
      delete next[dateKey];
    }
    setDayTones(next);
    saveDayTones(user.uid, next);
  }

  function applyMonthTone(monthKey: string, tone: CalendarTone | null) {
    if (!user || !isPro) return;
    const next = { ...monthTones };
    if (tone) {
      next[monthKey] = tone;
    } else {
      delete next[monthKey];
    }
    setMonthTones(next);
    saveMonthTones(user.uid, next);
  }

  function updatePlannedBlockTone(id: string, tone: CalendarTone | null) {
    if (!user || !isPro) return;
    const updated = plannedBlocks.map((item) =>
      item.id === id ? { ...item, tone: tone ?? undefined } : item,
    );
    setPlannedBlocks(updated);
    savePlannedBlocks(user.uid, updated);
  }

  function handleBackgroundUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !isPro) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        applyBackgroundSetting({ kind: "upload", value: reader.result });
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function updateDailyRitualDraft(
    draftId: string,
    patch: Partial<
      Pick<DailyRitualBlockDraft, "title" | "note" | "tone" | "timeOfDay" | "durationMinutes">
    >,
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
        tone: isPro ? draft.tone ?? undefined : undefined,
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

  useEffect(() => {
    return () => {
      cancelActiveMotion();
    };
  }, []);

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
  const todayKey = dayKeyLocal(new Date());
  const yesterdayKey = dayKeyLocal(addDays(startOfDayLocal(new Date()), -1));
  const dayBeforeYesterdayKey = dayKeyLocal(addDays(startOfDayLocal(new Date()), -2));
  const todayLabel = new Date().toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
  const todaySessionNoteCount = sessions.filter((session) => {
    return dayKeyLocal(session.completedAtISO) === todayKey && Boolean(session.note?.trim());
  }).length;
  const todayCompletedBlocksCount = completedBlocksByDay.get(todayKey) ?? 0;
  const todayFocusMinutes = sessionMinutesByDay.get(todayKey) ?? 0;
  const todayNoteWords = noteWordsByDay.get(todayKey) ?? 0;
  const currentMonthKey = monthKeyLocal(new Date());
  const monthlyStreakSaveCount = sickDaySaves.filter(
    (save) => monthKeyLocal(save.claimedAtISO) === currentMonthKey,
  ).length;
  const streakSaveSlotsLeft = Math.max(0, STREAK_SAVE_MONTHLY_LIMIT - monthlyStreakSaveCount);
  const todayMinutesProgress = Math.min(30, todayFocusMinutes);
  const todayWordsProgress = Math.min(33, todayNoteWords);
  const hasEarnedToday = streakQualifiedDateKeys.includes(todayKey);
  const yesterdaySave = sickDaySaves.find((save) => save.dateKey === yesterdayKey) ?? null;
  const rawYesterdayMissed = !streakQualifiedDateKeys.includes(yesterdayKey);
  const priorRunBeforeYesterday = computeStreakEndingAtDateKey(
    [],
    dayBeforeYesterdayKey,
    streakQualifiedDateKeys,
  );
  const monthlySaveLimitReached = monthlyStreakSaveCount >= STREAK_SAVE_MONTHLY_LIMIT;
  const sickDaySaveEligible =
    rawYesterdayMissed &&
    priorRunBeforeYesterday > 0 &&
    !yesterdaySave &&
    !monthlySaveLimitReached &&
    !sickDaySaveDismissals.includes(yesterdayKey);
  const carriedRunThroughYesterday = computeStreakEndingAtDateKey(
    [],
    yesterdayKey,
    streakQualifiedDateKeys,
  );
  const displayStreak = hasEarnedToday ? streak : carriedRunThroughYesterday;
  const streakBandanaTier = getStreakBandanaTier(displayStreak);
  const xpTierTheme = getStreakTierColorTheme(streakBandanaTier?.color);
  const xpDockStyle = {
    "--xp-accent": xpTierTheme.accent,
    "--xp-accent-strong": xpTierTheme.accentStrong,
    "--xp-accent-deep": xpTierTheme.accentDeep,
    "--xp-accent-glow": xpTierTheme.accentGlow,
    "--xp-shell": xpTierTheme.shell,
    "--xp-text-strong": xpTierTheme.textStrong,
    "--xp-text-soft": xpTierTheme.textSoft,
  } as CSSProperties;
  const mobileStreakJumpStyle = {
    "--mobile-streak-accent": xpTierTheme.accent,
    "--mobile-streak-accent-strong": xpTierTheme.accentStrong,
    "--mobile-streak-accent-deep": xpTierTheme.accentDeep,
    "--mobile-streak-glow": xpTierTheme.accentGlow,
    "--mobile-streak-text": xpTierTheme.textStrong,
  } as CSSProperties;
  const profileTierTheme = getProfileTierTheme(streakBandanaTier?.color, isPro);
  const profileDisplayName =
    user?.displayName?.trim() ||
    user?.email?.split("@")[0]?.trim() ||
    "Whelm user";
  useEffect(() => {
    if (!authChecked || !user) return;

    const previousTier = previousStreakTierRef.current;
    if (previousTier === undefined) {
      previousStreakTierRef.current = streakBandanaTier;
      return;
    }

    const previousThreshold = previousTier?.minDays ?? 0;
    const nextThreshold = streakBandanaTier?.minDays ?? 0;

    if (streakBandanaTier && nextThreshold > previousThreshold) {
      setMilestoneRevealTier(streakBandanaTier);
    }

    previousStreakTierRef.current = streakBandanaTier;
  }, [authChecked, streakBandanaTier, user]);

  const currentUserPhotoUrl = user?.photoURL ?? null;
  const currentUserId = user?.uid ?? "current-user";
  const currentUserCreatedAtISO =
    user?.metadata.creationTime ? new Date(user.metadata.creationTime).toISOString() : new Date().toISOString();
  const leaderboardEntries = useMemo<LeaderboardEntry[]>(() => {
    const seeded = LEADERBOARD_SEED_DATA.map((entry) => ({
      id: entry.id,
      username: entry.username,
      createdAtISO: entry.createdAtISO,
      totalXp: entry.totalXp,
      currentStreak: entry.currentStreak,
      level: getLifetimeXpSummary(entry.totalXp, 0).currentLevel,
    }));

    const currentEntry: LeaderboardEntry = {
      id: currentUserId,
      username: profileDisplayName,
      createdAtISO: currentUserCreatedAtISO,
      level: lifetimeXpSummary.currentLevel,
      totalXp: lifetimeXpSummary.totalXp,
      currentStreak: displayStreak,
      avatarUrl: currentUserPhotoUrl,
      isProStyle: isPro,
      isCurrentUser: true,
    };

    return [...seeded, currentEntry];
  }, [currentUserCreatedAtISO, currentUserId, currentUserPhotoUrl, displayStreak, isPro, lifetimeXpSummary.currentLevel, lifetimeXpSummary.totalXp, profileDisplayName]);
  const leaderboardPreviousSnapshotEntries = useMemo<LeaderboardEntry[]>(() => {
    const seeded = LEADERBOARD_PREVIOUS_SNAPSHOT.map((entry) => ({
      id: entry.id,
      username: entry.username,
      createdAtISO: entry.createdAtISO,
      totalXp: entry.totalXp,
      currentStreak: entry.currentStreak,
      level: getLifetimeXpSummary(entry.totalXp, 0).currentLevel,
    }));

    const currentEntry: LeaderboardEntry = {
      id: currentUserId,
      username: profileDisplayName,
      createdAtISO: currentUserCreatedAtISO,
      level: getLifetimeXpSummary(Math.max(0, lifetimeXpSummary.totalXp - 420), 0).currentLevel,
      totalXp: Math.max(0, lifetimeXpSummary.totalXp - 420),
      currentStreak: Math.max(0, displayStreak - 1),
      avatarUrl: currentUserPhotoUrl,
      isProStyle: isPro,
      isCurrentUser: true,
    };

    return [...seeded, currentEntry];
  }, [currentUserCreatedAtISO, currentUserId, currentUserPhotoUrl, displayStreak, isPro, lifetimeXpSummary.totalXp, profileDisplayName]);
  const leaderboardSortedEntries = useMemo(
    () => [...leaderboardEntries].sort((left, right) => compareLeaderboardEntries(left, right, leaderboardMetricTab)),
    [leaderboardEntries, leaderboardMetricTab],
  );
  const leaderboardPreviousRankMaps = useMemo(() => {
    const xp = new Map<string, number>();
    [...leaderboardPreviousSnapshotEntries]
      .sort((left, right) => compareLeaderboardEntries(left, right, "xp"))
      .forEach((entry, index) => xp.set(entry.id, index + 1));

    const streak = new Map<string, number>();
    [...leaderboardPreviousSnapshotEntries]
      .sort((left, right) => compareLeaderboardEntries(left, right, "streak"))
      .forEach((entry, index) => streak.set(entry.id, index + 1));

    return { xp, streak };
  }, [leaderboardPreviousSnapshotEntries]);
  const leaderboardFallbackRows = useMemo(
    () =>
      leaderboardSortedEntries.map((entry, index) => ({
        entry,
        rank: index + 1,
        movement: movementForRanks(
          index + 1,
          leaderboardPreviousRankMaps[leaderboardMetricTab].get(entry.id) ?? null,
        ),
      })),
    [leaderboardMetricTab, leaderboardPreviousRankMaps, leaderboardSortedEntries],
  );
  const leaderboardRemoteRows = useMemo(
    () =>
      leaderboardPageItems.map((entry) => ({
        entry: {
          id: entry.userId,
          username: entry.username,
          createdAtISO: entry.createdAtISO,
          totalXp: entry.totalXp,
          currentStreak: entry.currentStreak,
          level: entry.level,
          avatarUrl: entry.userId === currentUserId ? currentUserPhotoUrl : null,
          isProStyle: entry.userId === currentUserId ? isPro : false,
          isCurrentUser: entry.userId === currentUserId,
        },
        rank: entry.rank,
        movement: movementFromSnapshot(entry),
      })),
    [currentUserId, currentUserPhotoUrl, isPro, leaderboardPageItems],
  );
  const leaderboardAroundRows = useMemo(
    () =>
      leaderboardAroundMeItems.map((entry) => ({
        entry: {
          id: entry.userId,
          username: entry.username,
          createdAtISO: entry.createdAtISO,
          totalXp: entry.totalXp,
          currentStreak: entry.currentStreak,
          level: entry.level,
          avatarUrl: entry.userId === currentUserId ? currentUserPhotoUrl : null,
          isProStyle: entry.userId === currentUserId ? isPro : false,
          isCurrentUser: entry.userId === currentUserId,
        },
        rank: entry.rank,
        movement: movementFromSnapshot(entry),
      })),
    [currentUserId, currentUserPhotoUrl, isPro, leaderboardAroundMeItems],
  );
  const leaderboardRows =
    leaderboardSource === "snapshot" && leaderboardRemoteRows.length > 0
      ? leaderboardRemoteRows
      : leaderboardFallbackRows;
  const leaderboardCurrentUserRank =
    (leaderboardSource === "snapshot" && leaderboardAroundRows.find((row) => row.entry.isCurrentUser)?.rank) ??
    leaderboardRows.find((row) => row.entry.isCurrentUser)?.rank ??
    0;
  const leaderboardCurrentUserMovement =
    (leaderboardSource === "snapshot"
      ? leaderboardAroundRows.find((row) => row.entry.isCurrentUser)?.movement
      : undefined) ??
    leaderboardRows.find((row) => row.entry.isCurrentUser)?.movement ?? {
      delta: 0,
      previousRank: null,
      direction: "same" as const,
    };
  const leaderboardLeader = leaderboardRows[0]?.entry ?? null;
  const leaderboardLeaderBandana = leaderboardLeader
    ? getLeaderboardBandanaMeta(leaderboardLeader.currentStreak)
    : null;
  const leaderboardPodiumRows = leaderboardRows.slice(0, 3);
  const leaderboardBandanaHolders = useMemo<LeaderboardBandanaHolder[]>(() => {
    const sourceEntries =
      leaderboardSource === "snapshot" && leaderboardPageItems.length > 0
        ? leaderboardPageItems.map((entry) => ({
            id: entry.userId,
            username: entry.username,
            createdAtISO: entry.createdAtISO,
            totalXp: entry.totalXp,
            currentStreak: entry.currentStreak,
            level: entry.level,
            avatarUrl: entry.userId === currentUserId ? currentUserPhotoUrl : null,
            isProStyle: entry.userId === currentUserId ? isPro : false,
          }))
        : leaderboardEntries;

    return STREAK_BANDANA_TIERS.map((tier) => {
      const topEntry =
        [...sourceEntries]
          .filter((entry) => getStreakBandanaTier(entry.currentStreak)?.color === tier.color)
          .sort((left, right) => compareLeaderboardEntries(left, right, "xp"))[0] ?? null;

      return {
        color: tier.color,
        label: `Top ${tier.label.replace(" Bandana", "")}`,
        entry: topEntry,
      };
    });
  }, [currentUserId, currentUserPhotoUrl, isPro, leaderboardEntries, leaderboardPageItems, leaderboardSource]);
  const leaderboardHasEntries = leaderboardRows.length > 0;
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

  useEffect(() => {
    if (activeTab !== "leaderboard") return;
    const currentUser = user;
    if (!currentUser) return;
    const authedUser = currentUser;

    const controller = new AbortController();

    async function syncLeaderboardProfile() {
      try {
        const token = await authedUser.getIdToken();
        await fetch(resolveApiUrl("/api/leaderboard/profile"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: authedUser.uid,
            username: profileDisplayName,
            totalXp: lifetimeXpSummary.totalXp,
            currentStreak: displayStreak,
            level: lifetimeXpSummary.currentLevel,
            createdAtISO: authedUser.metadata.creationTime
              ? new Date(authedUser.metadata.creationTime).toISOString()
              : new Date().toISOString(),
          }),
          signal: controller.signal,
        });
      } catch {
        // Ignore sync failures and keep the current leaderboard UI available.
      }
    }

    void syncLeaderboardProfile();
    return () => controller.abort();
  }, [
    activeTab,
    displayStreak,
    lifetimeXpSummary.currentLevel,
    lifetimeXpSummary.totalXp,
    profileDisplayName,
    user,
  ]);

  useEffect(() => {
    if (activeTab !== "leaderboard") return;
    const currentUser = user;
    if (!currentUser) return;
    const authedUser = currentUser;

    let cancelled = false;

    async function loadLeaderboard() {
      setLeaderboardLoading(true);
      setLeaderboardError("");

      try {
        const token = await authedUser.getIdToken();
        const url = new URL(resolveApiUrl("/api/leaderboard"), window.location.origin);
        url.searchParams.set("metric", leaderboardMetricTab);
        url.searchParams.set("limit", "20");
        url.searchParams.set("userId", authedUser.uid);
        url.searchParams.set("aroundWindow", "2");

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const body = (await response.json()) as LeaderboardPageResponse | { error?: string };
        if (!response.ok) {
          throw new Error(("error" in body && body.error) || "Failed to load leaderboard.");
        }

        if (cancelled) return;
        const payload = body as LeaderboardPageResponse;
        setLeaderboardPageItems(payload.items);
        setLeaderboardAroundMeItems(payload.aroundMe);
        setLeaderboardCursor(payload.nextCursor);
        setLeaderboardHasMore(payload.hasMore);
        setLeaderboardSnapshotDate(payload.snapshotDate);
        setLeaderboardSource(payload.source);
        setLeaderboardTotalEntries(payload.totalEntries);

        void trackLeaderboardPageLoaded(authedUser, {
          metric: leaderboardMetricTab,
          pageSize: payload.items.length,
          cursor: null,
          snapshotDate: payload.snapshotDate,
        }).catch(() => undefined);

        if (payload.aroundMe.length > 0) {
          void trackLeaderboardAroundMeLoaded(authedUser, {
            metric: leaderboardMetricTab,
            anchorRank:
              payload.aroundMe.find((entry) => entry.userId === authedUser.uid)?.rank ??
              payload.aroundMe[0].rank,
            resultCount: payload.aroundMe.length,
            snapshotDate: payload.snapshotDate,
          }).catch(() => undefined);
        }
      } catch (error: unknown) {
        if (cancelled) return;
        setLeaderboardPageItems([]);
        setLeaderboardAroundMeItems([]);
        setLeaderboardCursor(null);
        setLeaderboardHasMore(false);
        setLeaderboardSnapshotDate(null);
        setLeaderboardSource("fallback");
        setLeaderboardTotalEntries(0);
        setLeaderboardError(error instanceof Error ? error.message : "Failed to load leaderboard.");
      } finally {
        if (!cancelled) {
          setLeaderboardLoading(false);
        }
      }
    }

    void loadLeaderboard();
    return () => {
      cancelled = true;
    };
  }, [activeTab, leaderboardMetricTab, user]);

  useEffect(() => {
    if (activeTab !== "leaderboard") return;
    const currentUser = user;
    if (!currentUser) return;
    void trackLeaderboardViewed(currentUser, {
      metric: leaderboardMetricTab,
      snapshotDate: leaderboardSnapshotDate,
    }).catch(() => undefined);
  }, [activeTab, leaderboardMetricTab, leaderboardSnapshotDate, user]);

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

  const formattedLifetimeXp = lifetimeXpSummary.totalXp.toLocaleString();
  const formattedXpToNextLevel = Math.max(
    0,
    lifetimeXpSummary.nextLevelXp - lifetimeXpSummary.totalXp,
  ).toLocaleString();
  const nextBandanaMilestone = buildNextBandanaMilestone(displayStreak, !hasEarnedToday);
  const longestStreak = Math.max(0, ...Array.from(historicalStreaksByDay.values()));
  const lifetimeFocusMinutes = sessions.reduce((sum, session) => sum + session.minutes, 0);
  const streakMinutesLeft = Math.max(0, 30 - todayFocusMinutes);
  const streakWordsLeft = Math.max(0, 33 - todayNoteWords);
  const streakBlocksLeft = Math.max(0, 1 - todayCompletedBlocksCount);
  const streakEffortRequirementMet = todayFocusMinutes >= 30 || todayNoteWords >= 33;
  const streakRuleV2ActiveToday = todayKey >= STREAK_RULE_V2_START_DATE;
  const streakProtectedToday = hasEarnedToday;
  const streakProgressMinutesLabel = `${todayMinutesProgress}/30 focus minutes`;
  const streakProgressBlocksLabel = `${Math.min(todayCompletedBlocksCount, 1)}/1 completed block`;
  const streakProgressWordsLabel = `${todayWordsProgress}/33 note words`;
  const streakStatusLine = streakProtectedToday
    ? streakRuleV2ActiveToday
      ? `Congratulations. ${todayLabel} is protected and your streak is secured for today.`
      : `${todayLabel} already counts toward your streak. The stricter rule starts on March 22.`
    : streakBlocksLeft > 0 && streakEffortRequirementMet
      ? `${todayLabel} is not protected yet. You met the focus or writing requirement. Complete 1 block to secure the streak.`
      : streakBlocksLeft === 0
        ? `${todayLabel} is not protected yet. Your block is done. Finish ${streakMinutesLeft} more focus minute${streakMinutesLeft === 1 ? "" : "s"} or write ${streakWordsLeft} more note word${streakWordsLeft === 1 ? "" : "s"}.`
        : `${todayLabel} is not protected yet. Complete 1 block and either reach 30 focus minutes or write 33 note words.`;
  const streakRuleSummaryLine = streakRuleV2ActiveToday
    ? "A streak day needs 1 completed block and either 30 focus minutes or 33 note words."
    : "Your previous streak days stay unchanged. The new stricter rule starts on March 22.";
  const streakMirrorVisibleEntries = isPro
    ? streakMirrorEntries
    : streakMirrorEntries.slice(0, 2);
  const selectedStreakMirrorEntry =
    streakMirrorVisibleEntries.find((entry) => entry.id === selectedStreakMirrorId) ??
    streakMirrorVisibleEntries[0] ??
    null;
  const streakMirrorSaying =
    STREAK_MIRROR_SAYINGS[landingWisdomMinute % STREAK_MIRROR_SAYINGS.length];
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
  const analyticsLeadInsight = analyticsInsights[0] ?? null;
  const analyticsLeadSubject = analyticsTopSubjects.find((subject) => subject.focusMinutes > 0) ?? null;
  const analyticsLeadNotification = analyticsNotificationPlan?.notifications[0] ?? null;
  const streakHeroEmoteId: WhelmEmoteId =
    streak >= 100 ? "whelm.proud" : streak >= 50 ? "whelm.ready" : "whelm.encourage";
  const effectiveBackgroundSetting = isPro ? appBackgroundSetting : { kind: "default" as const };
  const backgroundSkinActive =
    isPro && effectiveBackgroundSetting.kind !== "default" && backgroundSkin.mode === "glass";
  const pageShellBackgroundStyle = getPageShellBackgroundStyle(
    themeMode,
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

  return (
    <main
      className={`${styles.pageShell} ${
        themeMode === "light" ? styles.themeLight : styles.themeDark
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
              <motion.div
                className={styles.xpDock}
                style={xpDockStyle}
                aria-label={`Level ${lifetimeXpSummary.currentLevel}. ${formattedLifetimeXp} XP total. ${formattedXpToNextLevel} XP to next level.`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <XpBandanaLevelMark
                  className={styles.xpDockBadge}
                  tierColor={streakBandanaTier?.color}
                  level={lifetimeXpSummary.currentLevel}
                />
                <div className={styles.xpDockTrack}>
                  <motion.div
                    className={styles.xpDockFill}
                    initial={false}
                    animate={{ width: `${Math.max(8, lifetimeXpSummary.progressToNextLevel * 100)}%` }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <div className={styles.xpDockCopy}>
                    <strong>{formattedLifetimeXp} XP</strong>
                    <small>{formattedXpToNextLevel} to level {lifetimeXpSummary.currentLevel + 1}</small>
                  </div>
                </div>
              </motion.div>
              <button
                type="button"
                className={`${styles.profileDockButton} ${
                  isMobileViewport ? styles.profileDockButtonMobile : styles.profileDockButtonDesktop
                }`}
                onClick={() => setProfileOpen(true)}
              >
                <WhelmProfileAvatar
                  tierColor={streakBandanaTier?.color}
                  size="compact"
                  isPro={isPro}
                  photoUrl={currentUserPhotoUrl}
                />
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
              {isMobileViewport && <section className={styles.mobileTodayStack} ref={todaySectionRef}>
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
                  <div className={styles.mobileSummaryRail}>
                    <article className={styles.mobileSummaryRailItem}>
                      <span>Next block</span>
                      <strong>{nextPlannedBlock?.title ?? "No block queued"}</strong>
                      <small>
                        {nextPlannedBlock
                          ? `${normalizeTimeLabel(nextPlannedBlock.timeOfDay)} · ${nextPlannedBlock.durationMinutes}m`
                          : "Place the next move before the day opens up."}
                      </small>
                    </article>
                    <article className={styles.mobileSummaryRailItem}>
                      <span>Return points</span>
                      <strong>{dueReminderNotes.length} due today</strong>
                      <small>
                        {dueReminderNotes[0]?.title ?? "No reminders are pulling at you right now."}
                      </small>
                    </article>
                  </div>
                </article>

                <div className={styles.mobileTimerWrap} ref={todayTimerRef}>
                  <Timer
                    minutes={30}
                    title={FOCUS_TIMER.title}
                    actionLabel={FOCUS_TIMER.actionLabel}
                    theme={FOCUS_TIMER.theme}
                    appearance={themeMode}
                    isPro={isPro}
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

              <section className={styles.statsGrid} ref={!isMobileViewport ? todaySectionRef : undefined}>
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

              {!isMobileViewport && (
                <section className={styles.todayCommandStrip}>
                  <article className={styles.todayCommandTile}>
                    <span>Next block</span>
                    <strong>{nextPlannedBlock?.title ?? "No active block queued"}</strong>
                    <small>
                      {nextPlannedBlock
                        ? `${normalizeTimeLabel(nextPlannedBlock.timeOfDay)} · ${nextPlannedBlock.durationMinutes}m`
                        : "Use Schedule to place the next move before drift opens up."}
                    </small>
                  </article>
                  <article className={styles.todayCommandTile}>
                    <span>Last session</span>
                    <strong>
                      {lastSession
                        ? new Date(lastSession.completedAtISO).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "No session saved"}
                    </strong>
                    <small>
                      {lastSessionHoursAgo !== null
                        ? `${Math.round(lastSessionHoursAgo)}h ago`
                        : "Start the first clean block of the day."}
                    </small>
                  </article>
                  <article className={styles.todayCommandTile}>
                    <span>Return points</span>
                    <strong>{dueReminderNotes.length} due today</strong>
                    <small>
                      {dueReminderNotes[0]?.title
                        ? `First return point: ${dueReminderNotes[0].title}`
                        : "No reminders are pulling on you right now."}
                    </small>
                  </article>
                  <article className={styles.todayCommandTile}>
                    <span>Latest note</span>
                    <strong>{latestNote?.title || "No note captured yet"}</strong>
                    <small>
                      {latestNote
                        ? new Date(latestNote.updatedAtISO).toLocaleDateString()
                        : "Capture one thought worth returning to."}
                    </small>
                  </article>
                </section>
              )}

              {!isPro && (
                <section className={styles.adStrip}>
                  <p className={styles.adBadge}>Whelm Pro</p>
                  <p className={styles.adCopy}>
                    {WHELM_PRO_POSITIONING}
                  </p>
                  <button type="button" className={styles.inlineUpgrade} onClick={openUpgradeFlow}>
                    Upgrade to Whelm Pro
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
                    isPro={isPro}
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
                        <h2 className={styles.cardTitle}>Today under command</h2>
                        <p className={styles.accountMeta}>The minimum clear read on whether the day is tightening or drifting.</p>
                      </div>
                      <button type="button" className={styles.reportButton} onClick={() => void copyWeeklyReport()}>
                        {reportCopyStatus || "Copy Whelm report"}
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
                  <article className={`${styles.card} ${styles.todayUtilityCard}`}>
                    <p className={styles.sectionLabel}>Quick Capture</p>
                    <h2 className={styles.cardTitle}>Keep the thought</h2>
                    <p className={styles.accountMeta}>Recent notes should be one tap away, not buried under editing chrome.</p>
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
                      + New note
                    </button>
                  </article>

                  <article className={`${styles.card} ${styles.todayUtilityCard}`}>
                    <p className={styles.sectionLabel}>Due Today</p>
                    <h2 className={styles.cardTitle}>Return points</h2>
                    <p className={styles.accountMeta}>These are the things that should pull you back into the right lane.</p>
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

                  <article className={`${styles.card} ${styles.todayAccessCard}`}>
                    <p className={styles.sectionLabel}>Access</p>
                    <p className={styles.accountMeta}>
                      {isPro ? "Whelm Pro" : "Whelm Free"}
                    </p>
                    <p className={styles.accountMeta}>{user.email}</p>
                    {!isPro && (
                      <button type="button" className={styles.inlineUpgrade} onClick={openUpgradeFlow}>
                        Upgrade to Whelm Pro
                      </button>
                    )}
                  </article>
                </aside>
              </section>
            </>
          )}

          {activeTab === "calendar" && (
            <AnimatedTabSection className={styles.calendarGrid} sectionRef={calendarSectionRef}>
              <article
                className={`${styles.card} ${calendarView === "month" ? styles.calendarPrimaryExpanded : ""} ${
                  calendarView === "month" && selectedMonthTone ? styles[`calendarToneSurface${selectedMonthTone}`] : ""
                } ${calendarView === "month" && selectedMonthTone ? styles.calendarToneSurfaceMonthCard : ""} ${
                  calendarView === "day" && selectedDateDayTone ? styles[`calendarToneSurface${selectedDateDayTone}`] : ""
                } ${calendarView === "day" && selectedDateDayTone ? styles.calendarToneSurfaceDayCard : ""}`}
                style={
                  calendarView === "month"
                    ? getCalendarToneStyle(selectedMonthTone)
                    : calendarView === "day"
                      ? getCalendarToneStyle(selectedDateDayTone)
                      : undefined
                }
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
                      style={mobileStreakJumpStyle}
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
                      {calendarView === "day" && currentTimeMarker && (
                        <button
                          type="button"
                          className={styles.calendarSectionButton}
                          onClick={() => scrollCalendarTimelineToNow()}
                        >
                          Now
                        </button>
                      )}
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
                  {calendarView === "month" && (
                    <CalendarTonePicker
                      label="Month tone"
                      selectedTone={selectedMonthTone}
                      onSelectTone={(tone) => applyMonthTone(selectedCalendarMonthKey, tone)}
                      isPro={isPro}
                      onUpgrade={openUpgradeFlow}
                    />
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
                      {dynamicMonthCalendar.map((day) => {
                        const effectiveDayTone =
                          day.dayNumber && day.key === selectedDateKey
                            ? selectedDateDayTone ?? day.tone
                            : day.tone;

                        return (
                        <motion.button
                          type="button"
                          key={day.key}
                          className={`${styles.monthDayCell} ${
                            effectiveDayTone ? "" : styles[`streakLevel${day.level}`]
                          } ${
                            day.dayNumber && day.key === selectedDateKey ? styles.monthDayCellSelected : ""
                          } ${effectiveDayTone ? styles[`calendarToneSurface${effectiveDayTone}`] : ""} ${
                            effectiveDayTone ? styles.calendarToneSurfaceDay : ""
                          } ${
                            day.dayNumber && day.key === selectedDateKey && effectiveDayTone
                              ? styles.monthDayCellToneSelected
                              : ""
                          }`}
                          style={getCalendarToneStyle(effectiveDayTone)}
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
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{
                            duration: 0.24,
                            delay: Math.min((day.dayNumber ?? 0) * 0.006, 0.18),
                            ease: [0.22, 1, 0.36, 1],
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
                                    } ${entry.isCompleted ? styles.monthEntryCompleted : ""}`}
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
                                      if (entry.source === "plan" && entry.planId) {
                                        openPlannedBlockDetail(entry.planId);
                                        return;
                                      }
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
                        </motion.button>
                      )})}
                    </div>
                  </>
                ) : (
                    <div className={styles.dayViewShell}>
                    <div id="calendar-day-chamber" className={styles.dayPortalCard}>
                      <div
                        className={`${styles.dayPortalBody} ${
                          selectedDateDayTone ? styles[`calendarToneSurface${selectedDateDayTone}`] : ""
                        } ${selectedDateDayTone ? styles.calendarToneSurfaceDayPortal : ""}`}
                        style={getCalendarToneStyle(selectedDateDayTone)}
                      >
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
                          <CalendarTonePicker
                            label="Day tone"
                            selectedTone={selectedDateDayTone}
                            onSelectTone={(tone) => applyDayTone(selectedDateKey, tone)}
                            isPro={isPro}
                            onUpgrade={openUpgradeFlow}
                          />
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
                                disabled={!selectedDateCanAddBlocks}
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
                                  disabled={!selectedDateCanAddBlocks}
                                />
                              )}
                              <CalendarTonePicker
                                label="Block tone"
                                selectedTone={planTone}
                                onSelectTone={setPlanTone}
                                isPro={isPro}
                                onUpgrade={openUpgradeFlow}
                              />
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
                                    disabled={!selectedDateCanAddBlocks}
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
                                    disabled={!selectedDateCanAddBlocks}
                                  />
                                </label>
                                <button
                                  type="button"
                                  className={`${styles.planAddButton} ${styles.blockActionButton}`}
                                  disabled={!selectedDateCanAddBlocks}
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
                              {!selectedDateCanAddBlocks ? (
                                <p className={styles.accountMeta}>
                                  Past days stay read-only. Blocks can only be added to today or a future day.
                                </p>
                              ) : null}
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
                            <motion.button
                              type="button"
                              key={`timeline-${entry.id}`}
                              data-calendar-entry-id={entry.id}
                              className={`${styles.dayViewEvent} ${styles[`dayViewEvent${entry.tone}`]} ${
                                isMobileViewport ? styles.dayViewEventMobile : ""
                              } ${entry.durationMinutes < 40 ? styles.dayViewEventCompact : ""} ${
                                activatedCalendarEntryId === entry.id ? styles.dayViewEventActivated : ""
                              } ${entry.isCompleted ? styles.dayViewEventCompleted : ""} ${
                                entry.isCompleted ? styles.dayViewEventResolved : ""
                              } ${entry.source === "plan" && getCalendarToneMeta(entry.tone as CalendarTone)
                                ? styles.calendarToneSurfaceBlock
                                : ""}`}
                              style={{
                                top: `${entry.topPct}%`,
                                height: `${entry.heightPct}%`,
                                ...getCalendarToneStyle(
                                  entry.source === "plan" ? (entry.tone as CalendarTone) : null,
                                ),
                              }}
                              onMouseEnter={() => showCalendarHoverPreview(entry.id)}
                              onMouseLeave={() => scheduleCalendarHoverPreviewClear(entry.id)}
                              onFocus={() => showCalendarHoverPreview(entry.id)}
                              onBlur={() => scheduleCalendarHoverPreviewClear(entry.id)}
                              onClick={(event) => {
                                event.stopPropagation();
                                clearCalendarHoverPreviewDelay();
                                if (entry.source === "plan" && entry.planId) {
                                  openPlannedBlockDetail(entry.planId);
                                  return;
                                }
                                setCalendarPinnedEntryId((current) => (current === entry.id ? null : entry.id))
                              }}
                              initial={{ opacity: 0, x: -8, scale: 0.98 }}
                              animate={{ opacity: 1, x: 0, scale: 1 }}
                              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
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
                            </motion.button>
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
                                  className={styles.secondaryPlanButton}
                                  onClick={() => openPlannedBlockDetail(activeCalendarPreview.planId ?? "")}
                                >
                                  Open block
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
                              className={styles.secondaryPlanButton}
                              onClick={() => openPlannedBlockDetail(activeCalendarPreview.planId ?? "")}
                            >
                              Open block
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
                          className={styles.secondaryPlanButton}
                          onClick={() => openPlannedBlockDetail(activeCalendarPreview.planId ?? "")}
                        >
                          Open block
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
              <article
                className={`${styles.card} ${styles.calendarAuxCard} ${
                  calendarView === "day" && selectedDateDayTone ? styles[`calendarToneSurface${selectedDateDayTone}`] : ""
                } ${calendarView === "day" && selectedDateDayTone ? styles.calendarToneSurfaceDayCard : ""}`}
                style={calendarView === "day" ? getCalendarToneStyle(selectedDateDayTone) : undefined}
                ref={calendarPlannerRef}
              >
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
                    <div className={styles.agendaCommandGrid}>
                      <article className={styles.agendaCommandCard}>
                        <span>Now</span>
                        <strong>{selectedDateAgendaStateSummary.activeNow?.title ?? "No active block"}</strong>
                        <small>
                          {selectedDateAgendaStateSummary.activeNow
                            ? selectedDateAgendaStateSummary.activeNow.timeLabel
                            : "The room is open for the next deliberate block."}
                        </small>
                      </article>
                      <article className={styles.agendaCommandCard}>
                        <span>Next</span>
                        <strong>{selectedDateAgendaStateSummary.nextUp?.title ?? "No queued block"}</strong>
                        <small>
                          {selectedDateAgendaStateSummary.nextUp
                            ? `${selectedDateAgendaStateSummary.nextUp.timeLabel} · set the next move early`
                            : "Queue the next thing before drift decides it."}
                        </small>
                      </article>
                      <article className={styles.agendaCommandCard}>
                        <span>Pressure</span>
                        <strong>
                          {selectedDateAgendaStateSummary.overdueCount > 0
                            ? `${selectedDateAgendaStateSummary.overdueCount} overdue`
                            : "Board clear"}
                        </strong>
                        <small>
                          {selectedDateAgendaStateSummary.focusMinutes}m focus · {selectedDateAgendaStateSummary.reminderCount} reminders
                        </small>
                      </article>
                    </div>

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
                                selectedDateEntries.slice(0, 6).map((entry) => {
                                  const agendaState =
                                    entry.source === "session"
                                      ? ("logged" as const)
                                      : resolveAgendaTimingState(
                                          selectedDateKey,
                                          entry.startMinute,
                                          entry.endMinute,
                                          entry.isCompleted,
                                        );
                                  return (
                                  <div
                                    key={entry.id}
                                    className={`${styles.dayAgendaItem} ${
                                      entry.source === "plan" ? styles.dayAgendaItemTinted : ""
                                    } ${
                                      entry.source === "plan" ? styles[`dayViewEvent${entry.tone}`] : ""
                                    } ${
                                      entry.source === "plan" && getCalendarToneMeta(entry.tone as CalendarTone)
                                        ? styles.calendarToneSurfaceBlock
                                        : ""
                                    } ${entry.isCompleted ? styles.dayAgendaItemCompleted : ""}`}
                                    style={
                                      entry.source === "plan"
                                        ? getCalendarToneStyle(entry.tone as CalendarTone)
                                        : undefined
                                    }
                                  >
                                    <div>
                                      <div className={styles.dayAgendaHeadline}>
                                        <p className={styles.dayAgendaTime}>{entry.timeLabel}</p>
                                        <span className={`${styles.agendaStatePill} ${styles[`agendaStatePill${agendaState.charAt(0).toUpperCase()}${agendaState.slice(1)}`]}`}>
                                          {agendaState === "logged" ? "Logged" : agendaState}
                                        </span>
                                      </div>
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
                                          className={styles.secondaryPlanButton}
                                          onClick={() => openPlannedBlockDetail(entry.planId ?? "")}
                                        >
                                          Open block
                                        </button>
                                      )}
                                      {entry.source === "plan" &&
                                        entry.planId &&
                                        plannedBlockById.get(entry.planId) &&
                                        !entry.isCompleted && (
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
                                  );
                                })
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
                          selectedDateEntries.slice(0, 8).map((entry) => {
                            const agendaState =
                              entry.source === "session"
                                ? ("logged" as const)
                                : resolveAgendaTimingState(
                                    selectedDateKey,
                                    entry.startMinute,
                                    entry.endMinute,
                                    entry.isCompleted,
                                  );
                            return (
                            <div
                              key={entry.id}
                              className={`${styles.dayAgendaItem} ${
                                entry.source === "plan" ? styles.dayAgendaItemTinted : ""
                              } ${
                                entry.source === "plan" ? styles[`dayViewEvent${entry.tone}`] : ""
                              } ${
                                entry.source === "plan" && getCalendarToneMeta(entry.tone as CalendarTone)
                                  ? styles.calendarToneSurfaceBlock
                                  : ""
                              } ${entry.isCompleted ? styles.dayAgendaItemCompleted : ""}`}
                              style={
                                entry.source === "plan"
                                  ? getCalendarToneStyle(entry.tone as CalendarTone)
                                  : undefined
                              }
                            >
                              <div>
                                <div className={styles.dayAgendaHeadline}>
                                  <p className={styles.dayAgendaTime}>{entry.timeLabel}</p>
                                  <span className={`${styles.agendaStatePill} ${styles[`agendaStatePill${agendaState.charAt(0).toUpperCase()}${agendaState.slice(1)}`]}`}>
                                    {agendaState === "logged" ? "Logged" : agendaState}
                                  </span>
                                </div>
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
                                    className={styles.secondaryPlanButton}
                                    onClick={() => openPlannedBlockDetail(entry.planId ?? "")}
                                  >
                                    Open block
                                  </button>
                                )}
                                {entry.source === "plan" &&
                                  entry.planId &&
                                  plannedBlockById.get(entry.planId) &&
                                  !entry.isCompleted && (
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
                            );
                          })
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
                            const planState = completed
                              ? ("completed" as const)
                              : resolveAgendaTimingState(
                                  item.dateKey,
                                  parseTimeToMinutes(item.timeOfDay),
                                  parseTimeToMinutes(item.timeOfDay) + item.durationMinutes,
                                );
                            return (
                              <div
                                key={item.id}
                                className={`${completed ? styles.planItemStatic : styles.planItem} ${
                                  completed ? styles.planItemCompleted : ""
                                } ${visiblePlanTone(item.tone) ? styles[`calendarToneSurface${visiblePlanTone(item.tone)}`] : ""} ${
                                  visiblePlanTone(item.tone) ? styles.calendarToneSurfaceBlock : ""
                                }`}
                                style={getCalendarToneStyle(visiblePlanTone(item.tone))}
                                onClick={() => openPlannedBlockDetail(item.id)}
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
                                <div className={styles.planItemHeadline}>
                                  <strong>{item.title}</strong>
                                  <span className={`${styles.agendaStatePill} ${styles[`agendaStatePill${planState.charAt(0).toUpperCase()}${planState.slice(1)}`]}`}>
                                    {planState}
                                  </span>
                                </div>
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
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void completePlannedBlock(item);
                                      }}
                                    >
                                      Complete
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.planDeleteButton}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        deletePlannedBlock(item.id);
                                      }}
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
                          selectedDatePlanGroups.incomplete.map((item) => {
                            const planState = resolveAgendaTimingState(
                              item.dateKey,
                              parseTimeToMinutes(item.timeOfDay),
                              parseTimeToMinutes(item.timeOfDay) + item.durationMinutes,
                            );
                            return (
                            <div
                              key={item.id}
                              className={`${styles.planItemStatic} ${
                                visiblePlanTone(item.tone) ? styles[`calendarToneSurface${visiblePlanTone(item.tone)}`] : ""
                              } ${visiblePlanTone(item.tone) ? styles.calendarToneSurfaceBlock : ""
                              }`}
                              style={getCalendarToneStyle(visiblePlanTone(item.tone))}
                              onClick={() => openPlannedBlockDetail(item.id)}
                            >
                              <div>
                                <div className={styles.planItemHeadline}>
                                  <strong>{item.title}</strong>
                                  <span className={`${styles.agendaStatePill} ${styles[`agendaStatePill${planState.charAt(0).toUpperCase()}${planState.slice(1)}`]}`}>
                                    {planState}
                                  </span>
                                </div>
                                <div className={styles.planMetaRow}>
                                  <span>{normalizeTimeLabel(item.timeOfDay)}</span>
                                  <span>{item.durationMinutes}m</span>
                                </div>
                                {item.note.trim() && <p className={styles.planItemNote}>{item.note}</p>}
                              </div>
                              <div className={styles.planStatusPillMuted}>Incomplete</div>
                            </div>
                            );
                          })
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
                        disabled={!selectedDateCanAddBlocks}
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
                          disabled={!selectedDateCanAddBlocks}
                        />
                      )}
                      <CalendarTonePicker
                        label="Block tone"
                        selectedTone={planTone}
                        onSelectTone={setPlanTone}
                        isPro={isPro}
                        onUpgrade={openUpgradeFlow}
                      />
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
                            disabled={!selectedDateCanAddBlocks}
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
                            disabled={!selectedDateCanAddBlocks}
                          />
                        </label>
                        <button
                          type="button"
                          className={`${styles.planAddButton} ${styles.blockActionButton}`}
                          disabled={!selectedDateCanAddBlocks}
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
                      {!selectedDateCanAddBlocks ? (
                        <p className={styles.accountMeta}>
                          Past days stay read-only. Blocks can only be added to today or a future day.
                        </p>
                      ) : null}
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
            </AnimatedTabSection>
          )}

          {activeTab === "leaderboard" && (
            <AnimatedTabSection className={styles.leaderboardShell} sectionRef={leaderboardSectionRef}>
              <article
                className={`${styles.card} ${styles.leaderboardHeroCard}`}
                ref={leaderboardPrimaryRef}
              >
                <div className={styles.leaderboardHeroHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Whelmboard</p>
                    <h2 className={styles.cardTitle}>Global command rank</h2>
                    <p className={styles.accountMeta}>
                      Switch between XP and streak standings. Whelmboard updates use deterministic tie-breakers for a clean board.
                    </p>
                  </div>
                  <div className={styles.leaderboardHeroBadge}>
                    <span>{leaderboardMetricTab === "xp" ? "XP ladder" : "Streak ladder"}</span>
                    <strong>#{leaderboardCurrentUserRank || "--"}</strong>
                  </div>
                </div>

                <div className={styles.leaderboardToggle} role="tablist" aria-label="Whelmboard views">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={leaderboardMetricTab === "xp"}
                    className={`${styles.leaderboardToggleButton} ${
                      leaderboardMetricTab === "xp" ? styles.leaderboardToggleButtonActive : ""
                    }`}
                    onClick={() => {
                      if (leaderboardMetricTab === "xp") return;
                      void trackLeaderboardTabSwitched(user, {
                        fromMetric: leaderboardMetricTab,
                        toMetric: "xp",
                      }).catch(() => undefined);
                      setLeaderboardMetricTab("xp");
                    }}
                  >
                    XP
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={leaderboardMetricTab === "streak"}
                    className={`${styles.leaderboardToggleButton} ${
                      leaderboardMetricTab === "streak" ? styles.leaderboardToggleButtonActive : ""
                    }`}
                    onClick={() => {
                      if (leaderboardMetricTab === "streak") return;
                      void trackLeaderboardTabSwitched(user, {
                        fromMetric: leaderboardMetricTab,
                        toMetric: "streak",
                      }).catch(() => undefined);
                      setLeaderboardMetricTab("streak");
                    }}
                  >
                    Streak
                  </button>
                </div>

                <div className={styles.leaderboardHeroStats}>
                  <article className={styles.leaderboardHeroStat}>
                    <span>Your standing</span>
                    <strong>#{leaderboardCurrentUserRank || "--"}</strong>
                    <small className={styles.leaderboardHeroMovement}>
                      <LeaderboardMovementIndicator
                        movement={leaderboardCurrentUserMovement}
                        tab={leaderboardMetricTab}
                      />
                    </small>
                  </article>
                  <article className={styles.leaderboardHeroStat}>
                    <span>Current leader</span>
                    <strong>{leaderboardLeader?.username ?? "No leader yet"}</strong>
                    <small>
                      {leaderboardMetricTab === "xp"
                        ? leaderboardLeader
                          ? formatLeaderboardXp(leaderboardLeader.totalXp)
                          : "Loading"
                        : leaderboardLeader
                          ? `${leaderboardLeader.currentStreak}d streak`
                          : "Loading"}
                    </small>
                  </article>
                  <article className={styles.leaderboardHeroStat}>
                    <span>Top bandana</span>
                    <strong>{leaderboardLeaderBandana?.shortLabel ?? "None"}</strong>
                    <small>
                      {leaderboardSnapshotDate
                        ? `Snapshot ${leaderboardSnapshotDate}`
                        : leaderboardLeaderBandana?.label ?? "No streak yet"}
                    </small>
                  </article>
                </div>
              </article>

              {leaderboardPodiumRows.length > 0 ? (
                <article className={`${styles.card} ${styles.leaderboardPodiumSection}`}>
                  <div className={styles.cardHeader}>
                    <div>
                      <p className={styles.sectionLabel}>Podium</p>
                      <h2 className={styles.cardTitle}>Top command holders</h2>
                    </div>
                    <span className={styles.leaderboardCountPill}>
                      {leaderboardMetricTab === "xp" ? "Prestige by XP" : "Prestige by streak"}
                    </span>
                  </div>
                  <div className={styles.leaderboardPodiumGrid}>
                    {leaderboardPodiumRows.map((row) => (
                      <LeaderboardPodiumCard
                        key={`podium-${row.entry.id}`}
                        row={row}
                        tab={leaderboardMetricTab}
                      />
                    ))}
                  </div>
                </article>
              ) : null}

              <article className={`${styles.card} ${styles.leaderboardSummaryCard}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Bandana holders</p>
                    <h2 className={styles.cardTitle}>Top holders by bandana tier</h2>
                  </div>
                  <span className={styles.leaderboardCountPill}>Global Whelmboard</span>
                </div>

                <div className={styles.leaderboardBandanaGrid}>
                  {leaderboardBandanaHolders.map((holder) => {
                    const meta = getLeaderboardBandanaMeta(holder.entry?.currentStreak ?? 0);
                    const holderStyle = {
                      "--leaderboard-accent": meta.theme.accent,
                      "--leaderboard-accent-strong": meta.theme.accentStrong,
                      "--leaderboard-accent-deep": meta.theme.accentDeep,
                    } as CSSProperties;

                    return (
                      <article
                        key={holder.color}
                        className={styles.leaderboardBandanaCard}
                        style={holderStyle}
                      >
                        <span>{holder.label}</span>
                        <div className={styles.leaderboardBandanaIdentity}>
                          {holder.entry ? (
                            <WhelmProfileAvatar
                              tierColor={meta.tier?.color}
                              size="row"
                              isPro={holder.entry.isProStyle}
                              photoUrl={holder.entry.avatarUrl}
                            />
                          ) : null}
                          <strong>{holder.entry?.username ?? "No holder yet"}</strong>
                        </div>
                        <small>
                          {holder.entry
                            ? `${formatLeaderboardXp(holder.entry.totalXp)} • ${holder.entry.currentStreak}d`
                            : "No qualifying streak yet"}
                        </small>
                      </article>
                    );
                  })}
                </div>
              </article>

              <article className={`${styles.card} ${styles.leaderboardBoardCard}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Standings</p>
                    <h2 className={styles.cardTitle}>
                      {leaderboardMetricTab === "xp" ? "XP ranking" : "Current streak ranking"}
                    </h2>
                  </div>
                  <span className={styles.leaderboardCountPill}>
                    {(leaderboardSource === "snapshot" ? leaderboardTotalEntries : leaderboardRows.length)} players
                  </span>
                </div>

                {leaderboardError ? (
                  <p className={styles.analyticsEmptyState}>{leaderboardError}</p>
                ) : null}

                {leaderboardLoading ? (
                  <div className={styles.leaderboardLoadingList}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className={styles.leaderboardLoadingRow} aria-hidden="true" />
                    ))}
                  </div>
                ) : !leaderboardHasEntries ? (
                  <div className={styles.leaderboardEmptyState}>
                    <strong>No Whelmboard data yet</strong>
                    <p className={styles.accountMeta}>
                      Once competitive data is available, the global Whelmboard will populate here.
                    </p>
                  </div>
                ) : (
                  <div className={styles.leaderboardBoardList}>
                    {leaderboardRows.map((row) => (
                      <LeaderboardRow
                        key={row.entry.id}
                        entry={row.entry}
                        rank={row.rank}
                        movement={row.movement}
                        tab={leaderboardMetricTab}
                      />
                    ))}
                  </div>
                )}

                {!leaderboardLoading && leaderboardHasMore ? (
                  <div className={styles.leaderboardFooter}>
                    <button
                      type="button"
                      className={styles.secondaryPlanButton}
                      onClick={() => void handleLeaderboardLoadMore()}
                    >
                      Load more
                    </button>
                  </div>
                ) : null}
              </article>

              {!leaderboardLoading && leaderboardAroundRows.length > 0 ? (
                <article className={`${styles.card} ${styles.leaderboardAroundCard}`}>
                  <div className={styles.cardHeader}>
                    <div>
                      <p className={styles.sectionLabel}>Around you</p>
                      <h2 className={styles.cardTitle}>Your local slice of the Whelmboard</h2>
                    </div>
                  </div>
                  <div className={styles.leaderboardBoardList}>
                    {leaderboardAroundRows.map((row) => (
                      <LeaderboardRow
                        key={`around-${row.entry.id}-${row.rank}`}
                        entry={row.entry}
                        rank={row.rank}
                        movement={row.movement}
                        tab={leaderboardMetricTab}
                      />
                    ))}
                  </div>
                </article>
              ) : null}
            </AnimatedTabSection>
          )}

          {activeTab === "mirror" && (
            <AnimatedTabSection className={styles.mirrorShell} sectionRef={mirrorSectionRef}>
              <CollapsibleSectionCard
                className={styles.mirrorHeroCard}
                label="Private Reflection"
                title="Streak Mirror"
                description="Private reflection for resets, sick-day saves, and pattern review."
                open={mirrorSectionsOpen.summary}
                onToggle={() =>
                  setMirrorSectionsOpen((current) => ({ ...current, summary: !current.summary }))
                }
              >
                <div className={styles.mirrorHeroCopy}>
                  <p className={styles.mirrorSaying}>{streakMirrorSaying}</p>
                  <div className={styles.mirrorPrivacyWrap}>
                    <button
                      type="button"
                      className={styles.secondaryPlanButton}
                      onClick={() => setMirrorPrivacyOpen((current) => !current)}
                    >
                      Privacy
                    </button>
                    {mirrorPrivacyOpen ? (
                      <p className={styles.mirrorLead}>
                        Private to you. No one else sees your Streak Mirror entries. Whelm keeps
                        them only to support honest reflection and accountability inside the app.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className={styles.mirrorHeroMeta}>
                  <div className={styles.mirrorCounterCard}>
                    <span>This month</span>
                    <strong>
                      {monthlyStreakSaveCount}/{STREAK_SAVE_MONTHLY_LIMIT}
                    </strong>
                    <small>
                      {streakSaveSlotsLeft > 0
                        ? `${streakSaveSlotsLeft} streak save${streakSaveSlotsLeft === 1 ? "" : "s"} left`
                        : "Monthly save limit reached"}
                    </small>
                  </div>
                </div>
              </CollapsibleSectionCard>

              <div ref={mirrorEntriesAnchorRef}>
                <CollapsibleSectionCard
                  className={styles.mirrorGridCard}
                  label="Entries"
                  title={streakMirrorEntries.length === 0 ? "No reflections yet" : "Look back clearly"}
                  description={
                    streakMirrorEntries.length === 0
                      ? "When a streak save is used, the reflection is stored here as a private mirror entry."
                      : isPro
                        ? "Every saved mirror entry stays available here."
                        : "Whelm Free keeps your 2 most recent mirror entries visible. Whelm Pro keeps the full archive available."
                  }
                  open={mirrorSectionsOpen.entries}
                  onToggle={() =>
                    setMirrorSectionsOpen((current) => ({ ...current, entries: !current.entries }))
                  }
                >
                  {streakMirrorVisibleEntries.length > 0 ? (
                    <div className={styles.mirrorEntryGrid}>
                    {streakMirrorVisibleEntries.map((entry) => {
                      const tagMeta = getStreakMirrorTagMeta(entry.tag);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          className={`${styles.mirrorEntryCard} ${
                            selectedStreakMirrorEntry?.id === entry.id ? styles.mirrorEntryCardActive : ""
                          }`}
                          style={{ ["--mirror-accent" as const]: tagMeta.accent } as CSSProperties}
                          onClick={() => {
                            setSelectedStreakMirrorId(entry.id);
                            setMirrorSectionsOpen((current) => ({
                              ...current,
                              entries: true,
                              detail: true,
                            }));
                          }}
                        >
                          <div className={styles.mirrorEntryCardHeader}>
                            <img src="/mirror-icon-tab.png" alt="" className={styles.mirrorEntryIcon} />
                            <span className={styles.mirrorEntryTag}>{tagMeta.label}</span>
                          </div>
                          <strong className={styles.mirrorEntryDate}>
                            {new Date(`${entry.dateKey}T00:00:00`).toLocaleDateString(undefined, {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </strong>
                          <p className={styles.mirrorEntryPreview}>
                            {entry.answers[STREAK_SAVE_ACCOUNTABILITY_QUESTIONS[0]]}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.emptyText}>No mirror entries yet. Honest save reflections will appear here.</p>
                )}

                  {!isPro && streakMirrorEntries.length > 2 ? (
                    <ProUnlockCard
                      title="Full Streak Mirror archive"
                      body={`${WHELM_PRO_POSITIONING} Whelm Free keeps the 2 most recent mirror reflections visible. Whelm Pro keeps the full archive so patterns stay easy to trace.`}
                      open={proPanelsOpen.mirror}
                      onToggle={() =>
                        setProPanelsOpen((current) => ({ ...current, mirror: !current.mirror }))
                      }
                      onPreview={() => void handleStartProPreview()}
                    />
                  ) : null}
                </CollapsibleSectionCard>
              </div>

              <CollapsibleSectionCard
                className={styles.mirrorDetailCard}
                label="Entry View"
                title={selectedStreakMirrorEntry ? "Private accountability reflection" : "Select a mirror card"}
                description={
                  selectedStreakMirrorEntry
                    ? "Open the full reflection only when you want the detail."
                    : "Choose one of your mirror cards to open the full reflection."
                }
                open={mirrorSectionsOpen.detail}
                onToggle={() =>
                  setMirrorSectionsOpen((current) => ({ ...current, detail: !current.detail }))
                }
              >
                {selectedStreakMirrorEntry ? (
                  <div className={styles.mirrorDetailBody}>
                    <div className={styles.mirrorDetailMeta}>
                      <span className={styles.mirrorDetailDate}>
                        {new Date(`${selectedStreakMirrorEntry.dateKey}T00:00:00`).toLocaleDateString(
                          undefined,
                          {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </span>
                      <span
                        className={styles.mirrorEntryTag}
                        style={{
                          backgroundColor: `${getStreakMirrorTagMeta(selectedStreakMirrorEntry.tag).accent}22`,
                          borderColor: `${getStreakMirrorTagMeta(selectedStreakMirrorEntry.tag).accent}66`,
                          color: getStreakMirrorTagMeta(selectedStreakMirrorEntry.tag).accent,
                        }}
                      >
                        {getStreakMirrorTagMeta(selectedStreakMirrorEntry.tag).label}
                      </span>
                    </div>
                    <div className={styles.mirrorAnswerList}>
                      {STREAK_SAVE_ACCOUNTABILITY_QUESTIONS.map((question, index) => (
                        <article key={question} className={styles.mirrorAnswerCard}>
                          <p className={styles.mirrorQuestionLabel}>Prompt {index + 1}</p>
                          <strong className={styles.mirrorQuestionText}>{question}</strong>
                          <p className={styles.mirrorAnswerText}>
                            {selectedStreakMirrorEntry.answers[question]}
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CollapsibleSectionCard>
            </AnimatedTabSection>
          )}

          {activeTab === "notes" && (
            <AnimatedTabSection className={styles.notesWorkspace} sectionRef={notesSectionRef}>
              {isMobileViewport && <div className={styles.mobileNotesPanel}>
                <article className={styles.mobileNotesStartCard} ref={notesStartRef}>
                  <div className={styles.mobileNotesStartHeaderCompact}>
                    <div>
                      <p className={styles.sectionLabel}>Writing Studio</p>
                      <h2 className={styles.cardTitle}>Write clean</h2>
                      <p className={styles.accountMeta}>Start a note or reopen one. Keep the page clear and the thought alive.</p>
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
                        Return to current note
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
                      <strong className={styles.mobileSectionToggleTitle}>Reopen the latest writing fast</strong>
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
                          style={{ backgroundColor: note.shellColor || "#fff7d6" }}
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
                    style={notesShellBackground(themeMode, selectedNoteSurfaceColor, selectedNotePageColor)}
                    data-note-fill={selectedNote.surfaceStyle}
                  >
                    <div className={styles.notesStudioHero}>
                      <div>
                        <p className={`${styles.sectionLabel} ${styles.noteHeroLabel}`}>Editing</p>
                        <h2 className={`${styles.cardTitle} ${styles.noteHeroTitle}`}>
                          {selectedNote.title || "Untitled note"}
                        </h2>
                      </div>
                      <div className={styles.noteFooterActions}>
                        {isPro ? (
                          <div className={styles.noteToneControlRow}>
                            <div className={styles.noteFillModeSwitch}>
                              <button
                                type="button"
                                className={`${styles.noteFillModeButton} ${
                                  selectedNote.surfaceStyle === "solid" ? styles.noteFillModeButtonActive : ""
                                }`}
                                onClick={() => void updateSelectedNote({ surfaceStyle: "solid" })}
                              >
                                Solid
                              </button>
                              <button
                                type="button"
                                className={`${styles.noteFillModeButton} ${
                                  selectedNote.surfaceStyle === "airy" ? styles.noteFillModeButtonActive : ""
                                }`}
                                onClick={() => void updateSelectedNote({ surfaceStyle: "airy" })}
                              >
                                Airy
                              </button>
                            </div>
                            <button
                              type="button"
                              className={`${styles.noteColorPickerTrigger} ${styles.noteToneButton}`}
                              style={
                                { ["--note-tone-color" as const]: selectedNote.color || "#e7e5e4" } as CSSProperties
                              }
                              onClick={() => {
                                setColorPickerOpen((open) => !open);
                                setShellColorPickerOpen(false);
                                setTextColorPickerOpen(false);
                                setHighlightPickerOpen(false);
                              }}
                            >
                              <span className={styles.noteToneButtonLabel}>Page tone</span>
                              <span className={styles.noteColorPickerPreview}>
                                <span
                                  className={styles.noteColorPickerPreviewFill}
                                  style={{ backgroundColor: selectedNote.color || "#e7e5e4" }}
                                />
                              </span>
                            </button>
                            <button
                              type="button"
                              className={`${styles.noteColorPickerTrigger} ${styles.noteShellButton}`}
                              style={
                                { ["--note-tone-color" as const]: selectedNote.shellColor || "#fff7d6" } as CSSProperties
                              }
                              onClick={() => {
                                setShellColorPickerOpen((open) => !open);
                                setColorPickerOpen(false);
                                setTextColorPickerOpen(false);
                                setHighlightPickerOpen(false);
                              }}
                            >
                              <span className={styles.noteToneButtonLabel}>Notebook color</span>
                              <span className={styles.noteColorPickerPreview}>
                                <span
                                  className={styles.noteColorPickerPreviewFill}
                                  style={{ backgroundColor: selectedNote.shellColor || "#fff7d6" }}
                                />
                              </span>
                            </button>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className={`${styles.secondaryPlanButton} ${styles.noteDoneButton}`}
                          onClick={() => {
                            void flushSelectedNoteDraft();
                            setMobileNotesEditorOpen(false);
                          }}
                        >
                          Done
                        </button>
                      </div>
                    </div>

                    {isPro && colorPickerOpen && (
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
                    {isPro && shellColorPickerOpen && (
                      <div className={styles.noteColorPickerPopover}>
                        {NOTE_COLORS.map((color) => (
                          <button
                            type="button"
                            key={color.value}
                            className={`${styles.noteColorSwatch} ${
                              selectedNote.shellColor === color.value ? styles.noteColorSwatchActive : ""
                            }`}
                            style={{ backgroundColor: color.value }}
                            title={color.label}
                            onClick={() => {
                              void updateSelectedNote({ shellColor: color.value });
                              setShellColorPickerOpen(false);
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
                        disabled={!isPro}
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
                        disabled={!isPro}
                        onClick={() =>
                          setMobileNotesToolsOpen((current) => (current === "color" ? null : "color"))
                        }
                      >
                        Color
                      </button>
                    </div>

                    {mobileNotesToolsOpen === "format" && (
                      <div className={styles.mobileToolPanel}>
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
                      </div>
                    )}

                    {mobileNotesToolsOpen === "type" && (
                      <div className={styles.mobileToolPanel}>
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
                    )}

                    {mobileNotesToolsOpen === "color" && (
                      <div className={styles.mobileToolPanel}>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            saveEditorSelection();
                          }}
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
                          onMouseDown={(event) => {
                            event.preventDefault();
                            saveEditorSelection();
                          }}
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
                        {highlightPickerOpen && (
                          <div className={styles.noteInlinePalettePopover}>
                            {NOTE_HIGHLIGHTS.map((color) => (
                              <button
                                type="button"
                                key={color.value}
                                className={styles.noteInlineSwatch}
                                style={{ backgroundColor: color.value }}
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
                    )}
                    {!isPro ? (
                      <ProUnlockCard
                        title="Note colors and fonts"
                        body={`${WHELM_PRO_POSITIONING} Custom page tones, font families, text colors, highlights, and visual note styling live inside Whelm Pro.`}
                        open={proPanelsOpen.notes}
                        onToggle={() => setProPanelsOpen((current) => ({ ...current, notes: !current.notes }))}
                        onPreview={() => void handleStartProPreview()}
                        preview={
                          <div className={styles.noteStylePreview}>
                            <div className={styles.noteStylePreviewToolbar}>
                              <span className={styles.noteStylePreviewChip}>Page tone</span>
                              <span className={styles.noteStylePreviewChip}>Fraunces</span>
                              <span className={styles.noteStylePreviewChip}>Highlight</span>
                            </div>
                            <article className={styles.noteStylePreviewCard}>
                              <p className={styles.noteStylePreviewEyebrow}>Whelm Pro Writing Studio</p>
                              <h3>Shape the page like a finished thought.</h3>
                              <p>
                                Make the page calmer, sharper, or warmer with tone, type, and emphasis that change
                                how the note feels before a word is even read.
                              </p>
                              <p>
                                <mark>Show the premium surface first.</mark>
                              </p>
                            </article>
                          </div>
                        }
                      />
                    ) : null}

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
                      onKeyUp={() => {
                        captureEditorDraft();
                        saveEditorSelection();
                      }}
                      onPaste={() => {
                        window.setTimeout(() => {
                          captureEditorDraft();
                          saveEditorSelection();
                        }, 0);
                      }}
                      onCompositionEnd={() => {
                        captureEditorDraft();
                        saveEditorSelection();
                      }}
                      onBlur={() => {
                        captureEditorDraft();
                      }}
                      onMouseUp={() => saveEditorSelection()}
                      onFocus={() => saveEditorSelection()}
                    />
                    <div className={styles.noteEditorFooter}>
                      <span className={styles.noteWordCount}>
                        {selectedNoteWordCount} word{selectedNoteWordCount === 1 ? "" : "s"}
                        {selectedNoteWordCount >= 33 ? " · streak writing met" : ""}
                      </span>
                    </div>
                    <div className={styles.noteFooterActions}>
                      <button
                        type="button"
                        className={`${styles.reportButton} ${styles.blockActionButton}`}
                        onClick={() => convertNoteToPlannedBlock(selectedNote)}
                      >
                        Turn into block
                      </button>
                      <button
                        type="button"
                        className={styles.deleteNoteButton}
                        onClick={() => void deleteNote(selectedNote.id)}
                      >
                        Remove note
                      </button>
                    </div>
                  </article>
                ) : null}
              </div>}

              {!isMobileViewport && (
                <motion.aside
                  className={styles.notesSidebar}
                  style={notesShellBackground(themeMode, selectedNoteSurfaceColor, selectedNotePageColor)}
                  data-note-fill={selectedNote?.surfaceStyle ?? "solid"}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                <div className={styles.notesSidebarHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Notes</p>
                    <h2 className={styles.notesSidebarTitle}>Writing studio</h2>
                    <p className={styles.notesSidebarMeta}>
                      {filteredNotes.length} visible note{filteredNotes.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button type="button" className={styles.newNoteButton} onClick={createWorkspaceNote}>
                    + New
                  </button>
                </div>
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
                      Upgrade to Whelm Pro
                    </button>
                  )}
                </div>
                <div className={styles.noteList}>
                  {filteredNotes.map((note) => (
                    <motion.div
                      key={note.id}
                      className={styles.noteListRow}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.24,
                        delay: Math.min(filteredNotes.findIndex((item) => item.id === note.id) * 0.03, 0.24),
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <motion.button
                        type="button"
                        className={`${styles.noteListItem} ${selectedNoteId === note.id ? styles.noteListItemActive : ""}`}
                        style={{ ["--note-item-tint" as const]: note.shellColor || "#fff7d6" } as CSSProperties}
                        data-note-fill={note.surfaceStyle ?? "solid"}
                        onClick={() => setSelectedNoteId(note.id)}
                        whileHover={{ y: -2, scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <span className={styles.noteListTitle}>
                          {note.isPinned ? "★ " : ""}
                          {note.title || "Untitled note"}
                        </span>
                        <span className={styles.noteListMeta}>
                          {(note.category || "personal").toUpperCase()} ·{" "}
                          {new Date(note.updatedAtISO).toLocaleDateString()}
                        </span>
                      </motion.button>
                      <button
                        type="button"
                        className={styles.notePinButton}
                        onClick={() => void togglePinned(note.id)}
                        title={note.isPinned ? "Unpin note" : "Pin note"}
                        aria-label={note.isPinned ? "Unpin note" : "Pin note"}
                      >
                        {note.isPinned ? "★" : "☆"}
                      </button>
                    </motion.div>
                  ))}
                  {filteredNotes.length === 0 && (
                    <p className={styles.emptyText}>No notes match your filters.</p>
                  )}
                </div>
                {!isPro && hasLockedNotesHistory ? (
                  <p className={styles.accountMeta}>
                    Whelm Free keeps the last 14 days of notes visible. Whelm Pro keeps the older archive ready
                    whenever you want it back.
                  </p>
                ) : null}
              </motion.aside>
              )}

              {!isMobileViewport && (
                <motion.article
                  className={styles.notesEditorCard}
                  style={notesShellBackground(themeMode, selectedNoteSurfaceColor, selectedNotePageColor)}
                  data-note-fill={selectedNote?.surfaceStyle ?? "solid"}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
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
                        <p className={styles.sectionLabel}>Writing Studio</p>
                        <h2 className={styles.notesEditorTitle}>
                          {selectedNote.title || "Untitled note"}
                        </h2>
                        <p className={styles.noteStudioCopy}>
                          Cleaner writing surface. Less chrome, more thought.
                        </p>
                      </div>
                      <div className={styles.noteColorRow}>
                        {isPro ? (
                          <>
                            <div className={styles.noteToneControlRow}>
                              <div className={styles.noteFillModeSwitch}>
                                <button
                                  type="button"
                                  className={`${styles.noteFillModeButton} ${
                                    selectedNote.surfaceStyle === "solid" ? styles.noteFillModeButtonActive : ""
                                  }`}
                                  onClick={() => void updateSelectedNote({ surfaceStyle: "solid" })}
                                >
                                  Solid
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.noteFillModeButton} ${
                                    selectedNote.surfaceStyle === "airy" ? styles.noteFillModeButtonActive : ""
                                  }`}
                                  onClick={() => void updateSelectedNote({ surfaceStyle: "airy" })}
                                >
                                  Airy
                                </button>
                              </div>
                              <button
                                type="button"
                                className={`${styles.noteColorPickerTrigger} ${styles.noteToneButton}`}
                                style={
                                  { ["--note-tone-color" as const]: selectedNote.color || "#e7e5e4" } as CSSProperties
                                }
                                onClick={() => {
                                  setColorPickerOpen((open) => !open);
                                  setShellColorPickerOpen(false);
                                  setTextColorPickerOpen(false);
                                  setHighlightPickerOpen(false);
                                }}
                              >
                                <span className={styles.noteToneButtonLabel}>Page tone</span>
                                <span className={styles.noteColorPickerPreview}>
                                  <span
                                    className={styles.noteColorPickerPreviewFill}
                                    style={{ backgroundColor: selectedNote.color || "#e7e5e4" }}
                                  />
                                </span>
                              </button>
                              <button
                                type="button"
                                className={`${styles.noteColorPickerTrigger} ${styles.noteShellButton}`}
                                style={
                                  { ["--note-tone-color" as const]: selectedNote.shellColor || "#fff7d6" } as CSSProperties
                                }
                                onClick={() => {
                                  setShellColorPickerOpen((open) => !open);
                                  setColorPickerOpen(false);
                                  setTextColorPickerOpen(false);
                                  setHighlightPickerOpen(false);
                                }}
                              >
                                <span className={styles.noteToneButtonLabel}>Notebook color</span>
                                <span className={styles.noteColorPickerPreview}>
                                  <span
                                    className={styles.noteColorPickerPreviewFill}
                                    style={{ backgroundColor: selectedNote.shellColor || "#fff7d6" }}
                                  />
                                </span>
                              </button>
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
                            {shellColorPickerOpen && (
                              <div className={styles.noteColorPickerPopover}>
                                {NOTE_COLORS.map((color) => (
                                  <button
                                    type="button"
                                    key={color.value}
                                    className={`${styles.noteColorSwatch} ${
                                      selectedNote.shellColor === color.value ? styles.noteColorSwatchActive : ""
                                    }`}
                                    style={{ backgroundColor: color.value }}
                                    title={color.label}
                                    onClick={() => {
                                      void updateSelectedNote({ shellColor: color.value });
                                      setShellColorPickerOpen(false);
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <ProUnlockCard
                            title="Note colors and fonts"
                            body={`${WHELM_PRO_POSITIONING} Custom page tones, type styling, text colors, and highlights live inside Whelm Pro.`}
                            open={proPanelsOpen.notes}
                            onToggle={() =>
                              setProPanelsOpen((current) => ({ ...current, notes: !current.notes }))
                            }
                            onPreview={() => void handleStartProPreview()}
                            preview={
                              <div className={styles.noteStylePreview}>
                                <div className={styles.noteStylePreviewToolbar}>
                                  <span className={styles.noteStylePreviewChip}>Page tone</span>
                                  <span className={styles.noteStylePreviewChip}>Editorial</span>
                                  <span className={styles.noteStylePreviewChip}>Text color</span>
                                </div>
                                <article className={styles.noteStylePreviewCard}>
                                  <p className={styles.noteStylePreviewEyebrow}>Whelm Pro Writing Studio</p>
                                  <h3>Notes stop looking generic.</h3>
                                  <p>
                                    Let page tone, typography, and highlights carry the mood of the idea instead of
                                    leaving every note on the same flat surface.
                                  </p>
                                  <p>
                                    <mark>Let the page itself sell the feature.</mark>
                                  </p>
                                </article>
                              </div>
                            }
                          />
                        )}
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
                      <div className={styles.noteToolbarSection}>
                        <span className={styles.noteToolbarLabel}>Text</span>
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
                      </div>

                      <div className={styles.noteToolbarSection}>
                        <span className={styles.noteToolbarLabel}>Structure</span>
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
                      </div>

                      <div className={styles.noteToolbarSection}>
                        <span className={styles.noteToolbarLabel}>Layout</span>
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
                      </div>

                      {isPro ? (
                        <div className={styles.noteToolbarSection}>
                          <span className={styles.noteToolbarLabel}>Style</span>
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

                            <div className={styles.noteInlinePalette}>
                              <button
                                type="button"
                                className={styles.noteToolButton}
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  saveEditorSelection();
                                }}
                                onClick={() => {
                                  setTextColorPickerOpen((open) => !open);
                                  setHighlightPickerOpen(false);
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
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  saveEditorSelection();
                                }}
                                onClick={() => {
                                  setHighlightPickerOpen((open) => !open);
                                  setTextColorPickerOpen(false);
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
                      ) : null}
                    </div>

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
                      onKeyUp={() => {
                        captureEditorDraft();
                        saveEditorSelection();
                      }}
                      onPaste={() => {
                        window.setTimeout(() => {
                          captureEditorDraft();
                          saveEditorSelection();
                        }, 0);
                      }}
                      onCompositionEnd={() => {
                        captureEditorDraft();
                        saveEditorSelection();
                      }}
                      onBlur={() => {
                        captureEditorDraft();
                      }}
                      onMouseUp={() => saveEditorSelection()}
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
                      <span className={styles.noteWordCount}>
                        {selectedNoteWordCount} word{selectedNoteWordCount === 1 ? "" : "s"}
                        {selectedNoteWordCount >= 33 ? " · streak writing met" : ""}
                      </span>
                      <div className={styles.noteFooterActions}>
                      <button
                        type="button"
                        className={`${styles.reportButton} ${styles.blockActionButton}`}
                        onClick={() => convertNoteToPlannedBlock(selectedNote)}
                      >
                        Turn into block
                      </button>
                        {notesSyncStatus !== "synced" && (
                          <button type="button" className={styles.retrySyncButton} onClick={() => void handleRetrySync()}>
                            Retry notes sync
                          </button>
                        )}
                        <button type="button" className={styles.deleteNoteButton} onClick={() => void deleteNote(selectedNote.id)}>
                          Remove note
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </motion.article>
              )}
            </AnimatedTabSection>
          )}

          {activeTab === "history" && (
            <AnimatedTabSection className={styles.historyShell} sectionRef={historySectionRef}>
              <CompanionPulse {...companionState.pulses.history} />
              <article className={styles.card} ref={historyPrimaryRef}>
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
                {!isPro && hasLockedBlockHistory ? (
                  <ProUnlockCard
                    title="Older block history"
                    body={`${WHELM_PRO_POSITIONING} Whelm Free keeps the last 14 days of block history visible. Whelm Pro keeps the older archive ready whenever you want it back.`}
                    open={proPanelsOpen.calendar}
                    onToggle={() => setProPanelsOpen((current) => ({ ...current, calendar: !current.calendar }))}
                    onPreview={() => void handleStartProPreview()}
                  />
                ) : null}
              </article>
              <article className={styles.card}>
                <p className={styles.sectionLabel}>History</p>
                <h2 className={styles.cardTitle}>Session log</h2>
                {(isPro ? sessionHistoryGroups : freeSessionHistoryGroups).length === 0 ? (
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
                    {(isPro ? sessionHistoryGroups : freeSessionHistoryGroups).map((monthGroup) => (
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
                {!isPro && hasLockedHistoryDays ? (
                  <ProUnlockCard
                    title="Older history"
                    body={`${WHELM_PRO_POSITIONING} Whelm Free keeps the last 14 days visible. Whelm Pro keeps the older month, week, and day archive ready whenever you want it back.`}
                    open={proPanelsOpen.history}
                    onToggle={() => setProPanelsOpen((current) => ({ ...current, history: !current.history }))}
                    onPreview={() => void handleStartProPreview()}
                  />
                ) : null}
              </article>
            </AnimatedTabSection>
          )}

          {activeTab === "reports" && (
            <AnimatedTabSection className={styles.reportsGrid} sectionRef={reportsSectionRef}>
              <CompanionPulse {...companionState.pulses.reports} />
              {!isPro ? (
                <>
                  <article className={`${styles.card} ${styles.analyticsHeroCard}`} ref={reportsPrimaryRef}>
                    <div className={styles.cardHeader}>
                      <div>
                        <p className={styles.sectionLabel}>Focus Readout</p>
                        <h2 className={styles.cardTitle}>Core focus picture</h2>
                        <p className={styles.accountMeta}>
                          Whelm Free keeps this simple. Whelm Pro opens the deeper command readout.
                        </p>
                      </div>
                    </div>
                    <div className={styles.analyticsHeroGrid}>
                      <motion.div className={styles.analyticsHeroMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
                        <span>Today</span>
                        <strong>{focusMetrics.todayMinutes}m</strong>
                        <small>{focusMetrics.todaySessions} saved session{focusMetrics.todaySessions === 1 ? "" : "s"}</small>
                      </motion.div>
                      <motion.div className={styles.analyticsHeroMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.04 }}>
                        <span>7 days</span>
                        <strong>{focusMetrics.weekMinutes}m</strong>
                        <small>last week of focus</small>
                      </motion.div>
                      <motion.div className={styles.analyticsHeroMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.08 }}>
                        <span>30 days</span>
                        <strong>{focusMetrics.monthMinutes}m</strong>
                        <small>recent monthly total</small>
                      </motion.div>
                      <motion.div className={styles.analyticsHeroMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.12 }}>
                        <span>Active days</span>
                        <strong>{focusMetrics.activeDaysInMonth}</strong>
                        <small>days with saved minutes</small>
                      </motion.div>
                    </div>
                  </article>
                  <article className={styles.card}>
                    <p className={styles.sectionLabel}>Whelm Pro</p>
                    <h2 className={styles.cardTitle}>Advanced reports belong to Whelm Pro</h2>
                    <ProUnlockCard
                      title="Unlock score history, insight feed, best hours, and subject analysis"
                      body={`${WHELM_PRO_POSITIONING} Whelm Pro opens the full reports suite: performance score history, quality and completion analytics, focus windows, insights, and deeper breakdowns.`}
                      open={proPanelsOpen.reports}
                      onToggle={() => setProPanelsOpen((current) => ({ ...current, reports: !current.reports }))}
                      onPreview={() => void handleStartProPreview()}
                    />
                  </article>
                </>
              ) : (
                <>
              <article className={`${styles.card} ${styles.analyticsHeroCard}`} ref={reportsPrimaryRef}>
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
                    <motion.div className={styles.analyticsHeroMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
                      <span>Avg Performance</span>
                      <strong>{analyticsWeeklySummary.averages.dailyPerformanceScore}</strong>
                      <small>score this week</small>
                    </motion.div>
                    <motion.div className={styles.analyticsHeroMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.04 }}>
                      <span>Completion Rate</span>
                      <strong>{analyticsWeeklySummary.averages.completionRate}%</strong>
                      <small>{analyticsWeeklySummary.totals.sessionsCompleted} sessions finished</small>
                    </motion.div>
                    <motion.div className={styles.analyticsHeroMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.08 }}>
                      <span>Session Quality</span>
                      <strong>
                        {analyticsWeeklySummary.averages.sessionQualityScore === null
                          ? "N/A"
                          : analyticsWeeklySummary.averages.sessionQualityScore}
                      </strong>
                      <small>quality average</small>
                    </motion.div>
                    <motion.div className={styles.analyticsHeroMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.12 }}>
                      <span>Active Days</span>
                      <strong>{analyticsWeeklySummary.activeDays}</strong>
                      <small>captured this week</small>
                    </motion.div>
                  </div>
                ) : (
                  <p className={styles.analyticsEmptyState}>Finish a few tracked sessions to unlock richer reports.</p>
                )}
              </article>

              <article className={`${styles.card} ${styles.analyticsCommandCard}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Readout</p>
                    <h2 className={styles.cardTitle}>What needs attention now</h2>
                  </div>
                  <span className={styles.leaderboardCountPill}>Operator view</span>
                </div>
                <div className={styles.analyticsCommandGrid}>
                  <div className={styles.analyticsCommandItem}>
                    <span>Lead insight</span>
                    <strong>{analyticsLeadInsight?.title ?? "No standout pattern yet"}</strong>
                    <small>
                      {analyticsLeadInsight?.body ?? "Keep logging tracked sessions and Whelm will sharpen the readout."}
                    </small>
                  </div>
                  <div className={styles.analyticsCommandItem}>
                    <span>Best window</span>
                    <strong>
                      {analyticsBestHours?.bestWindow
                        ? formatAnalyticsWindowLabel(
                            analyticsBestHours.bestWindow.startHour,
                            analyticsBestHours.bestWindow.endHour,
                          )
                        : "Still forming"}
                    </strong>
                    <small>
                      {analyticsBestHours?.bestWindow
                        ? `${analyticsBestHours.bestWindow.focusMinutes} focus minutes sit in this window.`
                        : "Complete more saved sessions to surface your strongest hours."}
                    </small>
                  </div>
                  <div className={styles.analyticsCommandItem}>
                    <span>Main subject</span>
                    <strong>{analyticsLeadSubject?.label ?? "No dominant lane yet"}</strong>
                    <small>
                      {analyticsLeadSubject
                        ? `${analyticsLeadSubject.focusMinutes} minutes tracked here across ${analyticsLeadSubject.sessionsCompleted} sessions.`
                        : "Subject breakdown will strengthen as more work gets categorized."}
                    </small>
                  </div>
                  <div className={styles.analyticsCommandItem}>
                    <span>Recommended nudge</span>
                    <strong>{analyticsLeadNotification?.title ?? "No nudge queued"}</strong>
                    <small>
                      {analyticsLeadNotification
                        ? `${analyticsLeadNotification.body} Deliver at ${analyticsLeadNotification.deliverAtLocalTime}.`
                        : "Once today has enough analytics data, Whelm will queue a targeted prompt here."}
                    </small>
                  </div>
                </div>
              </article>

              <CollapsibleSectionCard
                label="Score History"
                title="Performance score trend"
                open={reportsSectionsOpen.score}
                onToggle={() =>
                  setReportsSectionsOpen((current) => ({ ...current, score: !current.score }))
                }
              >
                {analyticsScoreHistory.length > 0 ? (
                  <>
                    <div className={styles.analyticsSectionLead}>
                      <strong>
                        {analyticsWeeklySummary?.averages.dailyPerformanceScore ?? "--"} average score
                      </strong>
                      <span>
                        {analyticsWeeklySummary
                          ? `${analyticsWeeklySummary.performanceBands.high} high days, ${analyticsWeeklySummary.performanceBands.recovery} recovery days`
                          : "Watch the line to see whether performance is stabilizing or breaking."}
                      </span>
                    </div>
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
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                label="Insight Feed"
                title="What the system is seeing"
                open={reportsSectionsOpen.insights}
                onToggle={() =>
                  setReportsSectionsOpen((current) => ({ ...current, insights: !current.insights }))
                }
              >
                {analyticsInsights.length > 0 ? (
                  <div className={styles.analyticsInsightList}>
                    {analyticsInsights.map((insight, index) => (
                      <article
                        key={insight.type}
                        className={`${styles.analyticsInsightCard} ${
                          insight.tone === "warning"
                            ? styles.analyticsInsightWarning
                            : insight.tone === "positive"
                              ? styles.analyticsInsightPositive
                              : styles.analyticsInsightNeutral
                        }`}
                        data-lead-insight={index === 0 ? "true" : "false"}
                      >
                        <span className={styles.analyticsInsightKicker}>
                          {index === 0 ? "Lead signal" : "Pattern"}
                        </span>
                        <p className={styles.analyticsInsightTitle}>{insight.title}</p>
                        <p className={styles.accountMeta}>{insight.body}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className={styles.analyticsEmptyState}>No standout insights yet. More tracked sessions will make this feed sharper.</p>
                )}
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                label="Timing"
                title="Best focus window"
                open={reportsSectionsOpen.timing}
                onToggle={() =>
                  setReportsSectionsOpen((current) => ({ ...current, timing: !current.timing }))
                }
              >
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
                      {analyticsTopHours.map((hour, index) => (
                        <div key={hour.hour} className={styles.analyticsHourRow}>
                          <div>
                            <strong>{formatHourLabel(hour.hour)}</strong>
                            <p className={styles.accountMeta}>
                              {index === 0 ? "Strongest hour" : `${hour.completedSessions} sessions`}
                            </p>
                          </div>
                          <div className={styles.analyticsBarTrack}>
                            <motion.div
                              className={styles.analyticsBarFill}
                              initial={{ width: "8%" }}
                              animate={{ width: `${Math.max(8, hour.sharePercent)}%` }}
                              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
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
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                label="Subject Breakdown"
                title="Where the work is landing"
                open={reportsSectionsOpen.subjects}
                onToggle={() =>
                  setReportsSectionsOpen((current) => ({ ...current, subjects: !current.subjects }))
                }
              >
                {analyticsTopSubjects.some((subject) => subject.focusMinutes > 0) ? (
                  <div className={styles.analyticsSubjectList}>
                    {analyticsTopSubjects.map((subject, index) => (
                      <div key={subject.key} className={styles.analyticsSubjectRow}>
                        <div className={styles.analyticsSubjectHeader}>
                          <strong>{subject.label}</strong>
                          <span>{subject.focusMinutes}m</span>
                        </div>
                        {index === 0 ? (
                          <p className={styles.analyticsSectionCallout}>This is where most of your tracked effort is landing.</p>
                        ) : null}
                        <div className={styles.analyticsBarTrack}>
                          <motion.div
                            className={styles.analyticsBarFill}
                            initial={{ width: "8%" }}
                            animate={{ width: `${(subject.focusMinutes / analyticsTopSubjectMinutes) * 100}%` }}
                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
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
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                label="Popups & Notifications"
                title="Recommended nudges"
                description="These are generated from the latest analytics snapshot and can power in-app prompts and scheduled notifications."
                open={reportsSectionsOpen.notifications}
                onToggle={() =>
                  setReportsSectionsOpen((current) => ({
                    ...current,
                    notifications: !current.notifications,
                  }))
                }
              >
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
              </CollapsibleSectionCard>
                </>
              )}
            </AnimatedTabSection>
          )}

          {activeTab === "streaks" && (
            <AnimatedTabSection className={styles.streaksShell} sectionRef={streaksSectionRef}>
              <motion.article
                className={`${styles.card} ${styles.streakRulesCard}`}
                ref={streaksPrimaryRef}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  type="button"
                  className={styles.streakRulesToggle}
                  onClick={() => setStreakRulesOpen((current) => !current)}
                  aria-expanded={streakRulesOpen}
                >
                  <span>How a streak day is earned</span>
                  <span className={styles.streakRulesToggleDots}>{streakRulesOpen ? "Close" : "•••"}</span>
                </button>
                {streakRulesOpen && (
                  <motion.div
                    className={styles.streakRulesPanel}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className={styles.accountMeta}>{streakRuleSummaryLine}</p>
                    <div className={styles.streakRulesList}>
                      <div className={styles.streakRuleChip}>
                        <strong>{streakProgressBlocksLabel}</strong>
                        <span>Completed block</span>
                      </div>
                      <div className={styles.streakRulesEffortGroup}>
                        <div className={styles.streakRuleChip}>
                          <strong>{streakProgressMinutesLabel}</strong>
                          <span>Focus option</span>
                        </div>
                        <div className={styles.streakRuleOrBubble}>OR</div>
                        <div className={styles.streakRuleChip}>
                          <strong>{streakProgressWordsLabel}</strong>
                          <span>Writing option</span>
                        </div>
                      </div>
                    </div>
                    <p
                      className={`${styles.streakRuleStatus} ${
                        streakProtectedToday ? styles.streakRuleStatusProtected : ""
                      }`}
                    >
                      {streakStatusLine}
                    </p>
                  </motion.div>
                )}
              </motion.article>

              {(rawYesterdayMissed || yesterdaySave) &&
                (sickDaySaveEligible || monthlySaveLimitReached || Boolean(yesterdaySave)) && (
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
                              monthlySaveLimitReached
                                ? ` You have used ${monthlyStreakSaveCount}/${STREAK_SAVE_MONTHLY_LIMIT} saves this month.`
                                : ""
                            }`}
                    </p>
                    <p className={styles.streakSaveCounter}>
                      Streak saves this month: {monthlyStreakSaveCount}/{STREAK_SAVE_MONTHLY_LIMIT}
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
                          Open Streak Mirror
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryPlanButton}
                          onClick={declineSickDaySave}
                        >
                          Let the streak reset
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={styles.secondaryPlanButton}
                        onClick={() => setActiveTab(monthlySaveLimitReached ? "mirror" : "today")}
                      >
                        {monthlySaveLimitReached ? "Open Streak Mirror" : "Return to Today"}
                      </button>
                    )}
                  </div>
                </article>
              )}

              <motion.article
                className={`${styles.card} ${styles.streakCalendarCard}`}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
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
                  {streakMonthCalendar.map((cell) => {
                    const cellFocusMinutes = cell.dateKey ? sessionMinutesByDay.get(cell.dateKey) ?? 0 : 0;
                    const cellCompletedBlocks = cell.dateKey ? completedBlocksByDay.get(cell.dateKey) ?? 0 : 0;
                    const cellNoteWords = cell.dateKey ? noteWordsByDay.get(cell.dateKey) ?? 0 : 0;
                    const cellQualified = cell.dateKey ? streakQualifiedDateKeys.includes(cell.dateKey) : false;
                    const title = cell.dateKey
                      ? `${cell.dateKey}: ${
                          cellQualified
                            ? cell.isSaved
                              ? `protected sick day, ${cell.streakLength}-day run preserved`
                              : `${cell.streakLength}-day streak earned`
                            : cell.isToday
                              ? `today not earned yet. ${cellCompletedBlocks}/1 block, ${Math.min(
                                  30,
                                  cellFocusMinutes,
                                )}/30 focus minutes, ${Math.min(33, cellNoteWords)}/33 note words`
                              : cellFocusMinutes > 0 || cellCompletedBlocks > 0 || cellNoteWords > 0
                                ? `activity logged, but streak rule not completed`
                                : "no streak"
                        }`
                      : "Outside current month";

                    return (
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
                        title={title}
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
                    );
                  })}
                </div>
                <div className={styles.streakCalendarFooter}>
                  <div className={styles.streakCalendarFooterCopy}>
                    <strong>{streakProtectedToday ? "Today secured" : "Today still open"}</strong>
                    <span>
                      {streakProtectedToday
                        ? streakStatusLine
                        : `${streakProgressBlocksLabel} + (${streakProgressMinutesLabel} or ${streakProgressWordsLabel})`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.secondaryPlanButton}
                    onClick={() => setActiveTab("today")}
                  >
                    Return to Today
                  </button>
                </div>
              </motion.article>
            </AnimatedTabSection>
          )}

          {activeTab === "settings" && (
            <AnimatedTabSection className={styles.settingsGrid} sectionRef={settingsSectionRef}>
              <CompanionPulse {...companionState.pulses.settings} />
              <article className={`${styles.card} ${styles.settingsHeroCard}`} ref={settingsPrimaryRef}>
                <div className={styles.settingsHeroHeader}>
                  <WhelmProfileAvatar
                    tierColor={streakBandanaTier?.color}
                    size="compact"
                    isPro={isPro}
                    photoUrl={currentUserPhotoUrl}
                  />
                  <div>
                    <p className={styles.sectionLabel}>Account</p>
                    <h2 className={styles.cardTitle}>{user.displayName || "Whelm user"}</h2>
                    <p className={styles.accountMeta}>{user.email}</p>
                  </div>
                </div>
                <div className={styles.settingsReadoutGrid}>
                  <article className={styles.settingsReadoutCard}>
                    <span>Bandana</span>
                    <strong>{streakBandanaTier?.label ?? "No tier yet"}</strong>
                    <small>{profileTierTheme.title}</small>
                  </article>
                  <article className={styles.settingsReadoutCard}>
                    <span>Next ascent</span>
                    <strong>
                      {nextBandanaMilestone
                        ? `${nextBandanaMilestone.remainingDays} day${nextBandanaMilestone.remainingDays === 1 ? "" : "s"} left`
                        : "Top tier reached"}
                    </strong>
                    <small>
                      {nextBandanaMilestone
                        ? nextBandanaMilestone.tier.label
                        : "Keep the run alive."}
                    </small>
                  </article>
                  <article className={styles.settingsReadoutCard}>
                    <span>System mode</span>
                    <strong>{companionStyle === "strict" ? "Strict" : companionStyle === "balanced" ? "Balanced" : "Gentle"}</strong>
                    <small>{themeMode === "dark" ? "Dark shell" : "Light shell"}</small>
                  </article>
                </div>
                <div className={styles.settingsPills}>
                  <span className={styles.settingsPill}>
                    Access: {isPro ? "Whelm Pro" : "Whelm Free"}
                  </span>
                  <span className={styles.settingsPill}>
                    Status: {proSource === "preview" ? "Whelm Pro Preview" : isPro ? "Whelm Pro Active" : "Whelm Free"}
                  </span>
                  <span className={styles.settingsPill}>Streak: {streak}d</span>
                </div>
                <div className={styles.settingsActionGrid}>
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
                </div>
                {!isPro ? (
                  <div className={styles.noteFooterActions}>
                    <button
                      type="button"
                      className={styles.inlineUpgrade}
                      onClick={() => void handleStartProPreview()}
                    >
                      Enter Whelm Pro Preview
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
                      Return to Whelm Free
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

              <CollapsibleSectionCard
                label="Whelm Identity"
                title="How this system is running"
                open={settingsSectionsOpen.identity}
                onToggle={() =>
                  setSettingsSectionsOpen((current) => ({ ...current, identity: !current.identity }))
                }
              >
                <ul className={styles.settingsList}>
                  <li>
                    <span>Clean Focus Mode</span>
                    <strong>{isPro ? "Whelm Pro" : "Standard"}</strong>
                  </li>
                  <li>
                    <span>Weekly Report Cards</span>
                    <strong>On</strong>
                  </li>
                  <li>
                    <span>Command Reports</span>
                    <strong>{isPro ? "Full System" : "Core Readout"}</strong>
                  </li>
                </ul>
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                label="Internal Tools"
                title="Preview gated flows"
                description="Open gated flows here without waiting for the live trigger."
                open={settingsSectionsOpen.internalTools}
                onToggle={() =>
                  setSettingsSectionsOpen((current) => ({
                    ...current,
                    internalTools: !current.internalTools,
                  }))
                }
              >
                <div className={styles.settingsActionGrid}>
                  <button
                    type="button"
                    className={styles.reportButton}
                    onClick={openStreakSaveQuestionnairePreview}
                  >
                    Preview Streak Mirror
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryPlanButton}
                    onClick={openDailyPlanningPreview}
                  >
                    Preview daily commitment
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryPlanButton}
                    onClick={openSickDaySavePromptPreview}
                  >
                    Preview streak alert
                  </button>
                </div>
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                label="Protocol"
                title="Whelm tone"
                description="Choose how direct Whelm should feel when keeping you accountable."
                open={settingsSectionsOpen.protocol}
                onToggle={() =>
                  setSettingsSectionsOpen((current) => ({ ...current, protocol: !current.protocol }))
                }
              >
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
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                label="Appearance"
                title="Default theme"
                description="Choose how Whelm opens."
                open={settingsSectionsOpen.appearance}
                onToggle={() =>
                  setSettingsSectionsOpen((current) => ({ ...current, appearance: !current.appearance }))
                }
              >
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
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                label="Whelm Pro"
                title="App background"
                description="Pick the shell background and how much it shows through."
                open={settingsSectionsOpen.background}
                onToggle={() =>
                  setSettingsSectionsOpen((current) => ({ ...current, background: !current.background }))
                }
              >
                {isPro ? (
                  <>
                    <input
                      ref={backgroundUploadInputRef}
                      type="file"
                      accept="image/*"
                      className={styles.backgroundUploadInput}
                      onChange={handleBackgroundUpload}
                    />
                    <div className={styles.backgroundPresetGrid}>
                      <button
                        type="button"
                        className={`${styles.backgroundPresetButton} ${
                          appBackgroundSetting.kind === "default" ? styles.backgroundPresetButtonActive : ""
                        }`}
                        onClick={() => applyBackgroundSetting({ kind: "default" })}
                      >
                        <span className={styles.backgroundPresetSwatch} />
                        <strong>Standard shell</strong>
                      </button>
                      {PRO_BACKGROUND_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          className={`${styles.backgroundPresetButton} ${
                            appBackgroundSetting.kind === "preset" && appBackgroundSetting.value === preset.id
                              ? styles.backgroundPresetButtonActive
                              : ""
                          }`}
                          onClick={() => applyBackgroundSetting({ kind: "preset", value: preset.id })}
                        >
                          <span
                            className={styles.backgroundPresetSwatch}
                            style={{ background: preset.background }}
                          />
                          <strong>{preset.label}</strong>
                        </button>
                      ))}
                    </div>
                    <div className={styles.noteFooterActions}>
                      <button
                        type="button"
                        className={styles.reportButton}
                        onClick={() => backgroundUploadInputRef.current?.click()}
                      >
                        Upload backdrop
                      </button>
                      {appBackgroundSetting.kind === "upload" ? (
                        <button
                          type="button"
                          className={styles.secondaryPlanButton}
                          onClick={() => applyBackgroundSetting({ kind: "default" })}
                        >
                          Return to standard shell
                        </button>
                      ) : null}
                    </div>
                    <div className={styles.backgroundSkinPanel}>
                      <div className={styles.backgroundSkinHeader}>
                        <div>
                          <strong>Surface behavior</strong>
                          <p className={styles.accountMeta}>
                            Default keeps the standard Whelm shell. Adaptive glass opens the shell so your Whelm Pro background can breathe through.
                          </p>
                        </div>
                      </div>
                      <div className={styles.companionStyleRow}>
                        {(
                          [
                            { key: "solid", label: "Standard shell" },
                            { key: "glass", label: "Adaptive glass" },
                          ] as const
                        ).map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            className={`${styles.companionStyleButton} ${
                              backgroundSkin.mode === option.key
                                ? styles.companionStyleButtonActive
                                : ""
                            }`}
                            onClick={() =>
                              setBackgroundSkin((current) => ({ ...current, mode: option.key }))
                            }
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      {backgroundSkin.mode === "glass" ? (
                        <div className={styles.backgroundSkinControls}>
                          {appBackgroundSetting.kind === "upload" ? (
                            <div className={styles.companionStyleRow}>
                              {(
                                [
                                  { key: "fit", label: "Fit image" },
                                  { key: "fill", label: "Fill screen" },
                                ] as const
                              ).map((option) => (
                                <button
                                  key={option.key}
                                  type="button"
                                  className={`${styles.companionStyleButton} ${
                                    backgroundSkin.imageFit === option.key
                                      ? styles.companionStyleButtonActive
                                      : ""
                                  }`}
                                  onClick={() =>
                                    setBackgroundSkin((current) => ({
                                      ...current,
                                      imageFit: option.key,
                                    }))
                                  }
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <label className={styles.backgroundSkinControl}>
                            <span>Background prominence</span>
                            <strong>{Math.round((1 - backgroundSkin.dim) * 100)}%</strong>
                            <input
                              type="range"
                              min="2"
                              max="96"
                              step="1"
                              value={Math.round(backgroundSkin.dim * 100)}
                              onChange={(event) =>
                                setBackgroundSkin((current) => ({
                                  ...current,
                                  dim: Number(event.target.value) / 100,
                                }))
                              }
                            />
                          </label>
                          <label className={styles.backgroundSkinControl}>
                            <span>App surface opacity</span>
                            <strong>{Math.round(backgroundSkin.surfaceOpacity * 100)}%</strong>
                            <input
                              type="range"
                              min="8"
                              max="98"
                              step="1"
                              value={Math.round(backgroundSkin.surfaceOpacity * 100)}
                              onChange={(event) =>
                                setBackgroundSkin((current) => ({
                                  ...current,
                                  surfaceOpacity: Number(event.target.value) / 100,
                                }))
                              }
                            />
                          </label>
                          <label className={styles.backgroundSkinControl}>
                            <span>Glass blur</span>
                            <strong>{backgroundSkin.blur}px</strong>
                            <input
                              type="range"
                              min="0"
                              max="40"
                              step="1"
                              value={backgroundSkin.blur}
                              onChange={(event) =>
                                setBackgroundSkin((current) => ({
                                  ...current,
                                  blur: Number(event.target.value),
                                }))
                              }
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <ProUnlockCard
                    title="Custom backgrounds and uploads"
                    body={`${WHELM_PRO_POSITIONING} Whelm Pro includes alternate full-app background designs plus your own uploaded wallpaper.`}
                    open={proPanelsOpen.background}
                    onToggle={() =>
                      setProPanelsOpen((current) => ({ ...current, background: !current.background }))
                    }
                    onPreview={() => void handleStartProPreview()}
                  />
                )}
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                label="Sync"
                title="Notes status"
                open={settingsSectionsOpen.sync}
                onToggle={() =>
                  setSettingsSectionsOpen((current) => ({ ...current, sync: !current.sync }))
                }
              >
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
                    Retry notes sync
                  </button>
                )}
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                label="Screen Time"
                title="Device focus permission"
                open={settingsSectionsOpen.screenTime}
                onToggle={() =>
                  setSettingsSectionsOpen((current) => ({
                    ...current,
                    screenTime: !current.screenTime,
                  }))
                }
              >
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
                      {screenTimeBusy ? "Working..." : "Enable Screen Time Access"}
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
                  <li>This enables Screen Time APIs through Apple&apos;s permission flow.</li>
                  <li>Detailed per-app charts require the Device Activity report extension.</li>
                </ul>
              </CollapsibleSectionCard>

              <CollapsibleSectionCard
                className={styles.accountDangerCard}
                label="Account"
                title="Delete account"
                description="Permanently delete your Whelm account, notes, sessions, and local app data."
                open={settingsSectionsOpen.danger}
                onToggle={() =>
                  setSettingsSectionsOpen((current) => ({ ...current, danger: !current.danger }))
                }
              >
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
              </CollapsibleSectionCard>
            </AnimatedTabSection>
          )}
        </section>
      </div>

      <nav className={styles.bottomTabs}>
        {MOBILE_PRIMARY_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`${styles.bottomTabButton} ${
              tab.key === "leaderboard" ? styles.bottomTabButtonLeaderboard : ""
            } ${activeTab === tab.key ? styles.bottomTabButtonActive : ""}`}
            onClick={() => handleMobileTabSelect(tab.key)}
          >
            <span
              className={`${styles.bottomTabIcon} ${
                tab.key === "leaderboard" ? styles.bottomTabIconLeaderboard : ""
              }`}
            >
              {iconForTab(tab.key)}
            </span>
            <span
              className={tab.key === "leaderboard" ? styles.bottomTabLabelLeaderboard : undefined}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </nav>

      <button
        type="button"
        className={`${styles.mobileMoreFab} ${mobileMoreActive || mobileMoreOpen ? styles.mobileMoreFabActive : ""}`}
        onClick={() => setMobileMoreOpen(true)}
      >
        <span className={styles.mobileMoreFabIcon}>{iconForNavKey("more")}</span>
        <span>More</span>
      </button>

      <AnimatePresence>
        {sessionReward ? (
          <SessionRewardToast reward={sessionReward} onDismiss={() => setSessionReward(null)} />
        ) : null}
      </AnimatePresence>

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
              <h2 className={styles.feedbackTitle}>More</h2>
              <button
                type="button"
                className={styles.feedbackClose}
                onClick={() => setMobileMoreOpen(false)}
              >
                Close
              </button>
            </div>
            <article className={styles.mobileMoreHero}>
              <span>Jump lanes</span>
              <strong>Open the deeper Whelm surfaces quickly.</strong>
              <small>Everything here should feel like a deliberate jump, not a buried overflow menu.</small>
            </article>
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
                  <small>{mobileTabDescription(tab)}</small>
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

      {dailyPlanningLocked && !dailyPlanningOpen && (
        <div className={styles.dailyLockOverlay} onClick={() => setDailyPlanningOpen(true)}>
          <div className={styles.dailyLockCard} onClick={(event) => event.stopPropagation()}>
            <p className={styles.sectionLabel}>Daily Entry Commitment</p>
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
                <p className={styles.sectionLabel}>Daily Entry Commitment</p>
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
                onClick={claimSickDaySave}
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

      <MilestoneReveal
        open={Boolean(milestoneRevealTier)}
        streak={displayStreak}
        tier={milestoneRevealTier}
        onOpenChange={(open) => {
          if (!open) {
            setMilestoneRevealTier(null);
          }
        }}
      />

      {sickDaySavePromptOpen && ((rawYesterdayMissed && !yesterdaySave) || sickDaySavePromptPreview) && (
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
  );
}
