"use client";

import { type CSSProperties } from "react";
import { motion } from "motion/react";

import styles from "@/app/page.module.css";
import XpBandanaLevelMark from "@/components/XpBandanaLevelMark";
import WhelmProfileAvatar from "@/components/WhelmProfileAvatar";
import { type AppTab } from "@/components/BottomNav";

type TopBarTierStyle = CSSProperties & {
  "--topbar-tier-glow": string;
  "--topbar-tier-edge": string;
  "--topbar-tier-wash": string;
};

function topBarTierVars(tierColor: string | null | undefined): TopBarTierStyle {
  switch (tierColor) {
    case "white":
      return {
        "--topbar-tier-glow": "rgba(248, 250, 255, 0.26)",
        "--topbar-tier-edge": "rgba(255, 255, 255, 0.52)",
        "--topbar-tier-wash": "rgba(230, 237, 255, 0.22)",
      };
    case "black":
      return {
        "--topbar-tier-glow": "rgba(111, 132, 196, 0.2)",
        "--topbar-tier-edge": "rgba(119, 133, 181, 0.34)",
        "--topbar-tier-wash": "rgba(32, 39, 66, 0.22)",
      };
    case "blue":
      return {
        "--topbar-tier-glow": "rgba(88, 166, 255, 0.26)",
        "--topbar-tier-edge": "rgba(88, 166, 255, 0.42)",
        "--topbar-tier-wash": "rgba(55, 116, 255, 0.2)",
      };
    case "purple":
      return {
        "--topbar-tier-glow": "rgba(180, 118, 255, 0.28)",
        "--topbar-tier-edge": "rgba(176, 118, 255, 0.44)",
        "--topbar-tier-wash": "rgba(124, 70, 255, 0.22)",
      };
    case "green":
      return {
        "--topbar-tier-glow": "rgba(89, 220, 157, 0.24)",
        "--topbar-tier-edge": "rgba(89, 220, 157, 0.38)",
        "--topbar-tier-wash": "rgba(38, 158, 102, 0.2)",
      };
    case "red":
      return {
        "--topbar-tier-glow": "rgba(255, 106, 106, 0.26)",
        "--topbar-tier-edge": "rgba(255, 106, 106, 0.42)",
        "--topbar-tier-wash": "rgba(188, 48, 48, 0.2)",
      };
    case "yellow":
    default:
      return {
        "--topbar-tier-glow": "rgba(255, 203, 92, 0.24)",
        "--topbar-tier-edge": "rgba(255, 203, 92, 0.38)",
        "--topbar-tier-wash": "rgba(214, 146, 42, 0.2)",
      };
  }
}

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
  streakPrompt?: {
    tone: "pending" | "reached";
    text: string;
  } | null;
  xpDockStyle: CSSProperties;
  currentLevel: number;
  progressToNextLevel: number;
  todayXp: number;
  dailyCap: number;
  formattedLifetimeXp: string;
  formattedXpToNextLevel: string;
  tierColor: string | null | undefined;
  identityReady: boolean;
  isPro: boolean;
  photoUrl: string | null | undefined;
  isMobileViewport: boolean;
  profileDisplayName: string;
  onProfileOpen: () => void;
  onMoreOpen: () => void;
};

export default function TopAppBar({
  activeTab,
  streakPrompt,
  xpDockStyle,
  currentLevel,
  progressToNextLevel,
  todayXp,
  dailyCap,
  formattedLifetimeXp,
  formattedXpToNextLevel,
  tierColor,
  identityReady,
  isPro,
  photoUrl,
  isMobileViewport,
  profileDisplayName,
  onProfileOpen,
  onMoreOpen,
}: TopAppBarProps) {
  const shellXpLabel = identityReady ? `${formattedLifetimeXp} XP` : "Syncing";
  const shellXpSubLabel = identityReady
    ? `${formattedXpToNextLevel} to level ${currentLevel + 1}`
    : "Rebuilding streak and XP";
  const topBarStyle = identityReady ? topBarTierVars(tierColor) : undefined;

  return (
    <div className={styles.topAppBar} style={topBarStyle}>
      <div className={styles.topAppBarHeading}>
        <p className={styles.topAppBarLabel}>Whelm Flow</p>
        <h2 className={styles.topAppBarTitle}>{tabTitle(activeTab)}</h2>
        {streakPrompt ? (
          <p
            className={`${styles.topAppBarStatus} ${
              streakPrompt.tone === "reached" ? styles.topAppBarStatusReached : styles.topAppBarStatusPending
            }`}
          >
            <span className={styles.topAppBarStatusBullet} aria-hidden="true" />
            <span>{streakPrompt.text}</span>
          </p>
        ) : null}
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
          data-tour="xp-dock"
          style={xpDockStyle}
          aria-label={
            identityReady
              ? `Level ${currentLevel}. ${formattedLifetimeXp} XP total. ${formattedXpToNextLevel} XP to next level.`
              : "Rebuilding streak and XP identity from synced history."
          }
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {identityReady ? (
            <XpBandanaLevelMark
              className={styles.xpDockBadge}
              tierColor={tierColor}
              level={currentLevel}
            />
          ) : (
            <div
              className={[styles.xpBandanaLevelMark, styles.xpDockBadge].join(" ")}
              aria-hidden="true"
              style={{ opacity: 0.28 }}
            />
          )}
          <div className={styles.xpDockTrack}>
            <motion.div
              className={styles.xpDockFill}
              initial={false}
              animate={{ width: identityReady ? `${Math.max(8, progressToNextLevel * 100)}%` : "18%" }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            />
            <div className={styles.xpDockCopy}>
              <strong>{shellXpLabel}</strong>
              <small>{shellXpSubLabel}</small>
            </div>
          </div>
          {identityReady && todayXp >= dailyCap ? (
            <div className={styles.xpDockCapNotice}>
              MAXXED TODAY POINTS {dailyCap}/{dailyCap}
            </div>
          ) : null}
        </motion.div>
        <button
          type="button"
          data-tour="profile-dock"
          className={`${styles.profileDockButton} ${
            isMobileViewport ? styles.profileDockButtonMobile : styles.profileDockButtonDesktop
          }`}
          onClick={onProfileOpen}
        >
          {identityReady ? (
            <WhelmProfileAvatar
              tierColor={tierColor}
              size="compact"
              isPro={isPro}
              photoUrl={photoUrl}
            />
          ) : (
            <div
              className={`${styles.profileAvatarCard} ${styles.profileAvatarCardCompact}`}
              aria-hidden="true"
              style={{ opacity: 0.28 }}
            />
          )}
          <span className={styles.profileDockCopy}>
            {!isMobileViewport ? <small>Profile</small> : null}
            <strong>{profileDisplayName}</strong>
          </span>
        </button>
        {!isMobileViewport ? (
          <button
            type="button"
            data-tour="nav-more"
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
