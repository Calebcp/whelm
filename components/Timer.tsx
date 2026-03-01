"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Timer.module.css";

export default function Timer({
  minutes = 25,
  onComplete,
}: {
  minutes?: number;
  onComplete: () => Promise<void> | void;
}) {
  const totalSeconds = minutes * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
  }

  async function handleComplete() {
    setSubmitting(true);

    try {
      await onComplete();
      reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Current focus block</p>
        <h2 className={styles.title}>25-minute session</h2>
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

        <button
          onClick={handleComplete}
          className={styles.completeButton}
          disabled={submitting}
        >
          {submitting ? "Saving..." : "Complete Session"}
        </button>
      </div>

      <div className={styles.tip}>
        Tip: Only press &quot;Complete&quot; when you actually focused.
      </div>
    </section>
  );
}
