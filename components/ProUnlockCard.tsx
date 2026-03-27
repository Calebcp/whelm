"use client";

import { type ReactNode } from "react";

import styles from "@/app/page.module.css";

export default function ProUnlockCard({
  title,
  body,
  open,
  onToggle,
  onPreview,
  preview,
}: {
  title: string;
  body: string;
  open: boolean;
  onToggle: () => void;
  onPreview: () => void;
  preview?: ReactNode;
}) {
  return (
    <div className={styles.proUnlockCard}>
      <button type="button" className={styles.proUnlockToggle} onClick={onToggle}>
        <div>
          <p className={styles.sectionLabel}>Whelm Pro Available</p>
          <strong>{title}</strong>
          <p className={styles.proUnlockMeta}>Premium surface, deeper system.</p>
        </div>
        <span>{open ? "Hide" : "Open"}</span>
      </button>
      {open ? (
        <div className={styles.proUnlockBody}>
          {preview ? <div className={styles.proUnlockPreview}>{preview}</div> : null}
          <p className={styles.accountMeta}>{body}</p>
          <div className={styles.proUnlockValueRow}>
            <span>Sharper visuals</span>
            <span>Deeper memory</span>
            <span>Full command reports</span>
          </div>
          <div className={styles.noteFooterActions}>
            <button type="button" className={styles.inlineUpgrade} onClick={onPreview}>
              Enter Whelm Pro Preview
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
