"use client";

import styles from "@/app/page.module.css";

import CalendarTonePicker from "@/components/CalendarTonePicker";
import type { BlockDraft } from "@/hooks/useTodayTimeHub";

type BlockComposerScreenProps = {
  draft: BlockDraft;
  isPro: boolean;
  onUpgrade: () => void;
  onChange: (patch: Partial<BlockDraft>) => void;
  onClose: () => void;
  onSave: () => void;
};

export default function BlockComposerScreen({
  draft,
  isPro,
  onUpgrade,
  onChange,
  onClose,
  onSave,
}: BlockComposerScreenProps) {
  const formattedDate = new Date(`${draft.dateKey}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className={`${styles.timeToolFullscreen} ${styles.blockScreenShell}`}>
      <div className={styles.timeToolFullscreenHeader}>
        <p className={styles.sectionLabel}>Block · {formattedDate}</p>
        <button type="button" className={styles.feedbackClose} onClick={onClose}>
          Close
        </button>
      </div>

      <div className={styles.blockForm}>
        <input
          value={draft.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="Task title"
          className={styles.planInput}
        />
        <textarea
          value={draft.note}
          onChange={(event) => onChange({ note: event.target.value.slice(0, 280) })}
          placeholder="Optional note or intention"
          className={styles.planNoteInput}
        />
        <div className={styles.blockWhenRow}>
          <label className={styles.planLabel}>
            Day
            <input
              type="date"
              value={draft.dateKey}
              onChange={(event) => onChange({ dateKey: event.target.value })}
              className={styles.planControl}
            />
          </label>
          <label className={styles.planLabel}>
            Start
            <input
              type="time"
              value={draft.timeOfDay}
              onChange={(event) => onChange({ timeOfDay: event.target.value })}
              className={styles.planControl}
            />
          </label>
          <label className={styles.planLabel}>
            End
            <input
              type="time"
              value={draft.endTimeOfDay}
              onChange={(event) => onChange({ endTimeOfDay: event.target.value })}
              className={styles.planControl}
            />
          </label>
        </div>
        <CalendarTonePicker
          label="Block tone"
          selectedTone={draft.tone}
          onSelectTone={(tone) => onChange({ tone })}
          isPro={isPro}
          onUpgrade={onUpgrade}
        />
        <div className={styles.timeToolFooter}>
          <button type="button" className={styles.secondaryPlanButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`${styles.planAddButton} ${styles.blockActionButton}`} onClick={onSave}>
            Save block
          </button>
        </div>
      </div>
    </div>
  );
}
