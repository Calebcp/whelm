"use client";

import { type ReactNode } from "react";

import styles from "@/app/page.module.css";
import { WHELM_PRO_NAME, WHELM_STANDARD_NAME } from "@/lib/whelm-plans";

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
          <p className={styles.sectionLabel}>{WHELM_PRO_NAME} Available</p>
          <strong>{title}</strong>
          <p className={styles.proUnlockMeta}>{WHELM_STANDARD_NAME} handles the core flow. {WHELM_PRO_NAME} adds the deeper layer.</p>
        </div>
        <span>{open ? "Hide" : "Open"}</span>
      </button>
      {open ? (
        <div className={styles.proUnlockBody}>
          {preview ? <div className={styles.proUnlockPreview}>{preview}</div> : null}
          <p className={styles.accountMeta}>{body}</p>
          <div className={styles.proUnlockValueRow}>
            <span>Longer memory</span>
            <span>Full customization</span>
            <span>Deeper reports</span>
          </div>
          <div className={styles.noteFooterActions}>
            <button type="button" className={styles.inlineUpgrade} onClick={onPreview}>
              Upgrade to {WHELM_PRO_NAME}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
