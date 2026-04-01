"use client";

import type { CSSProperties } from "react";
import { motion } from "motion/react";

import styles from "@/app/page.module.css";
import WhelmProfileAvatar from "@/components/WhelmProfileAvatar";
import type { SessionRewardState } from "@/lib/xp-engine";

export default function SessionRewardToast({
  reward,
  onDismiss,
  getStreakTierColorTheme,
  currentTierColor,
  isPro,
  photoUrl,
}: {
  reward: SessionRewardState;
  onDismiss: () => void;
  getStreakTierColorTheme: (tierColor: string | null | undefined) => {
    accent: string;
    accentStrong: string;
    accentGlow: string;
  };
  currentTierColor: string | null | undefined;
  isPro: boolean;
  photoUrl?: string | null;
}) {
  const tierTheme = getStreakTierColorTheme(reward.tierUnlocked?.color);
  const rewardStyle = {
    "--reward-accent": tierTheme.accent,
    "--reward-accent-strong": tierTheme.accentStrong,
    "--reward-accent-glow": tierTheme.accentGlow,
  } as CSSProperties;

  return (
    <motion.div
      className={styles.sessionRewardToast}
      style={rewardStyle}
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.98 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
    >
      <button type="button" className={styles.sessionRewardClose} onClick={onDismiss} aria-label="Dismiss reward">
        ×
      </button>
      <div className={styles.sessionRewardTop}>
        <div className={styles.sessionRewardAvatarWrap}>
          <WhelmProfileAvatar
            tierColor={currentTierColor}
            size="mini"
            isPro={isPro}
          />
        </div>
        <div>
          <p className={styles.sectionLabel}>Whelm logged it</p>
          <h3 className={styles.sessionRewardTitle}>+{reward.xpGained} XP</h3>
          <p className={styles.sessionRewardBody}>
            {reward.minutesSpent} minutes banked. Today sits at {reward.todayXp} XP.
          </p>
        </div>
        <div className={styles.sessionRewardBadge}>
          <span>{reward.minutesSpent}m</span>
        </div>
      </div>
      <div className={styles.sessionRewardStats}>
        <div className={styles.sessionRewardStat}>
          <span>Streak</span>
          <strong>
            {reward.streakAfter}d
            {reward.streakDelta > 0 ? ` · +${reward.streakDelta}` : ""}
          </strong>
        </div>
        <div className={styles.sessionRewardStat}>
          <span>Level</span>
          <strong>{reward.leveledUp ? "Level up" : "Progress"}</strong>
        </div>
        <div className={styles.sessionRewardStat}>
          <span>Tier</span>
          <strong>{reward.tierUnlocked?.label ?? "Steady"}</strong>
        </div>
      </div>
    </motion.div>
  );
}
