"use client";

import type { ReactNode } from "react";

import styles from "@/app/page.module.css";

type SelectedPlanDetail = {
  id: string;
  title: string;
  dateKey: string;
  timeOfDay: string;
  durationMinutes: number;
  attachmentCount?: number;
  note: string;
  status: "active" | "completed" | "deleted";
};

export default function BlockDetailModal({
  open,
  selectedPlanDetail,
  onClose,
  normalizeTimeLabel,
  attachmentIndicatorLabel,
  tonePicker,
  onEdit,
  onDuplicate,
  onComplete,
  onOpenDayView,
  onRemove,
}: {
  open: boolean;
  selectedPlanDetail: SelectedPlanDetail | null;
  onClose: () => void;
  normalizeTimeLabel: (raw: string) => string;
  attachmentIndicatorLabel: (count: number) => string;
  tonePicker: ReactNode;
  onEdit: () => void;
  onDuplicate: () => void;
  onComplete: () => void;
  onOpenDayView: () => void;
  onRemove: () => void;
}) {
  if (!open || !selectedPlanDetail) return null;

  return (
    <div className={styles.feedbackOverlay} onClick={onClose}>
      <div className={styles.feedbackModal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.feedbackHeader}>
          <div>
            <p className={styles.sectionLabel}>Block Detail</p>
            <h2 className={styles.feedbackTitle}>{selectedPlanDetail.title}</h2>
          </div>
          <button type="button" className={styles.feedbackClose} onClick={onClose}>
            Close
          </button>
        </div>
        <p className={styles.feedbackMeta}>
          {new Date(`${selectedPlanDetail.dateKey}T00:00:00`).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}{" "}
          • {normalizeTimeLabel(selectedPlanDetail.timeOfDay)} • {selectedPlanDetail.durationMinutes}m
          {selectedPlanDetail.attachmentCount
            ? ` • ${attachmentIndicatorLabel(selectedPlanDetail.attachmentCount)}`
            : ""}
        </p>
        {selectedPlanDetail.note.trim() ? (
          <div className={styles.blockDetailNote}>
            <strong>Block note</strong>
            <p>{selectedPlanDetail.note}</p>
          </div>
        ) : (
          <p className={styles.accountMeta}>No block note was added yet.</p>
        )}
        <div className={styles.calendarTonePanel}>{tonePicker}</div>
        <div className={styles.noteFooterActions}>
          {selectedPlanDetail.status === "active" ? (
            <button type="button" className={styles.secondaryPlanButton} onClick={onEdit}>
              Edit block
            </button>
          ) : null}
          {selectedPlanDetail.status === "active" ? (
            <button type="button" className={styles.secondaryPlanButton} onClick={onDuplicate}>
              Duplicate block
            </button>
          ) : null}
          {selectedPlanDetail.status === "active" ? (
            <button type="button" className={styles.planCompleteButton} onClick={onComplete}>
              Complete block
            </button>
          ) : null}
          <button type="button" className={styles.secondaryPlanButton} onClick={onOpenDayView}>
            Open in day view
          </button>
          {selectedPlanDetail.status === "active" ? (
            <button type="button" className={styles.planDeleteButton} onClick={onRemove}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
