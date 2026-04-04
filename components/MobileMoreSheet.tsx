"use client";

import type { ReactNode } from "react";

import styles from "@/app/page.module.css";

export default function MobileMoreSheet({
  open,
  onClose,
  tabs,
  onSelectTab,
  renderIcon,
  getTitle,
}: {
  open: boolean;
  onClose: () => void;
  tabs: readonly string[];
  onSelectTab: (tab: string) => void;
  renderIcon: (tab: string) => ReactNode;
  getTitle: (tab: string) => string;
}) {
  if (!open) return null;

  return (
    <div className={styles.feedbackOverlay} onClick={onClose}>
      <div className={styles.mobileMoreSheet} onClick={(event) => event.stopPropagation()}>
        <div className={styles.feedbackHeader}>
          <h2 className={styles.feedbackTitle}>More Features</h2>
          <button type="button" className={styles.feedbackClose} onClick={onClose}>
            Close
          </button>
        </div>
        <div className={styles.mobileMoreGrid}>
          {tabs.map((tab) => (
            <button key={tab} type="button" className={styles.mobileMoreButton} onClick={() => onSelectTab(tab)}>
              <span className={styles.bottomTabIcon}>{renderIcon(tab)}</span>
              <strong>{getTitle(tab)}</strong>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
