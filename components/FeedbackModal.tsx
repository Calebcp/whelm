"use client";

import styles from "@/app/page.module.css";

type FeedbackCategory = "bug" | "feature" | "other";

export default function FeedbackModal({
  open,
  feedbackSubmitting,
  feedbackStatus,
  feedbackCategory,
  feedbackMessage,
  userEmail,
  onClose,
  onSetFeedbackStatus,
  onSetFeedbackCategory,
  onSetFeedbackMessage,
  onSubmit,
}: {
  open: boolean;
  feedbackSubmitting: boolean;
  feedbackStatus: string;
  feedbackCategory: FeedbackCategory;
  feedbackMessage: string;
  userEmail: string | null | undefined;
  onClose: () => void;
  onSetFeedbackStatus: (value: string) => void;
  onSetFeedbackCategory: (value: FeedbackCategory) => void;
  onSetFeedbackMessage: (value: string) => void;
  onSubmit: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className={styles.feedbackOverlay}
      onClick={() => {
        if (!feedbackSubmitting) {
          onClose();
          onSetFeedbackStatus("");
        }
      }}
    >
      <div className={styles.feedbackModal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.feedbackHeader}>
          <h2 className={styles.feedbackTitle}>Send feedback</h2>
          <button
            type="button"
            className={styles.feedbackClose}
            disabled={feedbackSubmitting}
            onClick={() => {
              onClose();
              onSetFeedbackStatus("");
            }}
          >
            Close
          </button>
        </div>

        <div className={styles.feedbackMeta}>
          <span>{userEmail || "Unknown email"}</span>
        </div>

        <label className={styles.feedbackLabel} htmlFor="feedback-category">
          Category
        </label>
        <select
          id="feedback-category"
          value={feedbackCategory}
          onChange={(event) => onSetFeedbackCategory(event.target.value as FeedbackCategory)}
          className={styles.feedbackSelect}
          disabled={feedbackSubmitting}
        >
          <option value="bug">Bug</option>
          <option value="feature">Feature</option>
          <option value="other">Other</option>
        </select>

        <label className={styles.feedbackLabel} htmlFor="feedback-message">
          Message
        </label>
        <textarea
          id="feedback-message"
          value={feedbackMessage}
          onChange={(event) => onSetFeedbackMessage(event.target.value)}
          className={styles.feedbackTextarea}
          placeholder="What happened? What should change?"
          maxLength={2000}
          disabled={feedbackSubmitting}
        />

        <div className={styles.feedbackFooter}>
          <button
            type="button"
            className={styles.feedbackSubmit}
            onClick={onSubmit}
            disabled={feedbackSubmitting}
          >
            {feedbackSubmitting ? "Sending..." : "Send feedback"}
          </button>
          {feedbackStatus && <p className={styles.feedbackStatus}>{feedbackStatus}</p>}
        </div>
      </div>
    </div>
  );
}
