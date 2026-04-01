"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import WhelmProfileAvatar from "@/components/WhelmProfileAvatar";
import styles from "./WhelToast.module.css";

export type ToastVariant = "info" | "success" | "warning" | "error";

export type Toast = {
  id: string;
  message: string;
  variant?: ToastVariant;
  icon?: string;
};

const MAX_TOASTS = 2;
const AUTO_DISMISS_MS = 3000;

const ICONS: Record<ToastVariant, string> = {
  success: "✓",
  warning: "⚠",
  error: "✕",
  info: "ℹ",
};

function ToastItem({
  toast,
  onDismiss,
  currentTierColor,
  isPro,
  photoUrl,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
  currentTierColor: string | null | undefined;
  isPro: boolean;
  photoUrl?: string | null;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startX = useRef(0);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, onDismiss]);

  return (
    <motion.div
      layout
      className={`${styles.toast} ${styles[`toast_${toast.variant ?? "info"}`]}`}
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      onTouchStart={(e) => {
        startX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - startX.current;
        if (Math.abs(dx) > 60) onDismiss(toast.id);
      }}
      onClick={() => onDismiss(toast.id)}
      role="status"
      aria-live="polite"
    >
      <span className={styles.toastAvatarWrap}>
        <WhelmProfileAvatar
          tierColor={currentTierColor}
          size="mini"
          isPro={isPro}
        />
      </span>
      <span className={styles.toastMessage}>{toast.message}</span>
    </motion.div>
  );
}

// Hook for managing toasts
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info", icon?: string) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => {
        const next = [...prev, { id, message, variant, icon }];
        // Drop oldest if over limit
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
      });
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, dismissToast };
}

// Renderer component
export default function WhelToastContainer({
  toasts,
  onDismiss,
  currentTierColor,
  isPro,
  photoUrl,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  currentTierColor: string | null | undefined;
  isPro: boolean;
  photoUrl?: string | null;
}) {
  return (
    <div className={styles.container} aria-live="polite">
      <AnimatePresence mode="sync">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={onDismiss}
            currentTierColor={currentTierColor}
            isPro={isPro}
            photoUrl={photoUrl}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
