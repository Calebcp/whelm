"use client";

import { type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

import styles from "@/app/page.module.css";

export default function CollapsibleSectionCard({
  className,
  label,
  title,
  description,
  open,
  onToggle,
  children,
}: {
  className?: string;
  label: string;
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <motion.article
      className={[styles.card, className].filter(Boolean).join(" ")}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        className={styles.cardCollapseToggle}
        onClick={onToggle}
        aria-expanded={open}
      >
        <div className={styles.cardCollapseCopy}>
          <p className={styles.sectionLabel}>{label}</p>
          <h2 className={styles.cardTitle}>{title}</h2>
          {description ? <p className={styles.accountMeta}>{description}</p> : null}
        </div>
        <span className={styles.cardCollapseState}>{open ? "Hide" : "Open"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className={styles.cardCollapseBody}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}
