"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EmailAuthProvider,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signOut,
  type User,
} from "firebase/auth";

import SenseiFigure, { type SenseiVariant } from "@/components/SenseiFigure";
import Timer from "@/components/Timer";
import WhelmRitualScene from "@/components/WhelmRitualScene";
import { auth } from "@/lib/firebase";
import {
  loadNotes,
  retryNotesSync,
  saveNotes,
  type WorkspaceNote,
} from "@/lib/notes-store";
import { loadSessions, saveSession } from "@/lib/session-store";
import { computeStreak, type SessionDoc } from "@/lib/streak";
import {
  getProState,
  restoreFreeTier,
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
import styles from "./page.module.css";

const FOCUS_TIMER = {
  title: "Multipurpose focus timer",
  subtitle: "Use countdown or stopwatch for any work",
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
    title: "Protect the first serious hour.",
    body: "What begins scattered usually stays scattered. Give the first clean block to the work that matters most.",
    signatureLine: "Early order creates later freedom.",
  },
  {
    title: "Remove friction before you need discipline.",
    body: "Discipline is stronger when the path is already clear. Prepare the desk, the tab, and the task before you begin.",
    signatureLine: "Preparation is quiet productivity.",
  },
  {
    title: "Small completions build real momentum.",
    body: "Do not wait for a perfect wave of energy. Finish one meaningful piece, then let progress pull you forward.",
    signatureLine: "Motion respects the one who starts.",
  },
  {
    title: "Attention is a gate, not a flood.",
    body: "Let fewer things through. A focused day is often just a day with fewer unnecessary openings.",
    signatureLine: "Guard attention like a scarce asset.",
  },
  {
    title: "Return quickly after interruption.",
    body: "The danger is rarely the interruption itself. The danger is drifting after it. Re-entry is a skill.",
    signatureLine: "Come back before noise settles in.",
  },
  {
    title: "Depth beats intensity.",
    body: "You do not need a dramatic sprint every hour. You need enough calm pressure to stay with the work until it yields.",
    signatureLine: "Steady force outlasts bursts.",
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

type FeedbackCategory = "bug" | "feature" | "other";
type TrendRange = 7 | 30 | 90;
type CalendarView = "month" | "day";
type AppTab =
  | "today"
  | "calendar"
  | "notes"
  | "insights"
  | "history"
  | "reports"
  | "settings";
type NoteCategory = "personal" | "school" | "work";
type InsightMetric = "focus" | "notes" | "planned" | "reminders";
type SenseiTone = "steady" | "nudge" | "momentum" | "milestone";

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

type SessionDayGroup = {
  key: string;
  label: string;
  totalMinutes: number;
  items: SessionDoc[];
};

type PlannedBlock = {
  id: string;
  dateKey: string;
  title: string;
  durationMinutes: number;
  timeOfDay: string;
  sortOrder: number;
  createdAtISO: string;
};

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

function iconForTab(tab: AppTab) {
  switch (tab) {
    case "today":
      return "◉";
    case "calendar":
      return "▦";
    case "notes":
      return "✎";
    case "insights":
      return "◍";
    case "history":
      return "☰";
    case "reports":
      return "◔";
    case "settings":
      return "⚙";
  }
}

function tabTitle(tab: AppTab) {
  switch (tab) {
    case "today":
      return "Today";
    case "calendar":
      return "Calendar";
    case "notes":
      return "Notes";
    case "insights":
      return "Insights";
    case "history":
      return "History";
    case "reports":
      return "Reports";
    case "settings":
      return "Settings";
  }
}

function plannedBlocksStorageKey(uid: string) {
  return `whelm:planned-focus:${uid}`;
}

function senseiStyleStorageKey(uid: string) {
  return `whelm:sensei-style:${uid}`;
}

function clearLocalAccountData(uid: string) {
  window.localStorage.removeItem(`whelm:notes:${uid}`);
  window.localStorage.removeItem(`whelm:sessions:${uid}`);
  window.localStorage.removeItem(plannedBlocksStorageKey(uid));
  window.localStorage.removeItem(senseiStyleStorageKey(uid));
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
        durationMinutes: Math.min(240, Math.max(5, Number(item.durationMinutes) || 25)),
        timeOfDay: String(item.timeOfDay || "09:00").slice(0, 5),
        sortOrder: Number((item as Partial<PlannedBlock>).sortOrder) || 0,
        createdAtISO: item.createdAtISO || new Date().toISOString(),
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

const TAB_META: Array<{ key: AppTab; label: string }> = [
  { key: "today", label: "Today" },
  { key: "calendar", label: "Calendar" },
  { key: "notes", label: "Notes" },
  { key: "insights", label: "Insights" },
  { key: "history", label: "History" },
  { key: "reports", label: "Reports" },
  { key: "settings", label: "Settings" },
];

const MOBILE_PRIMARY_TABS: Array<{ key: AppTab | "more"; label: string }> = [
  { key: "today", label: "Today" },
  { key: "calendar", label: "Calendar" },
  { key: "notes", label: "Notes" },
  { key: "more", label: "More" },
];

const MOBILE_MORE_TABS: AppTab[] = ["insights", "history", "reports", "settings"];

const INTRO_SPLASH_MS = 2600;

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
  const [landingWisdomMinute, setLandingWisdomMinute] = useState(() => Math.floor(Date.now() / 60000));
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [reportCopyStatus, setReportCopyStatus] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [senseiReaction, setSenseiReaction] = useState("");
  const [companionStyle, setCompanionStyle] = useState<SenseiCompanionStyle>("balanced");
  const [isPro, setIsPro] = useState(false);
  const [proSource, setProSource] = useState<"preview" | "store" | "none">("none");
  const [trendRange, setTrendRange] = useState<TrendRange>(7);
  const [activeTab, setActiveTab] = useState<AppTab>("today");
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
  const [calendarHoverEntryId, setCalendarHoverEntryId] = useState<string | null>(null);
  const [calendarPinnedEntryId, setCalendarPinnedEntryId] = useState<string | null>(null);
  const [planTitle, setPlanTitle] = useState("");
  const [planDuration, setPlanDuration] = useState(25);
  const [planTime, setPlanTime] = useState("09:00");
  const [planStatus, setPlanStatus] = useState("");
  const [calendarJumpDate, setCalendarJumpDate] = useState<string>(() => dayKeyLocal(new Date()));
  const [kpiDetailOpen, setKpiDetailOpen] = useState<KpiDetailKey | null>(null);
  const [draggedPlanId, setDraggedPlanId] = useState<string | null>(null);
  const [noteUndoItem, setNoteUndoItem] = useState<WorkspaceNote | null>(null);
  const [deletedPlanUndo, setDeletedPlanUndo] = useState<PlannedBlock | null>(null);
  const [screenTimeStatus, setScreenTimeStatus] =
    useState<ScreenTimeAuthorizationStatus>("unsupported");
  const [screenTimeSupported, setScreenTimeSupported] = useState(false);
  const [screenTimeReason, setScreenTimeReason] = useState("");
  const [screenTimeBusy, setScreenTimeBusy] = useState(false);
  const [accountDangerStatus, setAccountDangerStatus] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const syncInFlightRef = useRef(false);

  const streak = computeStreak(sessions);

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

  const sessionGroups = useMemo<SessionDayGroup[]>(() => {
    const grouped = new Map<string, SessionDoc[]>();

    for (const session of sessions) {
      const key = dayKeyLocal(session.completedAtISO);
      const existing = grouped.get(key) ?? [];
      existing.push(session);
      grouped.set(key, existing);
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([key, items]) => ({
        key,
        label: new Date(items[0]?.completedAtISO ?? `${key}T00:00:00`).toLocaleDateString(
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

  const todayPlannedBlocks = useMemo(
    () => plannedBlocks.filter((item) => item.dateKey === dayKeyLocal(new Date())),
    [plannedBlocks],
  );

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

  const companionState = useMemo(
    () =>
      buildSenseiCompanionState({
        now: new Date(),
        activeTab,
        totalSessions: reportMetrics.sessionCount,
        totalMinutes: reportMetrics.totalMinutes,
        todaySessions: focusMetrics.todaySessions,
        todayMinutes: focusMetrics.todayMinutes,
        weekMinutes: focusMetrics.weekMinutes,
        streak,
        dueReminders: dueReminderNotes.length,
        plannedTodayCount: todayPlannedBlocks.length,
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
      activeTab,
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
      streak,
      todayPlannedBlocks.length,
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
    if (!showIntroSplash) return;
    const timeoutId = window.setTimeout(() => {
      setIntroFinished(true);
    }, INTRO_SPLASH_MS);
    return () => window.clearTimeout(timeoutId);
  }, [showIntroSplash]);

  useEffect(() => {
    if (!showIntroSplash) return;
    if (!introFinished || !authChecked) return;
    setShowIntroSplash(false);
  }, [authChecked, introFinished, showIntroSplash]);

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
        setUser(null);
        setSessions([]);
        setNotes([]);
        setPlannedBlocks([]);
        setSelectedNoteId(null);
        setSelectedCalendarDate(null);
        setAuthChecked(true);
        router.push("/login");
        return;
      }

      setUser(nextUser);
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
    function onOnline() {
      if (!user || notes.length === 0) return;
      void handleRetrySync();
    }

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [notes, user]);

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

  async function completeSession(note: string, minutesSpent: number) {
    if (!user) return;

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
    setSenseiReaction(
      buildSenseiReaction({
        source: "timer",
        minutesSpent,
        todaySessions: countSessionsForDate(nextSessions, dayKeyLocal(new Date())),
        streak: computeStreak(nextSessions),
      }),
    );
  }

  async function createWorkspaceNote() {
    if (!user) return;

    const nextNote = createNote();
    const nextNotes = [nextNote, ...notes];
    setNotes(nextNotes);
    setSelectedNoteId(nextNote.id);
    setActiveTab("notes");
    const result = await saveNotes(user, nextNotes);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
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

      router.push("/login");
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

  function handleMobileTabSelect(tab: AppTab | "more") {
    if (tab === "more") {
      setMobileMoreOpen(true);
      return;
    }

    setMobileMoreOpen(false);
    setActiveTab(tab);
  }

  function convertNoteToPlannedBlock(note: WorkspaceNote) {
    if (!user) return;
    const next: PlannedBlock = {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`,
      dateKey: selectedDateKey,
      title: note.title || "Untitled note task",
      durationMinutes: 25,
      timeOfDay: "09:00",
      sortOrder:
        selectedDatePlans.length === 0
          ? 0
          : Math.max(...selectedDatePlans.map((item) => item.sortOrder)) + 1,
      createdAtISO: new Date().toISOString(),
    };
    const updated = [...plannedBlocks, next];
    setPlannedBlocks(updated);
    savePlannedBlocks(user.uid, updated);
    setActiveTab("calendar");
    setPlanStatus("Note converted to a planned block.");
    window.setTimeout(() => setPlanStatus(""), 1400);
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
  const selectedDatePlans = plannedBlocks
    .filter((item) => item.dateKey === selectedDateKey)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.timeOfDay.localeCompare(b.timeOfDay));
  const plannedBlockById = useMemo(
    () => new Map(plannedBlocks.map((item) => [item.id, item])),
    [plannedBlocks],
  );
  const calendarEntriesByDate = useMemo(() => {
    const entries = new Map<string, CalendarEntry[]>();

    function pushEntry(dateKey: string, entry: CalendarEntry) {
      const list = entries.get(dateKey) ?? [];
      list.push(entry);
      entries.set(dateKey, list);
    }

    plannedBlocks.forEach((item) => {
      const startMinute = parseTimeToMinutes(item.timeOfDay || "09:00");
      const endMinute = Math.min(24 * 60, startMinute + Math.max(10, item.durationMinutes));
      pushEntry(item.dateKey, {
        id: `plan-${item.id}`,
        source: "plan",
        dateKey: item.dateKey,
        timeLabel: normalizeTimeLabel(item.timeOfDay),
        sortTime: item.timeOfDay || "23:59",
        title: item.title,
        subtitle: `${item.durationMinutes}m focus block`,
        preview: `Planned block: ${item.title} (${item.durationMinutes} minutes) at ${normalizeTimeLabel(
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
        title: session.note?.trim() || `${sessionLabel} session`,
        subtitle: `${session.minutes}m completed`,
        preview: session.note?.trim()
          ? summarizePlainText(session.note, 160)
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
  const selectedDateEntries = calendarEntriesByDate.get(selectedDateKey) ?? [];
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
  const dayViewTimeline = useMemo(() => {
    const defaultStart = 6 * 60;
    const defaultEnd = 22 * 60;
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

    const items = withRange.map((entry) => ({
      ...entry,
      topPct: ((entry.startMinute - startMinute) / totalMinutes) * 100,
      heightPct: (Math.max(10, entry.endMinute - entry.startMinute) / totalMinutes) * 100,
    }));

    const hourTicks: Array<{ minute: number; label: string }> = [];
    for (let minute = startMinute; minute <= endMinute; minute += 60) {
      const hour = Math.floor(minute / 60);
      const suffix = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 === 0 ? 12 : hour % 12;
      hourTicks.push({ minute, label: `${hour12}:00 ${suffix}` });
    }

    return { startMinute, endMinute, totalMinutes, items, hourTicks };
  }, [selectedDateEntries]);
  const calendarEntryById = useMemo(() => {
    const byId = new Map<string, CalendarEntry>();
    calendarEntriesByDate.forEach((items) => {
      items.forEach((entry) => byId.set(entry.id, entry));
    });
    return byId;
  }, [calendarEntriesByDate]);
  const activeCalendarPreview = useMemo(() => {
    const id = calendarHoverEntryId ?? calendarPinnedEntryId;
    if (!id) return null;
    return calendarEntryById.get(id) ?? null;
  }, [calendarEntryById, calendarHoverEntryId, calendarPinnedEntryId]);

  useEffect(() => {
    setCalendarJumpDate(selectedDateKey);
  }, [selectedDateKey]);

  useEffect(() => {
    if (calendarPinnedEntryId && !calendarEntryById.has(calendarPinnedEntryId)) {
      setCalendarPinnedEntryId(null);
    }
    if (calendarHoverEntryId && !calendarEntryById.has(calendarHoverEntryId)) {
      setCalendarHoverEntryId(null);
    }
  }, [calendarEntryById, calendarHoverEntryId, calendarPinnedEntryId]);

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
    if (!user) return;
    const title = planTitle.trim();
    if (!title) {
      setPlanStatus("Write a task title first.");
      return;
    }

    const next: PlannedBlock = {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`,
      dateKey: selectedDateKey,
      title,
      durationMinutes: Math.min(240, Math.max(5, planDuration)),
      timeOfDay: planTime || "09:00",
      sortOrder:
        selectedDatePlans.length === 0
          ? 0
          : Math.max(...selectedDatePlans.map((item) => item.sortOrder)) + 1,
      createdAtISO: new Date().toISOString(),
    };
    const updated = [...plannedBlocks, next];
    setPlannedBlocks(updated);
    savePlannedBlocks(user.uid, updated);
    setPlanTitle("");
    setPlanStatus("Planned block added.");
    window.setTimeout(() => setPlanStatus(""), 1200);
  }

  function deletePlannedBlock(id: string) {
    if (!user) return;
    const removed = plannedBlocks.find((item) => item.id === id) || null;
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
    const updated = plannedBlocks.map((item) =>
      item.id === id ? { ...item, timeOfDay } : item,
    );
    setPlannedBlocks(updated);
    savePlannedBlocks(user.uid, updated);
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

    const localDateTime = new Date(`${item.dateKey}T${item.timeOfDay}:00`);
    const completedAtISO = Number.isNaN(localDateTime.getTime())
      ? new Date().toISOString()
      : localDateTime.toISOString();

    const session: SessionDoc = {
      uid: user.uid,
      completedAtISO,
      minutes: item.durationMinutes,
      category: "misc",
      note: `Planned block completed: ${item.title}`,
      noteSavedAtISO: new Date().toISOString(),
    };

    const nextSessions = await saveSession(user, session);
    setSessions(nextSessions);
    setSenseiReaction(
      buildSenseiReaction({
        source: "plan",
        minutesSpent: item.durationMinutes,
        todaySessions: countSessionsForDate(nextSessions, dayKeyLocal(new Date())),
        streak: computeStreak(nextSessions),
      }),
    );
    const updated = plannedBlocks.filter((block) => block.id !== item.id);
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
  }

  function jumpToToday() {
    const today = new Date();
    const key = dayKeyLocal(today);
    selectCalendarDate(key);
  }

  function jumpToCalendarSection(sectionId: string) {
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
  const nextPlannedBlock = todayPlannedBlocks[0] ?? null;
  const mobileMoreActive = MOBILE_MORE_TABS.includes(activeTab);
  const maxTrendMinutes = Math.max(30, ...trendPoints.map((point) => point.minutes));
  const trendPath = trendPoints
    .map((point, index) => {
      const x = (index / Math.max(1, trendPoints.length - 1)) * 100;
      const y = 100 - (point.minutes / maxTrendMinutes) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  const activeInsight =
    insightsChart.segments.find((segment) => segment.key === selectedInsightCategory) ??
    insightsChart.ranked[0] ??
    insightsChart.segments[0];

  return (
    <main className={styles.pageShell}>
      <div className={styles.pageFrame}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>WHELM</p>
            <h1 className={styles.title}>Discipline Dashboard</h1>
            <p className={styles.subtitle}>
              A disciplined operating system for focus, notes, insight, history, and momentum.
            </p>
          </div>
          <div className={styles.headerActions}>
            {!isPro && (
              <button type="button" className={styles.upgradeButton} onClick={openUpgradeFlow}>
                Whelm Pro
              </button>
            )}
            <button type="button" onClick={() => signOut(auth)} className={styles.signOutButton}>
              Sign out
            </button>
          </div>
        </header>

        <nav className={styles.tabRail}>
          {TAB_META.map((tab) => (
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
        </nav>

        <section className={styles.screen}>
          <div className={styles.topAppBar}>
            <div>
              <p className={styles.topAppBarLabel}>Whelm OS</p>
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
                className={styles.topAppBarAction}
                onClick={() => {
                  setFeedbackOpen(true);
                  setFeedbackStatus("");
                }}
              >
                Feedback
              </button>
            </div>
          </div>

          {activeTab === "today" && (
            <>
              <section className={styles.mobileTodayStack}>
                <article className={styles.mobileSummaryCard}>
                  <p className={styles.sectionLabel}>Today Summary</p>
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

                <article className={`${styles.card} ${styles.mobileSenseiCard}`}>
                  <div className={styles.mobileSenseiHeader}>
                    <SenseiAvatar message={todayHeroCopy.eyebrow} variant="neutral" compact />
                    <div className={styles.mobileSenseiCopy}>
                      <p className={styles.senseiSpeechEyebrow}>Whelm</p>
                      <p className={styles.mobileSenseiTitle}>{todayHeroCopy.title}</p>
                      <p className={styles.mobileSenseiBody}>{todayHeroCopy.body}</p>
                    </div>
                  </div>
                  <div className={styles.mobileSenseiMetrics}>
                    <span className={styles.senseiMetricPill}>
                      Stance: {formatSenseiLabel(senseiGuidance.ritual)}
                    </span>
                    <span className={styles.senseiMetricPill}>
                      Next: {nextSenseiMilestone.next ?? "Legend"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.reportButton}
                    onClick={() => setActiveTab(senseiGuidance.actionTab as AppTab)}
                  >
                    {senseiGuidance.actionLabel}
                  </button>
                </article>

                <div className={styles.mobileTimerWrap}>
                  <Timer
                    minutes={25}
                    title={FOCUS_TIMER.title}
                    subtitle={FOCUS_TIMER.subtitle}
                    actionLabel={FOCUS_TIMER.actionLabel}
                    theme={FOCUS_TIMER.theme}
                    onComplete={(note, minutesSpent) => completeSession(note, minutesSpent)}
                  />
                </div>

                <article className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div>
                      <p className={styles.sectionLabel}>Today Queue</p>
                      <h2 className={styles.cardTitle}>What needs attention</h2>
                    </div>
                  </div>
                  <div className={styles.mobileQueueList}>
                    <button type="button" className={styles.mobileQueueItem} onClick={() => setActiveTab("reports")}>
                      <span className={styles.mobileQueueLabel}>Summary</span>
                      <strong>
                        {focusMetrics.todaySessions} session{focusMetrics.todaySessions === 1 ? "" : "s"} saved
                      </strong>
                    </button>
                    <button type="button" className={styles.mobileQueueItem} onClick={() => setActiveTab("calendar")}>
                      <span className={styles.mobileQueueLabel}>Next block</span>
                      <strong>
                        {nextPlannedBlock
                          ? `${nextPlannedBlock.title} at ${normalizeTimeLabel(nextPlannedBlock.timeOfDay)}`
                          : "No planned block for today"}
                      </strong>
                    </button>
                    <button type="button" className={styles.mobileQueueItem} onClick={openNotesTab}>
                      <span className={styles.mobileQueueLabel}>Latest note</span>
                      <strong>{latestNote?.title || "Open notes workspace"}</strong>
                    </button>
                    <button type="button" className={styles.mobileQueueItem} onClick={openNotesTab}>
                      <span className={styles.mobileQueueLabel}>Reminders</span>
                      <strong>
                        {dueReminderNotes.length > 0
                          ? `${dueReminderNotes.length} due today`
                          : "No note reminders due today"}
                      </strong>
                    </button>
                  </div>
                </article>
              </section>

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
                      Ready: {todayPlannedBlocks.length}
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
                      onClick={() => setActiveTab(senseiGuidance.actionTab as AppTab)}
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
                    minutes={25}
                    title={FOCUS_TIMER.title}
                    subtitle={FOCUS_TIMER.subtitle}
                    actionLabel={FOCUS_TIMER.actionLabel}
                    theme={FOCUS_TIMER.theme}
                    onComplete={(note, minutesSpent) => completeSession(note, minutesSpent)}
                  />

                  <article className={styles.card}>
                    <div className={styles.cardHeader}>
                      <div>
                        <p className={styles.sectionLabel}>Command Center</p>
                        <h2 className={styles.cardTitle}>Today at a glance</h2>
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
              <CompanionPulse {...companionState.pulses.calendar} />
              <article className={styles.card}>
                <p className={styles.sectionLabel}>
                  {calendarView === "month" ? "Month View" : "Day Timeline"}
                </p>
                <h2 className={styles.cardTitle}>Focus calendar</h2>
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
                  <div className={styles.calendarJumpRow}>
                    <label className={styles.planLabel}>
                      Month / Year
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
                    <label className={styles.planLabel}>
                      Jump to date
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
                    <button
                      type="button"
                      className={styles.secondaryPlanButton}
                      onClick={jumpToToday}
                    >
                      Today
                    </button>
                  </div>
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
                  <div className={styles.calendarSectionNav}>
                    <button
                      type="button"
                      className={styles.calendarSectionButton}
                      onClick={() =>
                        jumpToCalendarSection(
                          calendarView === "day" ? "calendar-day-chamber" : "calendar-main-view",
                        )
                      }
                    >
                      {calendarView === "day" ? "Day chamber" : "Calendar"}
                    </button>
                    <button
                      type="button"
                      className={styles.calendarSectionButton}
                      onClick={() => jumpToCalendarSection("calendar-timeline")}
                    >
                      Timeline
                    </button>
                    <button
                      type="button"
                      className={styles.calendarSectionButton}
                      onClick={() => jumpToCalendarSection("calendar-scheduler")}
                    >
                      Scheduler
                    </button>
                    <button
                      type="button"
                      className={styles.calendarSectionButton}
                      onClick={() => jumpToCalendarSection("calendar-planner")}
                    >
                      Planner
                    </button>
                  </div>
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
                              <p className={styles.sectionLabel}>{selectedDateSummary.eyebrow}</p>
                              <h3 className={styles.dayPortalTitle}>{selectedDateSummary.title}</h3>
                            </div>
                            <button
                              type="button"
                              className={styles.secondaryPlanButton}
                              onClick={() => setCalendarView("month")}
                            >
                              Back to month
                            </button>
                          </div>
                          <p className={styles.dayPortalMeta}>{selectedDateSummary.body}</p>
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
                        </div>
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
                      </div>
                    </div>
                    <div id="calendar-timeline" className={styles.dayViewGrid}>
                      <div className={styles.dayViewTicks}>
                        {dayViewTimeline.hourTicks.map((tick) => (
                          <span key={tick.minute}>{tick.label}</span>
                        ))}
                      </div>
                      <div className={styles.dayViewTrack}>
                        {dayViewTimeline.hourTicks.map((tick) => (
                          <div
                            key={tick.minute}
                            className={styles.dayViewRow}
                            style={{
                              top: `${((tick.minute - dayViewTimeline.startMinute) / dayViewTimeline.totalMinutes) * 100}%`,
                            }}
                          />
                        ))}
                        {dayViewTimeline.items.map((entry) => (
                          <button
                            type="button"
                            key={`timeline-${entry.id}`}
                            className={`${styles.dayViewEvent} ${styles[`dayViewEvent${entry.tone}`]}`}
                            style={{
                              top: `${entry.topPct}%`,
                              height: `${Math.max(7.5, entry.heightPct)}%`,
                            }}
                            onMouseEnter={() => setCalendarHoverEntryId(entry.id)}
                            onMouseLeave={() => setCalendarHoverEntryId((current) =>
                              current === entry.id ? null : current,
                            )}
                            onClick={() =>
                              setCalendarPinnedEntryId((current) => (current === entry.id ? null : entry.id))
                            }
                          >
                            <span className={styles.dayViewEventTime}>{entry.timeLabel}</span>
                            <strong>{entry.title}</strong>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {activeCalendarPreview && (
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

              <article id="calendar-scheduler" className={styles.card}>
                <p className={styles.sectionLabel}>Last 4 Weeks</p>
                <h2 className={styles.cardTitle}>Streak heatmap</h2>
                <div className={styles.streakGrid}>
                  {focusMetrics.calendar.map((day) => (
                    <div
                      key={day.dateKey}
                      className={`${styles.streakCell} ${styles[`streakLevel${day.level}`]}`}
                      title={`${day.label}: ${day.minutes}m`}
                    />
                  ))}
                </div>
                <div className={styles.streakLegend}>
                  <span>No focus</span>
                  <span>Light</span>
                  <span>Strong</span>
                  <span>Deep</span>
                </div>
              </article>

              <article className={styles.card}>
                <p className={styles.sectionLabel}>Scheduler</p>
                <h2 className={styles.cardTitle}>
                  Day agenda for{" "}
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

                <div id="calendar-planner" className={styles.planForm}>
                  <input
                    value={planTitle}
                    onChange={(event) => setPlanTitle(event.target.value)}
                    placeholder="Task title (e.g. Deep work sprint)"
                    className={styles.planInput}
                  />
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
                        min={5}
                        max={240}
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
                    <button type="button" className={styles.planAddButton} onClick={addPlannedBlock}>
                      Add Block
                    </button>
                  </div>
                  {planStatus && <p className={styles.accountMeta}>{planStatus}</p>}
                </div>

                <div className={styles.planList}>
                  {selectedDatePlans.length === 0 ? (
                    <p className={styles.emptyText}>No planned blocks yet for this day.</p>
                  ) : (
                    selectedDatePlans.map((item) => (
                      <div
                        key={item.id}
                        className={styles.planItem}
                        draggable
                        onDragStart={() => setDraggedPlanId(item.id)}
                        onDragEnd={() => setDraggedPlanId(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (!draggedPlanId) return;
                          reorderPlannedBlocks(draggedPlanId, item.id);
                          setDraggedPlanId(null);
                        }}
                      >
                        <div>
                          <strong>{item.title}</strong>
                          <div className={styles.planMetaRow}>
                            <input
                              type="time"
                              value={item.timeOfDay}
                              className={styles.planItemTime}
                              onChange={(event) =>
                                updatePlannedBlockTime(item.id, event.target.value)
                              }
                            />
                            <span>{item.durationMinutes}m</span>
                          </div>
                        </div>
                        <div className={styles.planActions}>
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
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>
          )}

          {activeTab === "notes" && (
            <section className={styles.notesWorkspace}>
              <CompanionPulse {...companionState.pulses.notes} />
              <aside className={styles.notesSidebar}>
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

              <article className={styles.notesEditorCard}>
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
                        <h2 className={styles.cardTitle}>Elite notes, not scratch paper</h2>
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
                          className={styles.reportButton}
                          onClick={() => convertNoteToPlannedBlock(selectedNote)}
                        >
                          Convert to Plan
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
            </section>
          )}

          {activeTab === "insights" && (
            <section className={styles.insightsGrid}>
              <CompanionPulse {...companionState.pulses.insights} />
              <article className={`${styles.card} ${styles.insightsHeroCard}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Insights</p>
                    <h2 className={styles.cardTitle}>Productivity pie chart</h2>
                    <p className={styles.accountMeta}>
                      Visual breakdown by category for your most important behavior signals.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.reportButton}
                    onClick={() => setActiveTab("reports")}
                  >
                    Open full reports
                  </button>
                </div>

                <div className={styles.insightControls}>
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
                  <div className={styles.rangeTabs}>
                    <button
                      type="button"
                      className={`${styles.rangeTab} ${insightMetric === "focus" ? styles.rangeTabActive : ""}`}
                      onClick={() => setInsightMetric("focus")}
                    >
                      Focus
                    </button>
                    <button
                      type="button"
                      className={`${styles.rangeTab} ${insightMetric === "notes" ? styles.rangeTabActive : ""}`}
                      onClick={() => setInsightMetric("notes")}
                    >
                      Notes
                    </button>
                    <button
                      type="button"
                      className={`${styles.rangeTab} ${insightMetric === "planned" ? styles.rangeTabActive : ""}`}
                      onClick={() => setInsightMetric("planned")}
                    >
                      Planned
                    </button>
                    <button
                      type="button"
                      className={`${styles.rangeTab} ${insightMetric === "reminders" ? styles.rangeTabActive : ""}`}
                      onClick={() => setInsightMetric("reminders")}
                    >
                      Reminders
                    </button>
                  </div>
                </div>

                <div className={styles.insightBody}>
                  <div className={styles.insightDonutWrap}>
                    <button
                      type="button"
                      className={styles.insightDonut}
                      style={{ backgroundImage: insightsChart.donutGradient }}
                      onClick={() =>
                        setSelectedInsightCategory(
                          insightsChart.topCategory?.key ?? selectedInsightCategory ?? "personal",
                        )
                      }
                    >
                      <span className={styles.insightDonutCenter}>
                        <strong>
                          {insightsChart.total}
                          {insightsChart.unitSuffix}
                        </strong>
                        <small>{insightsChart.metricLabel}</small>
                      </span>
                    </button>
                    <p className={styles.accountMeta}>{insightsChart.windowLabel}</p>
                  </div>

                  <div className={styles.insightLegend}>
                    {insightsChart.ranked.map((segment) => {
                      const share =
                        insightsChart.total === 0
                          ? 0
                          : Math.round((segment.value / insightsChart.total) * 100);
                      const isSelected = activeInsight?.key === segment.key;

                      return (
                        <button
                          type="button"
                          key={segment.key}
                          className={`${styles.insightLegendItem} ${
                            isSelected ? styles.insightLegendItemActive : ""
                          }`}
                          onClick={() => setSelectedInsightCategory(segment.key)}
                        >
                          <span
                            className={styles.insightLegendSwatch}
                            style={{ backgroundColor: segment.color }}
                          />
                          <span className={styles.insightLegendLabel}>{segment.label}</span>
                          <strong className={styles.insightLegendValue}>
                            {segment.value}
                            {insightsChart.unitSuffix}
                          </strong>
                          <small className={styles.insightLegendShare}>{share}%</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </article>

              <article className={styles.card}>
                <p className={styles.sectionLabel}>Selected Category</p>
                <h2 className={styles.cardTitle}>{activeInsight?.label ?? "Category detail"}</h2>
                <p className={styles.accountMeta}>
                  {activeInsight?.description ?? "No category detail available yet."}
                </p>
                <ul className={styles.commandList}>
                  <li>
                    Metric value:{" "}
                    <strong>
                      {activeInsight?.value ?? 0}
                      {insightsChart.unitSuffix}
                    </strong>
                  </li>
                  <li>
                    Share of window:{" "}
                    <strong>
                      {insightsChart.total === 0 || !activeInsight
                        ? 0
                        : Math.round((activeInsight.value / insightsChart.total) * 100)}
                      %
                    </strong>
                  </li>
                  <li>Top category: <strong>{insightsChart.topCategory?.label ?? "None yet"}</strong></li>
                </ul>
              </article>

              <article className={styles.card}>
                <p className={styles.sectionLabel}>Action Tip</p>
                <h2 className={styles.cardTitle}>How to use this tab daily</h2>
                <ul className={styles.commandList}>
                  <li>Check which category is dominating this week.</li>
                  <li>Rebalance by scheduling at least one focus block in your weakest category.</li>
                  <li>Use Notes reminders to increase follow-through.</li>
                </ul>
              </article>

              <article className={styles.card}>
                <p className={styles.sectionLabel}>Apple Screen Time</p>
                <h2 className={styles.cardTitle}>System usage integration</h2>
                <p className={styles.accountMeta}>
                  {screenTimeStatus === "approved"
                    ? "Permission granted. Next: attach Device Activity report extension in Xcode."
                    : "Grant permission to connect Apple Screen Time data into Whelm."}
                </p>
                <div className={styles.noteFooterActions}>
                  <button
                    type="button"
                    className={styles.reportButton}
                    onClick={() => void handleRequestScreenTimeAuth()}
                    disabled={!screenTimeSupported || screenTimeBusy}
                  >
                    {screenTimeBusy ? "Working..." : "Enable Screen Time"}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryPlanButton}
                    onClick={() => setActiveTab("settings")}
                  >
                    Open setup panel
                  </button>
                </div>
              </article>
            </section>
          )}

          {activeTab === "history" && (
            <section className={styles.historyShell}>
              <CompanionPulse {...companionState.pulses.history} />
              <article className={styles.card}>
                <p className={styles.sectionLabel}>History</p>
                <h2 className={styles.cardTitle}>Session log</h2>
                {sessionGroups.length === 0 ? (
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
                    {sessionGroups.map((group) => (
                      <section key={group.key} className={styles.sessionGroup}>
                        <header className={styles.groupHeader}>
                          <h3>{group.label}</h3>
                          <span>{group.totalMinutes}m</span>
                        </header>
                        <div className={styles.sessionList}>
                          {group.items.map((session, index) => (
                            <div key={`${session.completedAtISO}-${index}`} className={styles.sessionItem}>
                              <div>
                                <div className={styles.sessionPrimary}>
                                  {new Date(session.completedAtISO).toLocaleTimeString([], {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </div>
                                {session.note && <div className={styles.sessionNote}>{session.note}</div>}
                              </div>
                              <div className={styles.sessionMinutes}>{session.minutes}m</div>
                            </div>
                          ))}
                        </div>
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
              <article className={styles.card}>
                <p className={styles.sectionLabel}>KPI Snapshot</p>
                <h2 className={styles.cardTitle}>Performance dashboard</h2>
                <div className={styles.kpiGrid}>
                  <button
                    type="button"
                    className={styles.kpiItem}
                    onClick={() => setKpiDetailOpen("totalFocus")}
                  >
                    <span>Total Focus</span>
                    <strong>{reportMetrics.totalMinutes}m</strong>
                  </button>
                  <button
                    type="button"
                    className={styles.kpiItem}
                    onClick={() => setKpiDetailOpen("totalSessions")}
                  >
                    <span>Total Sessions</span>
                    <strong>{reportMetrics.sessionCount}</strong>
                  </button>
                  <button
                    type="button"
                    className={styles.kpiItem}
                    onClick={() => setKpiDetailOpen("averageSession")}
                  >
                    <span>Avg Session</span>
                    <strong>{reportMetrics.averageSession}m</strong>
                  </button>
                  <button
                    type="button"
                    className={styles.kpiItem}
                    onClick={() => setKpiDetailOpen("bestDay")}
                  >
                    <span>Best Day</span>
                    <strong>
                      {reportMetrics.bestTrendLabel} · {reportMetrics.bestTrendMinutes}m
                    </strong>
                  </button>
                  <div className={styles.kpiItemStatic}>
                    <span>Planned Completed</span>
                    <strong>{reportMetrics.plannedCompletionCount}</strong>
                  </div>
                  <div className={styles.kpiItemStatic}>
                    <span>Notes Updated (7d)</span>
                    <strong>{reportMetrics.notesUpdated7d}</strong>
                  </div>
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${reportMetrics.weeklyProgress}%` }}
                  />
                </div>
                <p className={styles.accountMeta}>
                  Weekly target progress: {reportMetrics.weeklyProgress}% of 420m
                </p>
                <button
                  type="button"
                  className={styles.reportButton}
                  onClick={() => setKpiDetailOpen("weeklyProgress")}
                >
                  View weekly target details
                </button>
              </article>

              <article className={styles.card}>
                <p className={styles.sectionLabel}>Notes Analytics</p>
                <h2 className={styles.cardTitle}>Knowledge activity</h2>
                <ul className={styles.commandList}>
                  <li>
                    <strong>{reportMetrics.notesUpdated7d}</strong> notes updated in the last 7 days
                  </li>
                  <li>
                    <strong>{reportMetrics.notesWithReminders}</strong> notes with reminders
                  </li>
                  <li>
                    <strong>{reportMetrics.plannedCompletionCount}</strong> planned blocks converted to sessions
                  </li>
                </ul>
                {!isPro && (
                  <div className={styles.cardGateRow}>
                    <span>Deep note analytics are part of Whelm Pro, coming soon.</span>
                    <button type="button" className={styles.inlineUpgrade} onClick={openUpgradeFlow}>
                      Learn more
                    </button>
                  </div>
                )}
              </article>

              <article className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Focus Trend</p>
                    <h2 className={styles.cardTitle}>Performance view</h2>
                  </div>
                  <div className={styles.rangeTabs}>
                    <button
                      type="button"
                      className={`${styles.rangeTab} ${trendRange === 7 ? styles.rangeTabActive : ""}`}
                      onClick={() => setTrendRange(7)}
                    >
                      7d
                    </button>
                    <button
                      type="button"
                      className={`${styles.rangeTab} ${trendRange === 30 ? styles.rangeTabActive : ""}`}
                      onClick={() => setTrendRange(30)}
                    >
                      30d
                    </button>
                    <button
                      type="button"
                      className={`${styles.rangeTab} ${trendRange === 90 ? styles.rangeTabActive : ""}`}
                      onClick={() => setTrendRange(90)}
                    >
                      90d
                    </button>
                  </div>
                </div>

                <div className={styles.chartFrame}>
                  <svg viewBox="0 0 100 100" className={styles.trendChart} preserveAspectRatio="none">
                    <polyline points={trendPath} className={styles.trendLine} />
                  </svg>
                  <div className={styles.chartAxis}>
                    {trendPoints
                      .map((point, index) => (
                        <span key={`${point.label}-${index}`}>{point.label}</span>
                      ))
                      .filter((_, index) =>
                        trendRange === 7
                          ? true
                          : trendRange === 30
                            ? index % 5 === 0 || index === trendPoints.length - 1
                            : index % 15 === 0 || index === trendPoints.length - 1,
                      )}
                  </div>
                  {!isPro && (
                    <div className={styles.chartLock}>
                      <p>Whelm Pro will add full trend analytics and deeper score breakdowns.</p>
                      <button type="button" className={styles.inlineUpgrade} onClick={openUpgradeFlow}>
                        See what&apos;s coming
                      </button>
                    </div>
                  )}
                </div>
              </article>

              <article className={styles.card}>
                <p className={styles.sectionLabel}>Behavior Loop</p>
                <h2 className={styles.cardTitle}>Retention drivers</h2>
                <ul className={styles.commandList}>
                  <li>Protect streak daily with one focused session.</li>
                  <li>Beat yesterday&apos;s score every day.</li>
                  <li>Use weekly report sharing for accountability.</li>
                  <li>Pin mission-critical notes at the top.</li>
                </ul>
              </article>

              <article className={styles.proPreviewCard}>
                <div className={styles.proPreviewTop}>
                  <p className={styles.proEyebrow}>WHELM PRO</p>
                  <span className={styles.proBadge}>Coming soon</span>
                </div>
                <h3 className={styles.proTitle}>Advanced discipline tools are on the way</h3>
                <ul className={styles.proList}>
                  <li>Deep report filters and longer trend windows</li>
                  <li>Custom score weighting and daily insights</li>
                  <li>No ads + cleaner focus experience</li>
                  <li>Motivation prompts and precise planning tools</li>
                </ul>
                <button type="button" className={styles.proCta} onClick={openUpgradeFlow}>
                  View Pro preview
                </button>
              </article>
            </section>
          )}

          {activeTab === "settings" && (
            <section className={styles.settingsGrid}>
              <CompanionPulse {...companionState.pulses.settings} />
              <article className={`${styles.card} ${styles.settingsHeroCard}`}>
                <div className={styles.settingsHeroHeader}>
                  <div className={styles.settingsAvatar}>
                    {(user.displayName || user.email || "W")[0]?.toUpperCase()}
                  </div>
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
                  <span className={styles.settingsPill}>Streak: {streak}d</span>
                  <span className={styles.settingsPill}>
                    Score: {focusMetrics.disciplineScore}/100
                  </span>
                </div>
                {!isPro ? (
                  <div className={styles.noteFooterActions}>
                    <button type="button" className={styles.inlineUpgrade} onClick={openUpgradeFlow}>
                      Whelm Pro coming soon
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
                <h2 className={styles.cardTitle}>Experience</h2>
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
                    <span>Behavior Insights</span>
                    <strong>{isPro ? "Full" : "Growing"}</strong>
                  </li>
                </ul>
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
                <h2 className={styles.cardTitle}>Need help?</h2>
                <button
                  type="button"
                  className={styles.reportButton}
                  onClick={() => {
                    setFeedbackOpen(true);
                    setFeedbackStatus("");
                  }}
                >
                  Send feedback
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
              {tab.key === "more" ? "⋯" : iconForTab(tab.key)}
            </span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

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
              <h2 className={styles.feedbackTitle}>Whelm Pro is on the way</h2>
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
                <p className={styles.planPrice}>Coming soon</p>
                <p className={styles.planMeta}>early users will receive a strong launch offer</p>
              </article>
            </div>
            <ul className={styles.proList}>
              <li>Advanced discipline insights and score history</li>
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
