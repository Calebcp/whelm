"use client";

import styles from "@/app/page.module.css";

export default function KpiDetailModal({
  openKey,
  content,
  onClose,
}: {
  openKey: string | null;
  content: Record<string, { title: string; summary: string; bullets: string[] }>;
  onClose: () => void;
}) {
  if (!openKey) return null;

  return (
    <div className={styles.feedbackOverlay} onClick={onClose}>
      <div className={styles.kpiModal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.feedbackHeader}>
          <h2 className={styles.feedbackTitle}>{content[openKey].title}</h2>
          <button type="button" className={styles.feedbackClose} onClick={onClose}>
            Close
          </button>
        </div>
        <p className={styles.paywallCopy}>{content[openKey].summary}</p>
        <ul className={styles.commandList}>
          {content[openKey].bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
