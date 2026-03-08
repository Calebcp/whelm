"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";

import Timer from "@/components/Timer";
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
  isStorePurchaseSupported,
  restoreFreeTier,
  startProPreview,
} from "@/lib/subscription";
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
    ring: "rgba(20, 93, 160, 0.18)",
  },
};

const NOTE_COLORS: Array<{ label: string; value: string }> = [
  { label: "Cherry", value: "#fecaca" },
  { label: "Rose", value: "#fda4af" },
  { label: "Tangerine", value: "#fed7aa" },
  { label: "Amber", value: "#fcd34d" },
  { label: "Sun", value: "#fef08a" },
  { label: "Lime", value: "#d9f99d" },
  { label: "Mint", value: "#bbf7d0" },
  { label: "Emerald", value: "#6ee7b7" },
  { label: "Aqua", value: "#a5f3fc" },
  { label: "Sky", value: "#bae6fd" },
  { label: "Blue", value: "#bfdbfe" },
  { label: "Indigo", value: "#c7d2fe" },
  { label: "Violet", value: "#ddd6fe" },
  { label: "Purple", value: "#e9d5ff" },
  { label: "Fuchsia", value: "#f5d0fe" },
  { label: "Pink", value: "#fbcfe8" },
  { label: "Stone", value: "#e7e5e4" },
  { label: "Slate", value: "#cbd5e1" },
  { label: "Cloud", value: "#f1f5f9" },
  { label: "Paper", value: "#f8fafc" },
];

type FeedbackCategory = "bug" | "feature" | "other";
type WorkspaceView = "focus" | "notes";
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
type TrendPoint = {
  label: string;
  minutes: number;
};
type TrendRange = 7 | 30 | 90;

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

  // Migrate legacy notes that ended up double-escaped (e.g. "&amp;nbsp;").
  for (let i = 0; i < 3; i += 1) {
    const decoded = decodeHtmlEntities(next);
    if (decoded === next) break;
    next = decoded;
  }

  return next;
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

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [notes, setNotes] = useState<WorkspaceNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [editorBodyDraft, setEditorBodyDraft] = useState("");
  const [notesSyncStatus, setNotesSyncStatus] = useState<
    "synced" | "local-only" | "syncing"
  >("syncing");
  const [notesSyncMessage, setNotesSyncMessage] = useState("");
  const [activeView, setActiveView] = useState<WorkspaceView>("focus");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [reportCopyStatus, setReportCopyStatus] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [proSource, setProSource] = useState<"preview" | "store" | "none">("none");
  const [trendRange, setTrendRange] = useState<TrendRange>(7);
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
          label: days <= 7
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
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setSessions([]);
        setNotes([]);
        setSelectedNoteId(null);
        setAuthChecked(true);
        router.push("/login");
        return;
      }

      setUser(nextUser);
      try {
        await Promise.all([refreshSessions(nextUser.uid), refreshNotes(nextUser.uid)]);
      } finally {
        setAuthChecked(true);
      }
    });

    return () => unsub();
  }, [router]);

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
  }

  async function createWorkspaceNote() {
    if (!user) return;

    const nextNote = createNote();
    const nextNotes = [nextNote, ...notes];
    setNotes(nextNotes);
    setSelectedNoteId(nextNote.id);
    setActiveView("notes");
    const result = await saveNotes(user, nextNotes);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }

  async function updateSelectedNote(
    patch: Partial<
      Pick<
        WorkspaceNote,
        "title" | "body" | "color" | "isPinned" | "fontFamily" | "fontSizePx"
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

  async function deleteNote(noteId: string) {
    if (!user) return;

    const nextNotes = notes.filter((note) => note.id !== noteId);
    setNotes(nextNotes);
    setSelectedNoteId((current) => (current === noteId ? nextNotes[0]?.id ?? null : current));
    const result = await saveNotes(user, nextNotes);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
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

  async function handlePreviewUpgrade() {
    const next = await startProPreview();
    setIsPro(next.isPro);
    setProSource(next.source);
    setPaywallOpen(false);
  }

  async function handleRestoreFreeTier() {
    const next = await restoreFreeTier();
    setIsPro(next.isPro);
    setProSource(next.source);
  }

  if (!authChecked) {
    return (
      <main className={styles.pageShell}>
        <div className={styles.loadingCard}>
          <p className={styles.loadingLabel}>Preparing your WHELM session...</p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const lastSession = sessions[0];
  const maxTrendMinutes = Math.max(30, ...trendPoints.map((point) => point.minutes));
  const trendPath = trendPoints
    .map((point, index) => {
      const x = (index / Math.max(1, trendPoints.length - 1)) * 100;
      const y = 100 - (point.minutes / maxTrendMinutes) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <main className={styles.pageShell}>
      <div className={styles.pageFrame}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>WHELM</p>
            <h1 className={styles.title}>
              {activeView === "focus" ? "Focus. No Distractions." : "Capture. Stay Sharp."}
            </h1>
            <p className={styles.subtitle}>
              {activeView === "focus"
                ? "One task. Full attention."
                : "Think clearly. Keep your notes ready."}
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.menuButton}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              ☰
            </button>
            <button onClick={() => signOut(auth)} className={styles.signOutButton}>
              Sign out
            </button>
          </div>
        </header>

        <nav className={`${styles.topNav} ${mobileMenuOpen ? styles.topNavOpen : ""}`}>
          <button
            type="button"
            className={`${styles.topNavButton} ${
              activeView === "focus" ? styles.topNavButtonActive : ""
            }`}
            onClick={() => {
              setActiveView("focus");
              setMobileMenuOpen(false);
            }}
          >
            Focus
          </button>
          <button
            type="button"
            className={`${styles.topNavButton} ${
              activeView === "notes" ? styles.topNavButtonActive : ""
            }`}
            onClick={() => {
              setActiveView("notes");
              setMobileMenuOpen(false);
            }}
          >
            Notes
          </button>
          <button type="button" className={styles.topNavAction} onClick={createWorkspaceNote}>
            + Add Note
          </button>
          {!isPro && (
            <button
              type="button"
              className={styles.topNavUpgrade}
              onClick={() => setPaywallOpen(true)}
            >
              Upgrade
            </button>
          )}
        </nav>

        {activeView === "focus" ? (
          <>
            <section className={styles.statsGrid}>
              <article className={styles.statCard}>
                <span className={styles.statLabel}>Daily Discipline Score</span>
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
                <span className={styles.statLabel}>Current streak</span>
                <strong className={styles.statValue}>
                  {streak} day{streak === 1 ? "" : "s"}
                </strong>
              </article>

              <article className={styles.statCard}>
                <span className={styles.statLabel}>Focus This Week</span>
                <strong className={styles.statValueSmall}>
                  {focusMetrics.weekMinutes} minutes across {focusMetrics.activeDaysInMonth}/30
                  active days
                </strong>
              </article>
            </section>
            {!isPro && (
              <section className={styles.adStrip}>
                <div className={styles.adBadge}>Free Tier Ad Slot</div>
                <p className={styles.adCopy}>
                  Upgrade to Whelm Pro to remove ads and unlock advanced productivity analytics.
                </p>
                <button
                  type="button"
                  className={styles.inlineUpgrade}
                  onClick={() => setPaywallOpen(true)}
                >
                  Go Pro
                </button>
              </section>
            )}

            <section className={styles.controlCenterGrid}>
              <article className={styles.controlCard}>
                <div className={styles.controlHeader}>
                  <div>
                    <p className={styles.sectionLabel}>Control Center</p>
                    <h2 className={styles.controlTitle}>Today at a glance</h2>
                  </div>
                  <button
                    type="button"
                    className={styles.reportButton}
                    onClick={() => void copyWeeklyReport()}
                  >
                    {reportCopyStatus || "Copy weekly report"}
                  </button>
                </div>

                <ul className={styles.commandList}>
                  <li>
                    <strong>{focusMetrics.todaySessions}</strong> sessions logged today
                  </li>
                  <li>
                    <strong>{focusMetrics.todayMinutes}m</strong> focused today
                  </li>
                  <li>
                    <strong>{orderedNotes.filter((note) => note.isPinned).length}</strong> pinned
                    notes ready
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
                </ul>
              </article>

              <article className={styles.controlCard}>
                <p className={styles.sectionLabel}>Streak Calendar</p>
                <h2 className={styles.controlTitle}>This month</h2>
                <div className={styles.calendarHeader}>
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>
                <div className={styles.monthGrid}>
                  {focusMetrics.monthCalendar.map((day) => (
                    <div
                      key={day.key}
                      className={`${styles.streakCell} ${styles[`streakLevel${day.level}`]}`}
                      title={
                        day.dayNumber
                          ? `${day.dayNumber}: ${day.minutes}m`
                          : "Outside current month"
                      }
                    >
                      {day.dayNumber && <span>{day.dayNumber}</span>}
                    </div>
                  ))}
                </div>
                <div className={styles.streakLegend}>
                  <span>No focus</span>
                  <span>Light</span>
                  <span>Strong</span>
                  <span>Deep</span>
                </div>
                {!isPro && (
                  <div className={styles.cardGateRow}>
                    <span>Detailed monthly trend insights are Pro.</span>
                    <button
                      type="button"
                      className={styles.inlineUpgrade}
                      onClick={() => setPaywallOpen(true)}
                    >
                      Unlock
                    </button>
                  </div>
                )}
              </article>
            </section>

            <section className={styles.insightsGrid}>
              <article className={styles.controlCard}>
                <p className={styles.sectionLabel}>Focus Trend</p>
                <div className={styles.controlHeader}>
                  <h2 className={styles.controlTitle}>Trend overview</h2>
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
                    <polyline
                      points={trendPath}
                      className={styles.trendLine}
                    />
                  </svg>
                  <div className={styles.chartAxis}>
                    {trendPoints.map((point, index) => (
                      <span key={`${point.label}-${index}`}>{point.label}</span>
                    )).filter((_, index) =>
                      trendRange === 7
                        ? true
                        : trendRange === 30
                          ? index % 5 === 0 || index === trendPoints.length - 1
                          : index % 15 === 0 || index === trendPoints.length - 1,
                    )}
                  </div>
                  {isPro ? null : (
                    <div className={styles.chartLock}>
                      <p>Pro unlocks full trend analytics and score breakdowns.</p>
                      <button
                        type="button"
                        className={styles.inlineUpgrade}
                        onClick={() => setPaywallOpen(true)}
                      >
                        Upgrade to Pro
                      </button>
                    </div>
                  )}
                </div>
              </article>

              <article className={styles.controlCard}>
                <p className={styles.sectionLabel}>Habit Engine</p>
                <h2 className={styles.controlTitle}>Keep your streak alive</h2>
                <ul className={styles.commandList}>
                  <li>Open Whelm daily and complete one focus block.</li>
                  <li>Protect your streak with at least 20 focused minutes.</li>
                  <li>Beat yesterday&apos;s discipline score.</li>
                  <li>Share your weekly report for accountability.</li>
                </ul>
              </article>
            </section>

            <section className={styles.mainGrid}>
              <div className={styles.timersGrid}>
                <Timer
                  minutes={25}
                  title={FOCUS_TIMER.title}
                  subtitle={FOCUS_TIMER.subtitle}
                  actionLabel={FOCUS_TIMER.actionLabel}
                  theme={FOCUS_TIMER.theme}
                  onComplete={(note, minutesSpent) => completeSession(note, minutesSpent)}
                />

                <article className={styles.proPreviewCard}>
                  <div className={styles.proPreviewTop}>
                    <p className={styles.proEyebrow}>WHELM PRO PREVIEW</p>
                    <span className={styles.proBadge}>$3.99/mo</span>
                  </div>
                  <h3 className={styles.proTitle}>Unlock the advanced discipline system</h3>
                  <ul className={styles.proList}>
                    <li>Weekly performance trends and progress breakdown</li>
                    <li>Custom score weights for deep work and routine habits</li>
                    <li>Clean focus mode with no ads</li>
                    <li>Motivation prompts and precision planning tools</li>
                  </ul>
                  <button
                    type="button"
                    className={styles.proCta}
                    onClick={() => setPaywallOpen(true)}
                  >
                    See Pro plan
                  </button>
                </article>
              </div>

              <aside className={styles.sessionsCard}>
                <div>
                  <p className={styles.sectionLabel}>Your account</p>
                  <p className={styles.email}>
                    {user.displayName || user.email?.split("@")[0] || "WHELM user"}
                  </p>
                  <p className={styles.accountMeta}>{user.email}</p>
                  <p className={styles.accountMeta}>
                    Plan: {isPro ? "Pro" : "Free"}{proSource === "preview" ? " (preview)" : ""}
                  </p>
                </div>

                <div className={styles.sessionsBlock}>
                  <div className={styles.sessionsHeadingRow}>
                    <h2 className={styles.sessionsHeading}>Recent sessions</h2>
                    <span className={styles.sessionsHint}>Latest 5</span>
                  </div>

                  <div className={styles.sessionList}>
                    {sessions.slice(0, 5).map((session, index) => (
                      <div
                        key={`${session.completedAtISO}-${index}`}
                        className={styles.sessionItem}
                      >
                        <div>
                          <div className={styles.sessionPrimary}>
                            {new Date(session.completedAtISO).toLocaleString()}
                          </div>
                          <div className={styles.sessionSecondary}>
                            <span
                              className={styles.categoryBadge}
                              style={{
                                backgroundColor: FOCUS_TIMER.theme.accentSoft,
                                color: FOCUS_TIMER.theme.accentStrong,
                              }}
                            >
                              {FOCUS_TIMER.badgeLabel}
                            </span>
                            {session.noteSavedAtISO && (
                              <span className={styles.noteTimestamp}>
                                {new Date(session.noteSavedAtISO).toLocaleString()}
                              </span>
                            )}
                          </div>
                          {session.note && <div className={styles.sessionNote}>{session.note}</div>}
                        </div>
                        <div className={styles.sessionMinutes}>{session.minutes}m</div>
                      </div>
                    ))}

                    {sessions.length === 0 && (
                      <div className={styles.emptyState}>
                        No sessions yet. Start your timer and save your first focus block.
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </section>
          </>
        ) : (
          <section className={styles.notesWorkspace}>
            <aside className={styles.notesSidebar}>
              <button
                type="button"
                className={styles.newNoteButton}
                onClick={createWorkspaceNote}
              >
                + Add Note
              </button>

              <div className={styles.noteList}>
                {orderedNotes.map((note) => (
                  <div key={note.id} className={styles.noteListRow}>
                    <button
                      type="button"
                      className={`${styles.noteListItem} ${
                        selectedNoteId === note.id ? styles.noteListItemActive : ""
                      }`}
                      style={{ backgroundColor: note.color || "#f8fafc" }}
                      onClick={() => setSelectedNoteId(note.id)}
                    >
                      <span className={styles.noteListTitle}>
                        {note.isPinned ? "★ " : ""}
                        {note.title || "Untitled note"}
                      </span>
                      <span className={styles.noteListMeta}>
                        {new Date(note.updatedAtISO).toLocaleString()}
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
              </div>
              {!isPro && (
                <div className={styles.notesAdCard}>
                  <p className={styles.adBadge}>Ad Slot</p>
                  <p className={styles.adCopy}>Free plan includes lightweight ads.</p>
                  <button
                    type="button"
                    className={styles.inlineUpgrade}
                    onClick={() => setPaywallOpen(true)}
                  >
                    Remove ads
                  </button>
                </div>
              )}
            </aside>

            <article className={styles.notesEditorCard}>
              {!selectedNote ? (
                <div className={styles.notesEmptyEditor}>
                  <p>Start by creating your first note.</p>
                </div>
              ) : (
                <>
                  <div className={styles.noteColorRow}>
                    <button
                      type="button"
                      className={styles.noteColorPickerTrigger}
                      onClick={() => setColorPickerOpen((open) => !open)}
                    >
                      <span
                        className={styles.noteColorPickerPreview}
                        style={{ backgroundColor: selectedNote.color || "#e7e5e4" }}
                      />
                      Note color
                    </button>

                    {colorPickerOpen && (
                      <div className={styles.noteColorPickerPopover}>
                        {NOTE_COLORS.map((color) => (
                          <button
                            type="button"
                            key={color.value}
                            className={`${styles.noteColorSwatch} ${
                              selectedNote.color === color.value
                                ? styles.noteColorSwatchActive
                                : ""
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

                  <div className={styles.noteEditorToolbar}>
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
                      List
                    </button>

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
                      <option value="Avenir Next">Avenir</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Trebuchet MS">Trebuchet</option>
                      <option value="Courier New">Courier</option>
                    </select>

                    <select
                      className={styles.noteToolSelect}
                      value={String(selectedNote.fontSizePx)}
                      onMouseDown={() => saveEditorSelection()}
                      onChange={(event) => {
                        const nextSize = Number(event.target.value);
                        const sizeMap: Record<number, string> = {
                          14: "3",
                          16: "4",
                          18: "5",
                          22: "6",
                        };
                        applyEditorCommand("fontSize", sizeMap[nextSize] ?? "4");
                        void updateSelectedNote({ fontSizePx: nextSize });
                      }}
                    >
                      <option value="14">Small</option>
                      <option value="16">Normal</option>
                      <option value="18">Large</option>
                      <option value="22">XL</option>
                    </select>

                    <label className={styles.noteToolColor}>
                      Text
                      <input
                        type="color"
                        defaultValue="#111827"
                        onMouseDown={() => saveEditorSelection()}
                        onChange={(event) =>
                          applyEditorCommand("foreColor", event.target.value)
                        }
                      />
                    </label>

                    <label className={styles.noteToolColor}>
                      Highlight
                      <input
                        type="color"
                        defaultValue="#fff59d"
                        onMouseDown={() => saveEditorSelection()}
                        onChange={(event) => {
                          applyEditorCommand("hiliteColor", event.target.value);
                          applyEditorCommand("backColor", event.target.value);
                        }}
                      />
                    </label>
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
                    {notesSyncStatus !== "synced" && (
                      <button
                        type="button"
                        className={styles.retrySyncButton}
                        onClick={() => void handleRetrySync()}
                      >
                        Retry sync
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.deleteNoteButton}
                      onClick={() => void deleteNote(selectedNote.id)}
                    >
                      Delete note
                    </button>
                  </div>
                </>
              )}
            </article>
          </section>
        )}
      </div>

      <button
        type="button"
        className={styles.feedbackButton}
        onClick={() => {
          setFeedbackOpen(true);
          setFeedbackStatus("");
        }}
      >
        Feedback
      </button>

      {paywallOpen && (
        <div className={styles.feedbackOverlay} onClick={() => setPaywallOpen(false)}>
          <div className={styles.paywallModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>Upgrade to Whelm Pro</h2>
              <button
                type="button"
                className={styles.feedbackClose}
                onClick={() => setPaywallOpen(false)}
              >
                Close
              </button>
            </div>
            <p className={styles.paywallCopy}>
              Remove ads and unlock full analytics, trend intelligence, and precision planning.
            </p>
            <div className={styles.planGrid}>
              <article className={styles.planCard}>
                <p className={styles.planName}>Monthly</p>
                <p className={styles.planPrice}>$3.99</p>
                <p className={styles.planMeta}>per month</p>
              </article>
              <article className={`${styles.planCard} ${styles.planCardFeatured}`}>
                <p className={styles.planName}>Yearly</p>
                <p className={styles.planPrice}>$29.99</p>
                <p className={styles.planMeta}>best value</p>
              </article>
            </div>
            <ul className={styles.proList}>
              <li>Advanced discipline insights and score history</li>
              <li>Monthly streak intelligence and weekly reports</li>
              <li>Premium focus workflows and no ads</li>
            </ul>
            <div className={styles.paywallActions}>
              <button
                type="button"
                className={styles.feedbackSubmit}
                onClick={() => void handlePreviewUpgrade()}
              >
                Unlock Pro Preview
              </button>
              <button
                type="button"
                className={styles.secondaryPlanButton}
                onClick={() => void handleRestoreFreeTier()}
              >
                Restore Free Tier
              </button>
            </div>
            <p className={styles.paywallHint}>
              {isStorePurchaseSupported()
                ? "Store billing supported on iOS build. Next step is wiring StoreKit/RevenueCat products."
                : "Preview unlock active for development. Native billing wiring comes in iOS integration step."}
            </p>
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
          <div
            className={styles.feedbackModal}
            onClick={(event) => event.stopPropagation()}
          >
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
              onChange={(event) =>
                setFeedbackCategory(event.target.value as FeedbackCategory)
              }
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
