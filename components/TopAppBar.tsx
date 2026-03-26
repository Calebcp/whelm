"use client";

import { type CSSProperties } from "react";
import { motion } from "motion/react";

import styles from "@/app/page.module.css";
import XpBandanaLevelMark from "@/components/XpBandanaLevelMark";
import WhelmProfileAvatar from "@/components/WhelmProfileAvatar";
import { type AppTab } from "@/components/BottomNav";

function tabTitle(tab: AppTab): string {
  switch (tab) {
    case "today":
      return "Today";
    case "calendar":
      return "Schedule";
    case "leaderboard":
      return "Whelmboard";
    case "mirror":
      return "Streak Mirror";
    case "notes":
      return "Notes+";
    case "streaks":
      return "Streaks";
    case "history":
      return "History";
    case "reports":
      return "Reports";
    case "settings":
      return "Settings";
  }
}

type TopAppBarProps = {
  activeTab: AppTab;
  xpDockStyle: CSSProperties;
  currentLevel: number;
  progressToNextLevel: number;
  formattedLifetimeXp: string;
  formattedXpToNextLevel: string;
  tierColor: string | null | undefined;
  isPro: boolean;
  photoUrl: string | null | undefined;
  isMobileViewport: boolean;
  profileDisplayName: string;
  onProfileOpen: () => void;
  onMoreOpen: () => void;
};

export default function TopAppBar({
  activeTab,
  xpDockStyle,
  currentLevel,
  progressToNextLevel,
  formattedLifetimeXp,
  formattedXpToNextLevel,
  tierColor,
  isPro,
  photoUrl,
  isMobileViewport,
  profileDisplayName,
  onProfileOpen,
  onMoreOpen,
}: TopAppBarProps) {
  return (
    <div className={styles.topAppBar}>
      <div>
        <p className={styles.topAppBarLabel}>Whelm Flow</p>
        <h2 className={styles.topAppBarTitle}>{tabTitle(activeTab)}</h2>
      </div>
      <div className={styles.topAppBarRight}>
        <span className={styles.topAppBarDate}>
          {new Date().toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </span>
        <motion.div
          className={styles.xpDock}
          style={xpDockStyle}
          aria-label={`Level ${currentLevel}. ${formattedLifetimeXp} XP total. ${formattedXpToNextLevel} XP to next level.`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <XpBandanaLevelMark
            className={styles.xpDockBadge}
            tierColor={tierColor}
            level={currentLevel}
          />
          <div className={styles.xpDockTrack}>
            <motion.div
              className={styles.xpDockFill}
              initial={false}
              animate={{ width: `${Math.max(8, progressToNextLevel * 100)}%` }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            />
            <div className={styles.xpDockCopy}>
              <strong>{formattedLifetimeXp} XP</strong>
              <small>{formattedXpToNextLevel} to level {currentLevel + 1}</small>
            </div>
          </div>
        </motion.div>
        <button
          type="button"
          className={`${styles.profileDockButton} ${
            isMobileViewport ? styles.profileDockButtonMobile : styles.profileDockButtonDesktop
          }`}
          onClick={onProfileOpen}
        >
          <WhelmProfileAvatar
            tierColor={tierColor}
            size="compact"
            isPro={isPro}
            photoUrl={photoUrl}
          />
          <span className={styles.profileDockCopy}>
            {!isMobileViewport ? <small>Profile</small> : null}
            <strong>{profileDisplayName}</strong>
          </span>
        </button>
        {!isMobileViewport ? (
          <button
            type="button"
            className={styles.topAppBarAction}
            onClick={onMoreOpen}
          >
            More
          </button>
        ) : null}
      </div>
    </div>
  );
}
