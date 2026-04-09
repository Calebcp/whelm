"use client";

import * as Popover from "@radix-ui/react-popover";
import * as Tabs from "@radix-ui/react-tabs";
import type { CSSProperties } from "react";
import { memo, useEffect, useRef, useState } from "react";
import styles from "./Timer.module.css";

type TimerTheme = {
  accent: string;
  accentSoft: string;
  accentStrong: string;
  ring: string;
};

type FocusIdentity = "timer" | "language" | "school" | "work";

export type TimerSessionContext = {
  sessionId: string;
  sessionType: "focus" | "stopwatch";
  subjectMode: "language" | "school" | "work" | "general";
  targetMinutes: number | null;
  interruptionCount: number;
};

type PersistedTimerState = {
  mode: "countdown" | "stopwatch";
  configuredMinutes: number;
  secondsLeft: number;
  secondsElapsed: number;
  focusIdentity: FocusIdentity;
  note: string;
  sessionContext: TimerSessionContext | null;
  persistedAt: number;
};

const TIMER_PERSISTENCE_KEY = "whelm:active-timer";

const FOCUS_IDENTITIES: Record<
  FocusIdentity,
  {
    label: string;
    entryLabel: string;
    descriptor?: string;
    accent: string;
    accentSoft: string;
    accentStrong: string;
    ring: string;
    glow: string;
    surfaceTop: string;
    surfaceBottom: string;
    pulse: string;
  }
> = {
  timer: {
    label: "Timer",
    entryLabel: "TIMER",
    descriptor: "Default",
    accent: "#6f8dff",
    accentSoft: "#edf3ff",
    accentStrong: "#3153d8",
    ring: "rgba(111, 141, 255, 0.2)",
    glow: "rgba(111, 141, 255, 0.34)",
    surfaceTop: "rgba(61, 83, 186, 0.94)",
    surfaceBottom: "rgba(49, 40, 132, 0.94)",
    pulse: "rgba(196, 220, 255, 0.95)",
  },
  language: {
    label: "Language",
    entryLabel: "LANGUAGE",
    accent: "#62d5ff",
    accentSoft: "#e9fbff",
    accentStrong: "#1987d2",
    ring: "rgba(98, 213, 255, 0.2)",
    glow: "rgba(98, 213, 255, 0.34)",
    surfaceTop: "rgba(44, 113, 204, 0.94)",
    surfaceBottom: "rgba(39, 59, 156, 0.94)",
    pulse: "rgba(205, 248, 255, 0.95)",
  },
  school: {
    label: "School",
    entryLabel: "SCHOOL",
    accent: "#8a9cff",
    accentSoft: "#eef1ff",
    accentStrong: "#4e60df",
    ring: "rgba(138, 156, 255, 0.2)",
    glow: "rgba(138, 156, 255, 0.32)",
    surfaceTop: "rgba(70, 93, 210, 0.94)",
    surfaceBottom: "rgba(54, 55, 156, 0.94)",
    pulse: "rgba(223, 228, 255, 0.95)",
  },
  work: {
    label: "Work",
    entryLabel: "WORK",
    accent: "#b56eff",
    accentSoft: "#f4e8ff",
    accentStrong: "#7f39dc",
    ring: "rgba(181, 110, 255, 0.2)",
    glow: "rgba(181, 110, 255, 0.3)",
    surfaceTop: "rgba(88, 63, 188, 0.94)",
    surfaceBottom: "rgba(63, 36, 142, 0.94)",
    pulse: "rgba(236, 212, 255, 0.95)",
  },
};

const TIMER_WHELM_ROTATION = [
  {
    src: "/timer-whelms/yellow_whelm_leaning_watch-removebg-preview.png",
    alt: "Whelm leaning with a stopwatch",
  },
  {
    src: "/timer-whelms/yellow_whelm_looking_at_watch-removebg-preview.png",
    alt: "Whelm looking at a stopwatch",
  },
  {
    src: "/timer-whelms/yellow_whelm_lifting_watch-removebg-preview.png",
    alt: "Whelm lifting a stopwatch",
  },
  {
    src: "/timer-whelms/yellow_whelm_running_watch-removebg-preview.png",
    alt: "Whelm running with a stopwatch",
  },
  {
    src: "/timer-whelms/yellow_whelm_flying_watch-removebg-preview.png",
    alt: "Whelm flying with a stopwatch",
  },
] as const;

const TimerFacePanel = memo(function TimerFacePanel({
  mode,
  configuredMinutes,
  running,
  done,
  submitting,
  focusIdentity,
  showTimerSettings,
  entryModeLabel,
  isPro,
  timerFigure,
  timerFaceLabel,
  mm,
  ss,
  actionLabel,
  sessionNoteCount,
  showNotebookMenu,
  canResume,
  onSetMode,
  onSetTimerSettingsOpen,
  onSetConfiguredMinutes,
  onSetFocusIdentity,
  onStartSession,
  onPauseSession,
  onHandleComplete,
  onReset,
  onSetNotebookMenuOpen,
  onOpenNotebook,
  onOpenSessionNotes,
}: {
  mode: "countdown" | "stopwatch";
  configuredMinutes: number;
  running: boolean;
  done: boolean;
  submitting: boolean;
  focusIdentity: FocusIdentity;
  showTimerSettings: boolean;
  entryModeLabel: string | null;
  isPro: boolean;
  timerFigure: (typeof TIMER_WHELM_ROTATION)[number];
  timerFaceLabel: string;
  mm: number;
  ss: number;
  actionLabel: string;
  sessionNoteCount: number;
  showNotebookMenu: boolean;
  canResume: boolean;
  onSetMode: (mode: "countdown" | "stopwatch") => void;
  onSetTimerSettingsOpen: (open: boolean) => void;
  onSetConfiguredMinutes: (minutes: number) => void;
  onSetFocusIdentity: (identity: FocusIdentity) => void;
  onStartSession: () => void;
  onPauseSession: () => void;
  onHandleComplete: () => void;
  onReset: () => void;
  onSetNotebookMenuOpen: (open: boolean) => void;
  onOpenNotebook: () => void;
  onOpenSessionNotes?: () => void;
}) {
  const identityTheme = FOCUS_IDENTITIES[focusIdentity];
  const [showTimeEdit, setShowTimeEdit] = useState(false);
  const [timeEditValue, setTimeEditValue] = useState(() => String(configuredMinutes));

  // Lock time editing once the timer starts
  useEffect(() => {
    if (running) setShowTimeEdit(false);
  }, [running]);

  useEffect(() => {
    if (!showTimeEdit) {
      setTimeEditValue(String(configuredMinutes));
    }
  }, [configuredMinutes, showTimeEdit]);

  function closeTimeEdit() {
    setTimeEditValue(String(configuredMinutes));
    setShowTimeEdit(false);
  }

  function applyTimeEdit() {
    const next = Number.parseInt(timeEditValue.trim(), 10);
    if (!Number.isFinite(next)) {
      closeTimeEdit();
      return;
    }
    const clamped = Math.min(480, Math.max(1, next));
    onSetConfiguredMinutes(clamped);
    setTimeEditValue(String(clamped));
    setShowTimeEdit(false);
  }

  return (
    <>
      <div className={styles.modeRow}>
        <Tabs.Root value={mode} onValueChange={(value) => onSetMode(value as "countdown" | "stopwatch")}>
          <Tabs.List className={styles.modeTabs} aria-label="Timer mode">
            <Tabs.Trigger value="countdown" className={styles.modeTab}>
              Countdown
            </Tabs.Trigger>
            <Tabs.Trigger value="stopwatch" className={styles.modeTab}>
              Stopwatch
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </div>

      <div className={styles.timerFace} data-focus-mode={focusIdentity}>
        <div className={styles.faceSettingsWrap}>
          <Popover.Root open={showTimerSettings} onOpenChange={onSetTimerSettingsOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                className={styles.faceSettingsButton}
                disabled={running || submitting}
                aria-label="Open timer settings"
                aria-expanded={showTimerSettings}
              >
                <span />
                <span />
                <span />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content className={styles.faceSettingsMenu} sideOffset={8} align="end">
                <div className={styles.faceIdentityGroup}>
                  <p className={styles.faceSettingsLabel}>Focus Mode</p>
                  <div className={styles.faceIdentityOptions}>
                    {(
                      Object.entries(FOCUS_IDENTITIES) as Array<
                        [FocusIdentity, (typeof FOCUS_IDENTITIES)[FocusIdentity]]
                      >
                    ).map(([identityKey, identity]) => (
                      <button
                        key={identityKey}
                        type="button"
                        className={`${styles.settingsMenuButton} ${
                          focusIdentity === identityKey ? styles.settingsMenuButtonActive : ""
                        }`}
                        onClick={() => {
                          onSetFocusIdentity(identityKey);
                          onSetTimerSettingsOpen(false);
                        }}
                      >
                        <span>{identity.label}</span>
                        {identity.descriptor ? <span>{identity.descriptor}</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
        <div className={styles.faceAura} aria-hidden="true" />
        <div className={styles.faceGrid} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className={styles.faceHalo} aria-hidden="true" />
        <div className={styles.ringTrack} aria-hidden="true" />
        <div className={styles.ringProgress} aria-hidden="true" />
        <div className={styles.ringPulse} aria-hidden="true" />
        {entryModeLabel && (
          <div className={styles.entryOverlay}>
            <span className={styles.entryEyebrow}>Entering</span>
            <strong className={styles.entryMode}>{entryModeLabel} mode</strong>
          </div>
        )}
        <div className={styles.faceInner}>
          <p className={styles.faceLabel}>{timerFaceLabel}</p>
          <p className={styles.identityAnchor}>{identityTheme.entryLabel}</p>
          <div className={styles.time}>
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </div>

          {mode === "countdown" && !running && !done && (
            <div className={styles.timeEditRow}>
              {showTimeEdit ? (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={timeEditValue}
                    className={styles.timeEditInput}
                    autoFocus
                    placeholder="30"
                    onChange={(event) => {
                      const digitsOnly = event.target.value.replace(/[^\d]/g, "");
                      setTimeEditValue(digitsOnly.slice(0, 3));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        applyTimeEdit();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        closeTimeEdit();
                      }
                    }}
                  />
                  <button type="button" className={styles.timeEditAction} onClick={() => setTimeEditValue("")}>
                    Clear
                  </button>
                  <button type="button" className={styles.timeEditAction} onClick={applyTimeEdit}>
                    Apply
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.timeEditToggle}
                  onClick={() => setShowTimeEdit(true)}
                >
                  Edit time
                </button>
              )}
            </div>
          )}

          <div className={styles.faceWhelm}>
            {isPro ? (
              <div className={`${styles.faceWhelmFigure} ${running ? styles.faceWhelmFigurePulse : ""}`}>
                <img src={timerFigure.src} alt={timerFigure.alt} className={styles.faceWhelmImage} />
              </div>
            ) : (
              <div className={styles.faceWhelmFigure}>
                <img src={timerFigure.src} alt={timerFigure.alt} className={styles.faceWhelmImage} />
              </div>
            )}
          </div>
          {!running && isPro ? (
            <p className={styles.whelmRotationHint}>Every five minutes: a new Whelm stays with you.</p>
          ) : null}
        </div>
        <div className={styles.faceDock}>
          {!running && !done ? (
            <button onClick={onStartSession} className={styles.faceDockPrimaryButton}>
              {canResume ? "Resume" : "Start"}
            </button>
          ) : running ? (
            <button onClick={onPauseSession} className={styles.faceDockPrimaryButton}>
              Pause
            </button>
          ) : (
            <button onClick={onHandleComplete} className={styles.faceDockPrimaryButton} disabled={submitting}>
              {submitting ? "Saving..." : actionLabel}
            </button>
          )}

          <button onClick={onReset} className={styles.faceDockButton}>
            Reset
          </button>

          <Popover.Root open={showNotebookMenu} onOpenChange={onSetNotebookMenuOpen}>
            <div className={styles.faceDockNoteWrap}>
              <Popover.Trigger asChild>
                <button type="button" className={styles.faceDockButton} disabled={submitting}>
                  Session note
                  {sessionNoteCount > 0 && <span className={styles.faceDockBadge}>{sessionNoteCount}</span>}
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className={styles.faceDockMenu} sideOffset={8} align="end">
                  <button
                    type="button"
                    className={styles.faceDockMenuButton}
                    onClick={() => {
                      onOpenNotebook();
                      onSetNotebookMenuOpen(false);
                    }}
                  >
                    New note
                  </button>
                  <button
                    type="button"
                    className={styles.faceDockMenuButton}
                    onClick={() => {
                      onOpenSessionNotes?.();
                      onSetNotebookMenuOpen(false);
                    }}
                  >
                    See notes
                  </button>
                </Popover.Content>
              </Popover.Portal>
            </div>
          </Popover.Root>
        </div>
      </div>
    </>
  );
});

const SessionNotebook = memo(function SessionNotebook({
  done,
  showNotebook,
  note,
  actionLabel,
  submitting,
  onSetNote,
  onComplete,
  onSaveNote,
  onClose,
}: {
  done: boolean;
  showNotebook: boolean;
  note: string;
  actionLabel: string;
  submitting: boolean;
  onSetNote: (value: string) => void;
  onComplete: () => void;
  onSaveNote?: () => Promise<void> | void;
  onClose: () => void;
}) {
  if (!done && !showNotebook) {
    return null;
  }

  return (
    <div className={styles.notebook}>
      <div className={styles.notebookHeader}>
        <h3 className={styles.notebookTitle}>Session notebook</h3>
        <p className={styles.notebookCopy}>
          Write what this focus block was for. It will be saved with a timestamp.
        </p>
      </div>

      <textarea
        value={note}
        onChange={(event) => onSetNote(event.target.value)}
        placeholder="What did you work on? What mattered in this session?"
        className={styles.notebookInput}
        rows={4}
      />

      <div className={styles.notebookActions}>
        {onSaveNote ? (
          <button onClick={() => void onSaveNote()} className={styles.secondaryButton} disabled={submitting}>
            Save note now
          </button>
        ) : null}
        <button onClick={onComplete} className={styles.completeButton} disabled={submitting}>
          {submitting ? "Saving..." : actionLabel}
        </button>
        <button onClick={onClose} className={styles.secondaryButton} disabled={submitting}>
          Keep editing later
        </button>
      </div>
    </div>
  );
});

export default function Timer({
  minutes = 30,
  title,
  subtitle,
  actionLabel,
  theme,
  appearance = "dark",
  onComplete,
  onSessionStart,
  onSessionAbandon,
  sessionNoteCount = 0,
  onOpenSessionNotes,
  onSaveSessionNote,
  streakMinimumMinutes = 30,
  isPro = false,
  showHeaderCopy = true,
  showStreakHint = true,
  autoStartToken,
}: {
  minutes?: number;
  title: string;
  subtitle?: string;
  actionLabel: string;
  theme: TimerTheme;
  appearance?: "dark" | "light";
  onComplete: (
    note: string,
    minutesSpent: number,
    sessionContext?: TimerSessionContext,
  ) => Promise<void> | void;
  onSessionStart?: (context: TimerSessionContext) => Promise<void> | void;
  onSessionAbandon?: (
    context: TimerSessionContext & {
      elapsedMinutes: number;
      abandonReason: "reset" | "route_change" | "component_unmount" | "unknown";
    },
  ) => Promise<void> | void;
  sessionNoteCount?: number;
  onOpenSessionNotes?: () => void;
  onSaveSessionNote?: (
    note: string,
    minutesSpent: number,
    sessionContext?: TimerSessionContext,
  ) => Promise<void> | void;
  streakMinimumMinutes?: number;
  isPro?: boolean;
  showHeaderCopy?: boolean;
  showStreakHint?: boolean;
  autoStartToken?: string | null;
}) {
  const [mode, setMode] = useState<"countdown" | "stopwatch">("countdown");
  const [configuredMinutes, setConfiguredMinutes] = useState(minutes);
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showNotebook, setShowNotebook] = useState(false);
  const [showNotebookMenu, setShowNotebookMenu] = useState(false);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const [note, setNote] = useState("");
  const [savingNotebook, setSavingNotebook] = useState(false);
  const [focusIdentity, setFocusIdentity] = useState<FocusIdentity>("timer");
  const [entryModeLabel, setEntryModeLabel] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const [pauseNotice, setPauseNotice] = useState<string | null>(null);
  const [activeWhelmIndex, setActiveWhelmIndex] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const entryTimeoutRef = useRef<number | null>(null);
  const sessionContextRef = useRef<TimerSessionContext | null>(null);
  const runningRef = useRef(running);
  const modeRef = useRef(mode);
  const configuredMinutesRef = useRef(configuredMinutes);
  const secondsLeftRef = useRef(secondsLeft);
  const secondsElapsedRef = useRef(secondsElapsed);
  const focusIdentityRef = useRef(focusIdentity);
  const noteRef = useRef(note);
  const shouldPersistOnUnmountRef = useRef(true);
  const isRestoringPersistedTimerRef = useRef(false);
  const lastAutoStartTokenRef = useRef<string | null>(null);

  runningRef.current = running;
  modeRef.current = mode;
  configuredMinutesRef.current = configuredMinutes;
  secondsLeftRef.current = secondsLeft;
  secondsElapsedRef.current = secondsElapsed;
  focusIdentityRef.current = focusIdentity;
  noteRef.current = note;

  const identityTheme = FOCUS_IDENTITIES[focusIdentity];

  function clearPersistedTimer() {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(TIMER_PERSISTENCE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }

  function persistActiveTimer() {
    if (typeof window === "undefined" || !runningRef.current) return;
    try {
      const snapshot: PersistedTimerState = {
        mode: modeRef.current,
        configuredMinutes: configuredMinutesRef.current,
        secondsLeft: secondsLeftRef.current,
        secondsElapsed: secondsElapsedRef.current,
        focusIdentity: focusIdentityRef.current,
        note: noteRef.current,
        sessionContext: sessionContextRef.current,
        persistedAt: Date.now(),
      };
      window.sessionStorage.setItem(TIMER_PERSISTENCE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore storage failures.
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.sessionStorage.getItem(TIMER_PERSISTENCE_KEY);
      if (!raw) return;
      const snapshot = JSON.parse(raw) as PersistedTimerState;
      if (!snapshot || typeof snapshot.persistedAt !== "number") return;

      const elapsedSincePersistSeconds = Math.max(0, Math.floor((Date.now() - snapshot.persistedAt) / 1000));
      const restoredSecondsLeft =
        snapshot.mode === "countdown"
          ? Math.max(0, snapshot.secondsLeft - elapsedSincePersistSeconds)
          : snapshot.secondsLeft;
      const restoredSecondsElapsed =
        snapshot.mode === "stopwatch"
          ? snapshot.secondsElapsed + elapsedSincePersistSeconds
          : snapshot.secondsElapsed;

      setMode(snapshot.mode);
      setConfiguredMinutes(snapshot.configuredMinutes);
      setSecondsLeft(restoredSecondsLeft);
      setSecondsElapsed(restoredSecondsElapsed);
      setFocusIdentity(snapshot.focusIdentity);
      setNote(snapshot.note);
      sessionContextRef.current = snapshot.sessionContext;
      setDone(snapshot.mode === "countdown" && restoredSecondsLeft === 0);
      isRestoringPersistedTimerRef.current = true;
      setRunning(snapshot.mode === "countdown" ? restoredSecondsLeft > 0 : true);
      setPauseNotice(null);
    } catch {
      // Ignore malformed snapshots and start clean.
    } finally {
      clearPersistedTimer();
    }
  }, []);

  useEffect(() => {
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    setIsVisible(typeof document === "undefined" ? true : document.visibilityState === "visible");

    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    function handleVisibilityChange() {
      const nextVisible = document.visibilityState === "visible";
      shouldPersistOnUnmountRef.current = nextVisible;
      setIsVisible(nextVisible);
    }

    function handlePageHide() {
      shouldPersistOnUnmountRef.current = false;
      clearPersistedTimer();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  useEffect(() => {
    setConfiguredMinutes(minutes);
  }, [minutes]);

  useEffect(() => {
    if (isRestoringPersistedTimerRef.current) {
      isRestoringPersistedTimerRef.current = false;
      return;
    }
    if (mode === "countdown") {
      setSecondsLeft(configuredMinutes * 60);
    } else {
      setSecondsElapsed(0);
    }
    setRunning(false);
    setDone(false);
  }, [configuredMinutes, mode]);

  useEffect(() => {
    if (!autoStartToken || autoStartToken === lastAutoStartTokenRef.current) return;
    lastAutoStartTokenRef.current = autoStartToken;
    if (runningRef.current) return;
    startSession();
  }, [autoStartToken]);

  useEffect(() => {
    if (!running) {
      clearPersistedTimer();
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      if (mode === "countdown") {
        setSecondsLeft((previous) => {
          if (previous <= 1) {
            setRunning(false);
            setDone(true);
            return 0;
          }

          return previous - 1;
        });
      } else {
        setSecondsElapsed((previous) => previous + 1);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [mode, running]);

  useEffect(() => {
    if (!running) return;
    if (isOnline && isVisible) return;

    clearPersistedTimer();
    setRunning(false);
    setPauseNotice(
      !isOnline
        ? "Timer paused because the app went offline."
        : "Timer paused because the app left the foreground.",
    );
    if (sessionContextRef.current) {
      sessionContextRef.current = {
        ...sessionContextRef.current,
        interruptionCount: sessionContextRef.current.interruptionCount + 1,
      };
    }
  }, [isOnline, isVisible, running]);

  useEffect(() => {
    return () => {
      if (entryTimeoutRef.current) {
        window.clearTimeout(entryTimeoutRef.current);
      }
      const activeSession = sessionContextRef.current;
      const canPersistAcrossUnmount =
        runningRef.current &&
        shouldPersistOnUnmountRef.current &&
        typeof document !== "undefined" &&
        document.visibilityState === "visible";
      if (canPersistAcrossUnmount) {
        persistActiveTimer();
        return;
      }
      clearPersistedTimer();
      if (activeSession) {
        void onSessionAbandon?.({
          ...activeSession,
          elapsedMinutes: calculateMinutesSpent(),
          abandonReason: "component_unmount",
        });
      }
    };
  }, [onSessionAbandon]);

  useEffect(() => {
    if (!running || !isPro) {
      setActiveWhelmIndex(0);
      return;
    }

    const syncRotation = () => {
      const bucket = Math.floor(Date.now() / 300000);
      setActiveWhelmIndex(bucket % TIMER_WHELM_ROTATION.length);
    };

    syncRotation();
    const delayToBoundary = 300000 - (Date.now() % 300000);
    let rotationId: number | null = null;
    const timeoutId = window.setTimeout(() => {
      syncRotation();
      rotationId = window.setInterval(syncRotation, 300000);
    }, delayToBoundary);

    return () => {
      window.clearTimeout(timeoutId);
      if (rotationId) window.clearInterval(rotationId);
    };
  }, [isPro, running]);

  const displaySeconds = mode === "countdown" ? secondsLeft : secondsElapsed;
  const mm = Math.floor(displaySeconds / 60);
  const ss = displaySeconds % 60;
  const totalCountdownSeconds = configuredMinutes * 60;
  const progress =
    mode === "countdown"
      ? totalCountdownSeconds === 0
        ? 0
        : (totalCountdownSeconds - secondsLeft) / totalCountdownSeconds
      : (secondsElapsed % 60) / 60;

  function reset() {
    clearPersistedTimer();
    const activeSession = sessionContextRef.current;
    if (activeSession && (running || done)) {
      void onSessionAbandon?.({
        ...activeSession,
        elapsedMinutes: calculateMinutesSpent(),
        abandonReason: "reset",
      });
    }

    setRunning(false);
    setDone(false);
    if (mode === "countdown") {
      setSecondsLeft(configuredMinutes * 60);
    } else {
      setSecondsElapsed(0);
    }
    setShowNotebook(false);
    setShowNotebookMenu(false);
    setShowTimerSettings(false);
    setNote("");
    setPauseNotice(null);
    sessionContextRef.current = null;
  }

  function calculateMinutesSpent() {
    const elapsedSeconds =
      modeRef.current === "countdown"
        ? configuredMinutesRef.current * 60 - secondsLeftRef.current
        : secondsElapsedRef.current;

    return Math.max(1, Math.ceil(elapsedSeconds / 60));
  }

  async function handleComplete() {
    clearPersistedTimer();
    setSubmitting(true);

    try {
      await onComplete(note.trim(), calculateMinutesSpent(), sessionContextRef.current ?? undefined);
      sessionContextRef.current = null;
      reset();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveSessionNote() {
    const trimmed = note.trim();
    if (!trimmed || !onSaveSessionNote) return;
    setSavingNotebook(true);
    try {
      await onSaveSessionNote(
        trimmed,
        calculateMinutesSpent(),
        sessionContextRef.current ?? undefined,
      );
      sessionContextRef.current = null;
      reset();
      return;
    } finally {
      setSavingNotebook(false);
    }
  }

  function openNotebook() {
    setRunning(false);
    setShowNotebookMenu(false);
    setShowNotebook(true);
  }

  function pauseSession() {
    clearPersistedTimer();
    setRunning(false);
    if (sessionContextRef.current) {
      sessionContextRef.current = {
        ...sessionContextRef.current,
        interruptionCount: sessionContextRef.current.interruptionCount + 1,
      };
    }
  }

  function startSession() {
    if (!isOnline) {
      setPauseNotice("Timer works only while you are online.");
      return;
    }
    if (!isVisible) {
      setPauseNotice("Bring the app back into view to run the timer.");
      return;
    }
    if (entryTimeoutRef.current) {
      window.clearTimeout(entryTimeoutRef.current);
    }

    const existingSession = sessionContextRef.current;
    const sessionContext =
      existingSession && !done
        ? existingSession
        : ({
            sessionId:
              typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `${Date.now()}`,
            sessionType: mode === "countdown" ? "focus" : "stopwatch",
            subjectMode: focusIdentity === "timer" ? "general" : focusIdentity,
            targetMinutes: mode === "countdown" ? configuredMinutes : null,
            interruptionCount: 0,
          } satisfies TimerSessionContext);

    sessionContextRef.current = sessionContext;
    shouldPersistOnUnmountRef.current = true;
    setEntryModeLabel(identityTheme.entryLabel);
    setPauseNotice(null);
    setRunning(true);
    clearPersistedTimer();
    if (!existingSession || done) {
      void onSessionStart?.(sessionContext);
    }
    entryTimeoutRef.current = window.setTimeout(() => {
      setEntryModeLabel(null);
      entryTimeoutRef.current = null;
    }, 650);
  }

  const timerFaceLabel = mode === "countdown" ? "Countdown" : "Stopwatch";
  const timerFigure = isPro ? TIMER_WHELM_ROTATION[activeWhelmIndex] : TIMER_WHELM_ROTATION[0];

  const themeVars = {
    "--timer-accent": identityTheme.accent ?? theme.accent,
    "--timer-accent-soft": identityTheme.accentSoft ?? theme.accentSoft,
    "--timer-accent-strong": identityTheme.accentStrong ?? theme.accentStrong,
    "--timer-ring": identityTheme.ring ?? theme.ring,
    "--timer-glow": identityTheme.glow,
    "--timer-surface-top": identityTheme.surfaceTop,
    "--timer-surface-bottom": identityTheme.surfaceBottom,
    "--timer-pulse": identityTheme.pulse,
    "--timer-progress": `${Math.max(0, Math.min(1, progress))}`,
    "--timer-progress-turn": `${Math.max(0, Math.min(1, progress))}turn`,
  } as CSSProperties;

  return (
    <section
      className={styles.card}
      data-tour="today-timer"
      style={themeVars}
      data-appearance={appearance}
      data-focus-mode={focusIdentity}
    >
      <div className={styles.header}>
        <div>
          {showHeaderCopy ? <p className={styles.kicker}>Whelm Focus Modes</p> : null}
          <h2 className={styles.title}>{title}</h2>
          {showStreakHint && !running && !done && mode === "countdown" && (
            <p className={styles.streakHint}>{streakMinimumMinutes}m protects today&apos;s streak.</p>
          )}
        </div>
      </div>
      <TimerFacePanel
        mode={mode}
        configuredMinutes={configuredMinutes}
        running={running}
        done={done}
        submitting={submitting}
        focusIdentity={focusIdentity}
        showTimerSettings={showTimerSettings}
        entryModeLabel={entryModeLabel}
        isPro={isPro}
        timerFigure={timerFigure}
        timerFaceLabel={timerFaceLabel}
        mm={mm}
        ss={ss}
        actionLabel={actionLabel}
        sessionNoteCount={sessionNoteCount}
        showNotebookMenu={showNotebookMenu}
        canResume={Boolean(sessionContextRef.current)}
        onSetMode={setMode}
        onSetTimerSettingsOpen={setShowTimerSettings}
        onSetConfiguredMinutes={setConfiguredMinutes}
        onSetFocusIdentity={(identity) => {
          setFocusIdentity(identity);
          setShowTimerSettings(false);
        }}
        onStartSession={startSession}
        onPauseSession={pauseSession}
        onHandleComplete={() => {
          void handleComplete();
        }}
        onReset={reset}
        onSetNotebookMenuOpen={(open) => {
          setRunning(false);
          setShowNotebookMenu(open);
        }}
        onOpenNotebook={openNotebook}
        onOpenSessionNotes={() => {
          setShowNotebookMenu(false);
          onOpenSessionNotes?.();
        }}
      />

      <SessionNotebook
        done={done}
        showNotebook={showNotebook}
        note={note}
        actionLabel={actionLabel}
        submitting={submitting || savingNotebook}
        onSetNote={setNote}
        onComplete={() => {
          void handleComplete();
        }}
        onSaveNote={onSaveSessionNote ? handleSaveSessionNote : undefined}
        onClose={() => setShowNotebook(false)}
      />

    </section>
  );
}
