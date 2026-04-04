"use client";

import styles from "@/app/page.module.css";

import Timer, { type TimerSessionContext } from "@/components/Timer";
import type { TimerDraft } from "@/hooks/useTodayTimeHub";

type TimerScreenProps = {
  draft: TimerDraft;
  autoStartToken?: string | null;
  appearance: "dark" | "light";
  isPro: boolean;
  sessionNoteCount: number;
  onClose: () => void;
  onChange: (patch: Partial<TimerDraft>) => void;
  onOpenSessionNotes: () => void;
  onSessionStart: (context: TimerSessionContext) => void;
  onSessionAbandon: (context: TimerSessionContext & { elapsedMinutes: number; abandonReason: "reset" | "route_change" | "component_unmount" | "unknown" }) => void;
  onComplete: (note: string, minutesSpent: number, context?: TimerSessionContext) => void;
};

const TIMER_THEME = {
  accent: "#145da0",
  accentSoft: "#e7f1fc",
  accentStrong: "#0d3b66",
  ring: "rgba(108, 92, 231, 0.16)",
};

export default function TimerScreen({
  draft,
  autoStartToken,
  appearance,
  isPro,
  sessionNoteCount,
  onClose,
  onChange,
  onOpenSessionNotes,
  onSessionStart,
  onSessionAbandon,
  onComplete,
}: TimerScreenProps) {
  return (
    <div className={`${styles.timeToolFullscreen} ${styles.timerScreenShell}`}>
      <div className={styles.timeToolFullscreenHeader}>
        <div>
          <p className={styles.sectionLabel}>Timer</p>
          <h2 className={styles.feedbackTitle}>Focus timer</h2>
          <p className={styles.accountMeta}>Choose a duration, then drop into the full timer surface.</p>
        </div>
        <button type="button" className={styles.feedbackClose} onClick={onClose}>
          Close
        </button>
      </div>

      <div className={styles.timerScreenGrid}>
        <section className={styles.timeToolPanel}>
          <div className={styles.timeToolPanelHeader}>
            <div>
              <p className={styles.sectionLabel}>Presets</p>
              <h3 className={styles.timeToolPanelTitle}>Quick durations</h3>
            </div>
          </div>
          <div className={styles.timeToolToolbar}>
            {[15, 25, 30, 45, 60].map((minutes) => (
              <button
                key={minutes}
                type="button"
                className={`${styles.timeToolChip} ${draft.minutes === minutes ? styles.timeToolChipActive : ""}`}
                onClick={() => onChange({ minutes })}
              >
                {minutes}m
              </button>
            ))}
          </div>
        </section>

        <section className={styles.timeToolPanel}>
          <Timer
            minutes={draft.minutes}
            title={draft.label}
            actionLabel="Save Session"
            theme={TIMER_THEME}
            appearance={appearance}
            autoStartToken={autoStartToken}
            isPro={isPro}
            sessionNoteCount={sessionNoteCount}
            onOpenSessionNotes={onOpenSessionNotes}
            streakMinimumMinutes={30}
            onSessionStart={onSessionStart}
            onSessionAbandon={onSessionAbandon}
            onComplete={onComplete}
          />
        </section>
      </div>
    </div>
  );
}
