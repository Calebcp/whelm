"use client";

import styles from "@/app/page.module.css";

export default function ThemePromptModal({
  open,
  themeMode,
  onClose,
  onApplyThemeMode,
}: {
  open: boolean;
  themeMode: "dark" | "light" | "system";
  onClose: () => void;
  onApplyThemeMode: (mode: "dark" | "light" | "system") => void;
}) {
  if (!open) return null;

  return (
    <div className={styles.feedbackOverlay} onClick={onClose}>
      <div className={styles.feedbackModal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.feedbackHeader}>
          <h2 className={styles.feedbackTitle}>Choose your theme</h2>
          <button type="button" className={styles.feedbackClose} onClick={onClose}>
            Later
          </button>
        </div>
        <p className={styles.feedbackMeta}>
          Pick how Whelm should look when you return. You can change this later in Settings.
        </p>
        <div className={styles.companionStyleRow}>
          <button
            type="button"
            className={`${styles.companionStyleButton} ${themeMode === "dark" ? styles.companionStyleButtonActive : ""}`}
            onClick={() => onApplyThemeMode("dark")}
          >
            Dark
          </button>
          <button
            type="button"
            className={`${styles.companionStyleButton} ${themeMode === "light" ? styles.companionStyleButtonActive : ""}`}
            onClick={() => onApplyThemeMode("light")}
          >
            Light
          </button>
          <button
            type="button"
            className={`${styles.companionStyleButton} ${themeMode === "system" ? styles.companionStyleButtonActive : ""}`}
            onClick={() => onApplyThemeMode("system")}
          >
            Auto
          </button>
        </div>
      </div>
    </div>
  );
}
