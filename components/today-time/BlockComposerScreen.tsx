"use client";

import styles from "@/app/page.module.css";

import type { BlockDraft } from "@/hooks/useTodayTimeHub";

type BlockComposerScreenProps = {
  draft: BlockDraft;
  onChange: (patch: Partial<BlockDraft>) => void;
  onClose: () => void;
  onSave: () => void;
};

export default function BlockComposerScreen({
  draft,
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
        <div>
          <p className={styles.sectionLabel}>Block</p>
          <h2 className={styles.feedbackTitle}>Create a time commitment</h2>
          <p className={styles.accountMeta}>This saves directly into Schedule for {formattedDate}.</p>
        </div>
        <button type="button" className={styles.feedbackClose} onClick={onClose}>
          Close
        </button>
      </div>

      <div className={styles.blockScreenGrid}>
        <section className={styles.timeToolPanel}>
          <div className={styles.timeToolPanelHeader}>
            <div>
              <p className={styles.sectionLabel}>When</p>
              <h3 className={styles.timeToolPanelTitle}>Time anchor</h3>
            </div>
          </div>
          <div className={styles.timeToolForm}>
            <label className={styles.planLabel}>
              Day
              <input
                type="date"
                value={draft.dateKey}
                onChange={(event) => onChange({ dateKey: event.target.value })}
                className={styles.planControl}
              />
            </label>
            <div className={styles.planFormRow}>
              <label className={styles.planLabel}>
                Time
                <input
                  type="time"
                  value={draft.timeOfDay}
                  onChange={(event) => onChange({ timeOfDay: event.target.value })}
                  className={styles.planControl}
                />
              </label>
              <label className={styles.planLabel}>
                Minutes
                <input
                  type="number"
                  min={15}
                  max={240}
                  value={draft.durationMinutes}
                  onChange={(event) => onChange({ durationMinutes: Number(event.target.value) || 25 })}
                  className={styles.planControl}
                />
              </label>
            </div>
          </div>
        </section>

        <section className={styles.timeToolPanel}>
          <div className={styles.timeToolPanelHeader}>
            <div>
              <p className={styles.sectionLabel}>What</p>
              <h3 className={styles.timeToolPanelTitle}>Commitment details</h3>
            </div>
          </div>
          <div className={styles.timeToolForm}>
            <input
              value={draft.title}
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder="Task title"
              className={styles.planInput}
            />
            <textarea
              value={draft.note}
              onChange={(event) => onChange({ note: event.target.value.slice(0, 280) })}
              placeholder="Optional note, intention, or instruction for this block"
              className={styles.planNoteInput}
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
        </section>
      </div>
    </div>
  );
}
