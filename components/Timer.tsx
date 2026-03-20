"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
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
    accent: "#6c5ce7",
    accentSoft: "#e2dcff",
    accentStrong: "#342a7a",
    ring: "rgba(129, 140, 248, 0.18)",
    glow: "rgba(129, 140, 248, 0.32)",
    surfaceTop: "rgba(32, 31, 72, 0.96)",
    surfaceBottom: "rgba(17, 18, 44, 0.96)",
    pulse: "rgba(165, 180, 252, 0.95)",
  },
  language: {
    label: "Language",
    entryLabel: "LANGUAGE",
    accent: "#d8a125",
    accentSoft: "#f7ecd0",
    accentStrong: "#8f5b0d",
    ring: "rgba(244, 191, 78, 0.18)",
    glow: "rgba(245, 196, 93, 0.34)",
    surfaceTop: "rgba(46, 34, 16, 0.96)",
    surfaceBottom: "rgba(24, 18, 8, 0.96)",
    pulse: "rgba(252, 211, 77, 0.95)",
  },
  school: {
    label: "School",
    entryLabel: "SCHOOL",
    accent: "#4d8eff",
    accentSoft: "#dce9ff",
    accentStrong: "#1e4ea8",
    ring: "rgba(96, 165, 250, 0.18)",
    glow: "rgba(96, 165, 250, 0.3)",
    surfaceTop: "rgba(18, 34, 62, 0.96)",
    surfaceBottom: "rgba(11, 20, 40, 0.96)",
    pulse: "rgba(96, 165, 250, 0.95)",
  },
  work: {
    label: "Work",
    entryLabel: "WORK",
    accent: "#d35555",
    accentSoft: "#f9d7d7",
    accentStrong: "#8d2424",
    ring: "rgba(248, 113, 113, 0.18)",
    glow: "rgba(239, 68, 68, 0.28)",
    surfaceTop: "rgba(56, 19, 23, 0.97)",
    surfaceBottom: "rgba(28, 10, 14, 0.97)",
    pulse: "rgba(248, 113, 113, 0.95)",
  },
};

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
  streakMinimumMinutes = 30,
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
  streakMinimumMinutes?: number;
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
  const [focusIdentity, setFocusIdentity] = useState<FocusIdentity>("timer");
  const [entryModeLabel, setEntryModeLabel] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const entryTimeoutRef = useRef<number | null>(null);
  const sessionContextRef = useRef<TimerSessionContext | null>(null);

  const identityTheme = FOCUS_IDENTITIES[focusIdentity];

  useEffect(() => {
    if (mode === "countdown") {
      setSecondsLeft(configuredMinutes * 60);
    } else {
      setSecondsElapsed(0);
    }
    setRunning(false);
    setDone(false);
  }, [configuredMinutes, mode]);

  useEffect(() => {
    if (!running) {
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
    return () => {
      if (entryTimeoutRef.current) {
        window.clearTimeout(entryTimeoutRef.current);
      }
      const activeSession = sessionContextRef.current;
      if (activeSession) {
        void onSessionAbandon?.({
          ...activeSession,
          elapsedMinutes: calculateMinutesSpent(),
          abandonReason: "component_unmount",
        });
      }
    };
  }, [onSessionAbandon, secondsElapsed, secondsLeft]);

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
    sessionContextRef.current = null;
  }

  function calculateMinutesSpent() {
    const elapsedSeconds =
      mode === "countdown" ? configuredMinutes * 60 - secondsLeft : secondsElapsed;

    return Math.max(1, Math.ceil(elapsedSeconds / 60));
  }

  async function handleComplete() {
    setSubmitting(true);

    try {
      await onComplete(note.trim(), calculateMinutesSpent(), sessionContextRef.current ?? undefined);
      sessionContextRef.current = null;
      reset();
    } finally {
      setSubmitting(false);
    }
  }

  function openNotebook() {
    setRunning(false);
    setShowNotebookMenu(false);
    setShowNotebook(true);
  }

  function openNotebookMenu() {
    setRunning(false);
    setShowNotebookMenu((current) => !current);
  }

  function startSession() {
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
    setEntryModeLabel(identityTheme.entryLabel);
    setRunning(true);
    if (!existingSession || done) {
      void onSessionStart?.(sessionContext);
    }
    entryTimeoutRef.current = window.setTimeout(() => {
      setEntryModeLabel(null);
      entryTimeoutRef.current = null;
    }, 650);
  }

  const timerFaceLabel = mode === "countdown" ? "Countdown" : "Stopwatch";
  const statusLabel = done
    ? `Exit ${identityTheme.entryLabel} mode and lock it in.`
    : running
      ? mode === "countdown"
        ? `${identityTheme.label} mode is active. Stay with it.`
        : `${identityTheme.label} mode is tracking live focus.`
      : `Enter ${identityTheme.entryLabel} mode when ready.`;

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
      style={themeVars}
      data-appearance={appearance}
      data-focus-mode={focusIdentity}
    >
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Whelm Focus Modes</p>
          <h2 className={styles.title}>{title}</h2>
          {!running && !done && mode === "countdown" && (
            <p className={styles.streakHint}>{streakMinimumMinutes}m protects today&apos;s streak.</p>
          )}
        </div>
      </div>

      <div className={styles.modeRow}>
        <div className={styles.modeTabs}>
          <button
            type="button"
            onClick={() => setMode("countdown")}
            className={`${styles.modeTab} ${
              mode === "countdown" ? styles.modeTabActive : ""
            }`}
          >
            Countdown
          </button>
          <button
            type="button"
            onClick={() => setMode("stopwatch")}
            className={`${styles.modeTab} ${
              mode === "stopwatch" ? styles.modeTabActive : ""
            }`}
          >
            Stopwatch
          </button>
        </div>

        {mode === "countdown" && (
          <label className={styles.minutesPicker}>
            Min
            <input
              type="number"
              min={1}
              max={480}
              value={configuredMinutes}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) {
                  setConfiguredMinutes(Math.min(480, Math.max(1, next)));
                }
              }}
              disabled={running}
            />
          </label>
        )}

        <div className={styles.settingsWrap}>
          <button
            type="button"
            className={styles.settingsButton}
            onClick={() => setShowTimerSettings((current) => !current)}
            disabled={running || submitting}
          >
            <span className={styles.settingsButtonLabel}>Timer settings</span>
            <span className={styles.settingsButtonValue}>{identityTheme.label}</span>
          </button>

          {showTimerSettings && (
            <div className={styles.settingsMenu}>
              {(Object.entries(FOCUS_IDENTITIES) as Array<[FocusIdentity, (typeof FOCUS_IDENTITIES)[FocusIdentity]]>).map(
                ([identityKey, identity]) => (
                  <button
                    key={identityKey}
                    type="button"
                    className={`${styles.settingsMenuButton} ${
                      focusIdentity === identityKey ? styles.settingsMenuButtonActive : ""
                    }`}
                    onClick={() => {
                      setFocusIdentity(identityKey);
                      setShowTimerSettings(false);
                    }}
                  >
                    <span>{identity.label}</span>
                    {identity.descriptor ? <span>{identity.descriptor}</span> : null}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.timerFace} data-focus-mode={focusIdentity}>
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
          <div className={styles.status}>{statusLabel}</div>
        </div>
        <div className={styles.faceDock}>
          {!running && !done ? (
            <button onClick={startSession} className={styles.faceDockPrimaryButton}>
              {sessionContextRef.current ? "Resume" : "Start"}
            </button>
          ) : running ? (
            <button
              onClick={() => {
                setRunning(false);
                if (sessionContextRef.current) {
                  sessionContextRef.current = {
                    ...sessionContextRef.current,
                    interruptionCount: sessionContextRef.current.interruptionCount + 1,
                  };
                }
              }}
              className={styles.faceDockPrimaryButton}
            >
              Pause
            </button>
          ) : (
            <button onClick={handleComplete} className={styles.faceDockPrimaryButton} disabled={submitting}>
              {submitting ? "Saving..." : actionLabel}
            </button>
          )}

          <button onClick={reset} className={styles.faceDockButton}>
            Reset
          </button>

          <div className={styles.faceDockNoteWrap}>
            <button
              onClick={openNotebookMenu}
              className={styles.faceDockButton}
              disabled={submitting}
            >
              Session note
              {sessionNoteCount > 0 && <span className={styles.faceDockBadge}>{sessionNoteCount}</span>}
            </button>
            {showNotebookMenu && (
              <div className={styles.faceDockMenu}>
                <button type="button" className={styles.faceDockMenuButton} onClick={openNotebook}>
                  New note
                </button>
                <button
                  type="button"
                  className={styles.faceDockMenuButton}
                  onClick={() => {
                    setShowNotebookMenu(false);
                    onOpenSessionNotes?.();
                  }}
                >
                  See notes
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {(done || showNotebook) && (
        <div className={styles.notebook}>
          <div className={styles.notebookHeader}>
            <h3 className={styles.notebookTitle}>Session notebook</h3>
            <p className={styles.notebookCopy}>
              Write what this focus block was for. It will be saved with a timestamp.
            </p>
          </div>

          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What did you work on? What mattered in this session?"
            className={styles.notebookInput}
            rows={4}
          />

          <div className={styles.notebookActions}>
            <button
              onClick={handleComplete}
              className={styles.completeButton}
              disabled={submitting}
            >
              {submitting ? "Saving..." : actionLabel}
            </button>
            <button
              onClick={() => setShowNotebook(false)}
              className={styles.secondaryButton}
              disabled={submitting}
            >
              Keep editing later
            </button>
          </div>
        </div>
      )}

    </section>
  );
}
