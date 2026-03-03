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
  onComplete,
}: {
  minutes?: number;
  title: string;
  subtitle: string;
  actionLabel: string;
  theme: TimerTheme;
  onComplete: (note: string) => Promise<void> | void;
}) {
  const totalSeconds = minutes * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showNotebook, setShowNotebook] = useState(false);
  const [note, setNote] = useState("");
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          setRunning(false);
          setDone(true);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;

  function reset() {
    setRunning(false);
    setDone(false);
    setSecondsLeft(totalSeconds);
    setShowNotebook(false);
    setNote("");
  }

  async function handleComplete() {
    setSubmitting(true);

    try {
      await onComplete(note.trim());
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
  } as CSSProperties;

  return (
    <section className={styles.card} style={themeVars}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>{subtitle}</p>
        <h2 className={styles.title}>{title}</h2>
      </div>

      <div className={styles.timerFace}>
        <div className={styles.ring} />
        <div className={styles.time}>
          {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
        </div>

        <div className={styles.status}>
          {done ? "Session ended. Lock it in." : running ? "In WHELM." : "Ready."}
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
        Tip: Finish the timer, write the note, then save the session.
      </div>
    </section>
  );
}
