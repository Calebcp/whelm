"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { CSSProperties } from "react";
import { motion, AnimatePresence } from "motion/react";

import { type StreakBandanaTier } from "@/lib/streak-bandanas";
import WhelmRitualScene from "@/components/WhelmRitualScene";

import styles from "./MilestoneReveal.module.css";

type MilestoneRevealProps = {
  open: boolean;
  streak: number;
  tier: StreakBandanaTier | null;
  onOpenChange: (open: boolean) => void;
};

function getTierSceneVariant(color: string | undefined) {
  return color === "black" || color === "white" ? "totem" : "orb";
}

function getTierTheme(color: string | undefined) {
  switch (color) {
    case "white":
      return {
        accent: "#f6fbff",
        accentStrong: "#dbeafe",
        accentGlow: "rgba(255, 255, 255, 0.34)",
      };
    case "black":
      return {
        accent: "#8f9fc7",
        accentStrong: "#56698d",
        accentGlow: "rgba(142, 163, 207, 0.28)",
      };
    case "blue":
      return {
        accent: "#59c7ff",
        accentStrong: "#2f86ff",
        accentGlow: "rgba(84, 173, 255, 0.34)",
      };
    case "purple":
      return {
        accent: "#bf86ff",
        accentStrong: "#8a4dff",
        accentGlow: "rgba(174, 98, 255, 0.34)",
      };
    case "green":
      return {
        accent: "#59e07f",
        accentStrong: "#1fb850",
        accentGlow: "rgba(77, 212, 124, 0.32)",
      };
    case "red":
      return {
        accent: "#ff7676",
        accentStrong: "#f24545",
        accentGlow: "rgba(255, 92, 92, 0.32)",
      };
    case "yellow":
    default:
      return {
        accent: "#ffd84d",
        accentStrong: "#ffb400",
        accentGlow: "rgba(255, 196, 38, 0.32)",
      };
  }
}

function getRevealCopy(tier: StreakBandanaTier, streak: number) {
  const dayLabel = `${streak} day${streak === 1 ? "" : "s"}`;

  switch (tier.color) {
    case "white":
      return {
        title: "White bandana unlocked.",
        body: `You crossed into the top streak tier at ${dayLabel}. This one should feel rare because it is.`,
      };
    case "black":
      return {
        title: "Black bandana unlocked.",
        body: `Fifty days changes the identity, not just the score. ${dayLabel} is prestige territory now.`,
      };
    case "blue":
      return {
        title: "Blue bandana unlocked.",
        body: `The streak has real weight now. ${dayLabel} means the pattern is holding under pressure.`,
      };
    case "purple":
      return {
        title: "Purple bandana unlocked.",
        body: `Double digits matters. ${dayLabel} is no longer momentum by accident.`,
      };
    case "green":
      return {
        title: "Green bandana unlocked.",
        body: `Five clean days is where rhythm starts to feel earned. ${dayLabel} is real proof.`,
      };
    case "red":
      return {
        title: "Red bandana unlocked.",
        body: `The streak has survived the easy fade. ${dayLabel} means you came back on purpose.`,
      };
    case "yellow":
    default:
      return {
        title: "Yellow bandana unlocked.",
        body: `The streak is alive. Start simple, protect it tomorrow, and let the system build from there.`,
      };
  }
}

export default function MilestoneReveal({
  open,
  streak,
  tier,
  onOpenChange,
}: MilestoneRevealProps) {
  if (!tier) return null;

  const theme = getTierTheme(tier.color);
  const copy = getRevealCopy(tier, streak);
  const style = {
    "--milestone-accent": theme.accent,
    "--milestone-accent-strong": theme.accentStrong,
    "--milestone-accent-glow": theme.accentGlow,
    "--milestone-accent-shadow": theme.accentGlow,
  } as CSSProperties;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className={styles.overlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className={styles.content}
                style={style}
                initial={{ opacity: 0, y: 28, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.98 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              >
                <Dialog.Close className={styles.close} aria-label="Close milestone reveal">
                  ×
                </Dialog.Close>
                <div className={styles.hero}>
                  <motion.div
                    className={styles.glow}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1.12 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08, duration: 0.45 }}
                  >
                    <WhelmRitualScene
                      className={styles.scene}
                      variant={getTierSceneVariant(tier.color)}
                      celebrationLevel="full"
                    />
                  </motion.div>
                </div>
                <div className={styles.copy}>
                  <p className={styles.eyebrow}>Streak milestone</p>
                  <Dialog.Title asChild>
                    <h2 className={styles.title}>{copy.title}</h2>
                  </Dialog.Title>
                  <Dialog.Description asChild>
                    <p className={styles.body}>{copy.body}</p>
                  </Dialog.Description>
                  <div className={styles.stats}>
                    <div className={styles.stat}>
                      <span>Tier</span>
                      <strong>{tier.label}</strong>
                    </div>
                    <div className={styles.stat}>
                      <span>Current streak</span>
                      <strong>{streak}d</strong>
                    </div>
                    <div className={styles.stat}>
                      <span>Unlocked at</span>
                      <strong>{tier.minDays}d</strong>
                    </div>
                  </div>
                </div>
                <div className={styles.actions}>
                  <Dialog.Close asChild>
                    <button type="button" className={styles.button}>
                      Keep the streak alive
                    </button>
                  </Dialog.Close>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}
