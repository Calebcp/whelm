"use client";

import { useEffect, useState } from "react";

import { type WhelBandanaColor, type WhelPose, getWhelImagePath } from "@/lib/whelm-mascot";
import styles from "./WhelMascot.module.css";

export type WhelMascotProps = {
  pose: WhelPose;
  bandanaColor: WhelBandanaColor;
  message: string;
  onDismiss: () => void;
  /** Auto-dismiss after this many ms. Default 5000. Pass 0 to disable. */
  autoDismissMs?: number;
};

export default function WhelMascot({
  pose,
  bandanaColor,
  message,
  onDismiss,
  autoDismissMs = 5000,
}: WhelMascotProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const id = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(id);
  }, [autoDismissMs, onDismiss]);

  const src = getWhelImagePath(pose, bandanaColor);

  return (
    <div
      className={`${styles.mascotRoot} ${visible ? styles.mascotVisible : ""}`}
      role="status"
      aria-live="polite"
      onClick={onDismiss}
    >
      <div className={styles.mascotBubble}>
        <p className={styles.mascotMessage}>{message}</p>
      </div>
      <img src={src} alt="Whelm" className={styles.mascotImage} />
    </div>
  );
}
