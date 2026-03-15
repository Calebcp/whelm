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

export default function Timer({
  minutes = 30,
  title,
  subtitle,
  actionLabel,
  theme,
  appearance = "dark",
  onComplete,
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
  onComplete: (note: string, minutesSpent: number) => Promise<void> | void;
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
  const [note, setNote] = useState("");
  const intervalRef = useRef<number | null>(null);

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
    setRunning(false);
    setDone(false);
    if (mode === "countdown") {
      setSecondsLeft(configuredMinutes * 60);
    } else {
      setSecondsElapsed(0);
    }
    setShowNotebook(false);
    setShowNotebookMenu(false);
    setNote("");
  }

  function calculateMinutesSpent() {
    const elapsedSeconds =
      mode === "countdown" ? configuredMinutes * 60 - secondsLeft : secondsElapsed;

    return Math.max(1, Math.ceil(elapsedSeconds / 60));
  }

  async function handleComplete() {
    setSubmitting(true);

    try {
      await onComplete(note.trim(), calculateMinutesSpent());
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

  const themeVars = {
    "--timer-accent": theme.accent,
    "--timer-accent-soft": theme.accentSoft,
    "--timer-accent-strong": theme.accentStrong,
    "--timer-ring": theme.ring,
    "--timer-progress": `${Math.max(0, Math.min(1, progress))}`,
    "--timer-progress-turn": `${Math.max(0, Math.min(1, progress))}turn`,
  } as CSSProperties;

  return (
    <section className={styles.card} style={themeVars} data-appearance={appearance}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Focus Chamber</p>
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
      </div>

      <div className={styles.timerFace}>
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
        <div className={styles.faceInner}>
          <p className={styles.faceLabel}>{mode === "countdown" ? "Countdown" : "Stopwatch"}</p>
          <div className={styles.time}>
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </div>
          <div className={styles.status}>
            {done
              ? "Session ended. Lock it in."
              : running
                ? mode === "countdown"
                  ? "In WHELM."
                  : "Stopwatch running."
                : "Ready."}
          </div>
        </div>
        <div className={styles.faceDock}>
          {!running && !done ? (
            <button onClick={() => setRunning(true)} className={styles.faceDockPrimaryButton}>
              Start
            </button>
          ) : running ? (
            <button onClick={() => setRunning(false)} className={styles.faceDockPrimaryButton}>
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
