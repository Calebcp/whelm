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
  minutes = 25,
  title,
  subtitle,
  actionLabel,
  theme,
  appearance = "dark",
  onComplete,
}: {
  minutes?: number;
  title: string;
  subtitle: string;
  actionLabel: string;
  theme: TimerTheme;
  appearance?: "dark" | "light";
  onComplete: (note: string, minutesSpent: number) => Promise<void> | void;
}) {
  const [mode, setMode] = useState<"countdown" | "stopwatch">("countdown");
  const [configuredMinutes, setConfiguredMinutes] = useState(minutes);
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showNotebook, setShowNotebook] = useState(false);
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
    setShowNotebook(true);
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
          <p className={styles.eyebrow}>{subtitle}</p>
          <h2 className={styles.title}>{title}</h2>
        </div>
        <div className={styles.headerBadge}>
          <span className={styles.headerBadgeLabel}>{mode === "countdown" ? "Ritual" : "Flow"}</span>
          <strong className={styles.headerBadgeValue}>
            {mode === "countdown" ? `${configuredMinutes}m` : "Open"}
          </strong>
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
      </div>

      <div className={styles.controls}>
        {!running && !done && (
          <button onClick={() => setRunning(true)} className={styles.primaryButton}>
            Start
          </button>
        )}

        {running && (
          <button onClick={() => setRunning(false)} className={styles.secondaryButton}>
            Pause
          </button>
        )}

        <button onClick={reset} className={styles.secondaryButton}>
          Reset
        </button>

        {!showNotebook && (
          <button
            onClick={openNotebook}
            className={styles.completeButton}
            disabled={submitting}
          >
            Add Session Note
          </button>
        )}
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

      <div className={styles.tip}>
        Tip: run a countdown or stopwatch, then save notes for that block.
      </div>
    </section>
  );
}
