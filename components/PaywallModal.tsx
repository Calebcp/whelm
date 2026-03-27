"use client";

import styles from "@/app/page.module.css";

const WHELM_PRO_POSITIONING =
  "Whelm Pro is the full version of the system: deeper reports, longer memory, stronger personalization, a cleaner command center, and of course more animated PRO WHELMS!";

export default function PaywallModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className={styles.feedbackOverlay} onClick={onClose}>
      <div className={styles.paywallModal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.feedbackHeader}>
          <h2 className={styles.feedbackTitle}>Upgrade to Whelm Pro</h2>
          <button type="button" className={styles.feedbackClose} onClick={onClose}>
            Close
          </button>
        </div>
        <p className={styles.paywallCopy}>{WHELM_PRO_POSITIONING}</p>
        <div className={styles.planGrid}>
          <article className={`${styles.planCard} ${styles.planCardFeatured}`}>
            <p className={styles.planName}>Whelm Pro Founding Release</p>
            <p className={styles.planPrice}>Soon</p>
            <p className={styles.planMeta}>early users will receive a strong launch offer</p>
          </article>
        </div>
        <ul className={styles.proList}>
          <li>Deeper command reports and score history</li>
          <li>Longer memory across streaks, history, and reflections</li>
          <li>Stronger personalization, cleaner command surfaces, and more animated PRO WHELMS!</li>
        </ul>
        <div className={styles.paywallActions}>
          <button type="button" className={styles.feedbackSubmit} onClick={onClose}>
            Stay in Whelm Free
          </button>
        </div>
        <p className={styles.paywallHint}>
          Billing is not live in this version. Whelm Pro will be introduced in a later release.
        </p>
      </div>
    </div>
  );
}
