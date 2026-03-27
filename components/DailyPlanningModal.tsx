"use client";

import type { ReactNode } from "react";

import styles from "@/app/page.module.css";
import CalendarTonePicker from "@/components/CalendarTonePicker";
import type { DailyRitualBlockDraft } from "@/hooks/usePlannedBlocks";

export default function DailyPlanningModal({
  open,
  previewOpen,
  dailyRitualDrafts,
  dailyRitualExpandedId,
  onSetDailyRitualExpandedId,
  onUpdateDailyRitualDraft,
  isPro,
  onUpgrade,
  dailyPlanningStatus,
  onClose,
  onSubmit,
  headerIcon,
  submitDecoration,
}: {
  open: boolean;
  previewOpen: boolean;
  dailyRitualDrafts: DailyRitualBlockDraft[];
  dailyRitualExpandedId: string | null;
  onSetDailyRitualExpandedId: (value: string | null | ((current: string | null) => string | null)) => void;
  onUpdateDailyRitualDraft: (id: string, patch: Partial<DailyRitualBlockDraft>) => void;
  isPro: boolean;
  onUpgrade: () => void;
  dailyPlanningStatus: string;
  onClose: () => void;
  onSubmit: () => void;
  headerIcon: ReactNode;
  submitDecoration: ReactNode;
}) {
  if (!open || !previewOpen) return null;

  return (
    <div className={styles.feedbackOverlay}>
      <div
        className={`${styles.feedbackModal} ${styles.dailyRitualModal}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.dailyRitualCornerIcon}>{headerIcon}</div>
        <div className={styles.feedbackHeader}>
          <div>
            <p className={styles.sectionLabel}>Daily Commitments</p>
            <h2 className={styles.feedbackTitle}>Claim today before it claims you.</h2>
          </div>
        </div>
        <p className={styles.feedbackMeta}>
          <strong className={styles.dailyRitualCallout}>3 daily commitments to enter.</strong>{" "}
          {previewOpen
            ? "Preview mode only. Inspect the flow without changing today."
            : "Place them before Whelm unlocks. Each one must be at least 15 minutes."}
        </p>
        <div className={styles.dailyRitualList}>
          {dailyRitualDrafts.map((draft, index) => {
            const locked = Boolean(draft.existingBlockId);
            const expanded = dailyRitualExpandedId === draft.id;
            return (
              <div key={draft.id} className={styles.dailyRitualItem}>
                <button
                  type="button"
                  className={styles.dailyRitualHeader}
                  onClick={() =>
                    onSetDailyRitualExpandedId((current) => (current === draft.id ? null : draft.id))
                  }
                >
                  <div className={styles.dailyRitualHeaderMain}>
                    <strong>Commitment {index + 1}</strong>
                    <span>{locked ? "Claimed" : "Required"}</span>
                  </div>
                  <div className={styles.dailyRitualSummary}>
                    <span>{draft.title.trim() || "What are you protecting?"}</span>
                    <small>
                      {draft.timeOfDay} • {draft.durationMinutes}m
                    </small>
                  </div>
                </button>
                {expanded && (
                  <>
                    <div className={styles.dailyRitualGrid}>
                      <input
                        value={draft.title}
                        onChange={(event) => onUpdateDailyRitualDraft(draft.id, { title: event.target.value })}
                        placeholder="What are you protecting?"
                        className={styles.planInput}
                        disabled={locked}
                      />
                      <label className={styles.planLabel}>
                        Time
                        <input
                          type="time"
                          value={draft.timeOfDay}
                          onChange={(event) =>
                            onUpdateDailyRitualDraft(draft.id, { timeOfDay: event.target.value })
                          }
                          className={styles.planControl}
                          disabled={locked}
                        />
                      </label>
                      <label className={styles.planLabel}>
                        Minutes
                        <input
                          type="number"
                          min={15}
                          max={240}
                          value={draft.durationMinutes}
                          onChange={(event) =>
                            onUpdateDailyRitualDraft(draft.id, {
                              durationMinutes: Number(event.target.value) || 0,
                            })
                          }
                          className={styles.planControl}
                          disabled={locked}
                        />
                      </label>
                    </div>
                    {isPro ? (
                      <CalendarTonePicker
                        label="Block tone"
                        selectedTone={draft.tone}
                        onSelectTone={(tone) => onUpdateDailyRitualDraft(draft.id, { tone })}
                        isPro={isPro}
                        onUpgrade={onUpgrade}
                      />
                    ) : null}
                    <textarea
                      value={draft.note}
                      onChange={(event) =>
                        onUpdateDailyRitualDraft(draft.id, { note: event.target.value.slice(0, 280) })
                      }
                      placeholder="Optional note"
                      className={styles.dailyRitualNote}
                      disabled={locked}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
        {dailyPlanningStatus && <p className={styles.feedbackStatus}>{dailyPlanningStatus}</p>}
        <div className={`${styles.feedbackFooter} ${styles.dailyRitualFooter}`}>
          <button
            type="button"
            className={`${styles.feedbackClose} ${styles.dailyRitualFooterClose}`}
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className={`${styles.feedbackSubmit} ${styles.dailyRitualSubmit}`}
            onClick={onSubmit}
          >
            <span className={styles.dailyRitualSubmitLabelWrap}>
              <span className={styles.dailyRitualSubmitLabel}>{previewOpen ? "Close preview" : "Submit"}</span>
            </span>
            <span className={styles.dailyRitualSubmitBandanaPanel} aria-hidden="true">
              {submitDecoration}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
