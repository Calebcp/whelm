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
  onOpenSessionNotes: () => void;
  onSaveSessionNote: (
    note: string,
    minutesSpent: number,
    context?: TimerSessionContext,
  ) => Promise<void> | void;
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
  onOpenSessionNotes,
  onSaveSessionNote,
  onSessionStart,
  onSessionAbandon,
  onComplete,
}: TimerScreenProps) {
  return (
    <div className={`${styles.timeToolFullscreen} ${styles.timerScreenShell}`}>
      <div className={styles.timeToolFullscreenHeader}>
        <p className={styles.sectionLabel}>Timer</p>
        <button type="button" className={styles.feedbackClose} onClick={onClose}>
          Close
        </button>
      </div>

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
        onSaveSessionNote={onSaveSessionNote}
        streakMinimumMinutes={30}
        onSessionStart={onSessionStart}
        onSessionAbandon={onSessionAbandon}
        onComplete={onComplete}
      />
    </div>
  );
}
