"use client";

import styles from "@/app/page.module.css";

type QuickCardForm = {
  front: string;
  back: string;
};

type SelectionPopup = {
  text: string;
  x: number;
  y: number;
};

export default function QuickCardModal({
  selectionPopup,
  quickCardForm,
  onSetQuickCardForm,
  onSetSelectionPopup,
  onSave,
}: {
  selectionPopup: SelectionPopup | null;
  quickCardForm: QuickCardForm | null;
  onSetQuickCardForm: (value: QuickCardForm | null | ((current: QuickCardForm | null) => QuickCardForm | null)) => void;
  onSetSelectionPopup: (value: SelectionPopup | null) => void;
  onSave: () => void;
}) {
  return (
    <>
      {selectionPopup && !quickCardForm ? (
        <button
          type="button"
          className={styles.selectionCardPopup}
          style={{ left: selectionPopup.x, top: selectionPopup.y }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onSetQuickCardForm({ front: "", back: selectionPopup.text });
            onSetSelectionPopup(null);
          }}
        >
          📇 Create Card
        </button>
      ) : null}

      {quickCardForm ? (
        <div className={styles.feedbackOverlay} onClick={() => onSetQuickCardForm(null)}>
          <div className={styles.feedbackModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>Create Card from Note</h2>
              <button type="button" className={styles.feedbackClose} onClick={() => onSetQuickCardForm(null)}>
                ✕
              </button>
            </div>
            <label className={styles.planLabel}>
              Front (question)
              <input
                autoFocus
                value={quickCardForm.front}
                onChange={(event) =>
                  onSetQuickCardForm((current) => (current ? { ...current, front: event.target.value } : null))
                }
                className={styles.planControl}
                placeholder="What does this text answer?"
              />
            </label>
            <label className={styles.planLabel}>
              Back (answer)
              <textarea
                value={quickCardForm.back}
                onChange={(event) =>
                  onSetQuickCardForm((current) => (current ? { ...current, back: event.target.value } : null))
                }
                className={styles.feedbackTextarea}
                rows={5}
              />
            </label>
            <div className={styles.feedbackFooter}>
              <button
                type="button"
                className={styles.feedbackSubmit}
                onClick={onSave}
                disabled={!quickCardForm.front.trim() || !quickCardForm.back.trim()}
              >
                Save Card
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
