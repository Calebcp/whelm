"use client";

import { type CSSProperties, type ReactNode } from "react";

import TopAppBar from "@/components/TopAppBar";
import type { AppTab } from "@/lib/app-tabs";
import styles from "@/app/page.module.css";

type NavIconKey = AppTab | "more";

export const DESKTOP_PRIMARY_TABS: Array<{ key: AppTab; label: string }> = [
  { key: "calendar", label: "Schedule" },
  { key: "today", label: "Today" },
  { key: "notes", label: "Notes+" },
  { key: "leaderboard", label: "Whelmboard" },
];

export const MOBILE_MORE_TABS: AppTab[] = [
  "mirror",
  "streaks",
  "history",
  "reports",
  "settings",
];

function WhelmNavIcon({ icon }: { icon: NavIconKey }) {
  const svgProps = {
    viewBox: "0 0 64 64",
    "aria-hidden": true as const,
    className: styles.navIconSvg,
  };

  switch (icon) {
    case "mirror":
      return <img src="/mirror-icon-tab.png" alt="" className={styles.navIconImage} />;
    case "today":
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="todayFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A7F6FF" />
              <stop offset="100%" stopColor="#45D4FF" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="22" fill="url(#todayFill)" opacity="0.24" />
          <circle cx="32" cy="32" r="17.5" fill="none" stroke="#1E86FF" strokeWidth="6" />
          <circle cx="32" cy="32" r="8.5" fill="#83EEFF" stroke="#1E86FF" strokeWidth="3" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="calendarFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A3F4FF" />
              <stop offset="100%" stopColor="#48D0FF" />
            </linearGradient>
          </defs>
          <rect x="9" y="12" width="46" height="42" rx="12" fill="url(#calendarFill)" stroke="#1E86FF" strokeWidth="3.5" />
          <rect x="9" y="20" width="46" height="8" rx="4" fill="#1E86FF" opacity="0.9" />
          <rect x="18" y="8" width="6" height="12" rx="3" fill="#C7FBFF" stroke="#1E86FF" strokeWidth="2" />
          <rect x="40" y="8" width="6" height="12" rx="3" fill="#C7FBFF" stroke="#1E86FF" strokeWidth="2" />
          <line x1="19" y1="35" x2="45" y2="35" stroke="#1E86FF" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="19" y1="44" x2="45" y2="44" stroke="#1E86FF" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
        </svg>
      );
    case "leaderboard":
      return <img src="/leaderboard-icon-tab.png" alt="" className={styles.navIconImage} />;
    case "notes":
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="notesFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A5F5FF" />
              <stop offset="100%" stopColor="#4DD5FF" />
            </linearGradient>
          </defs>
          <path d="M17 19h30v28a5 5 0 0 1-5 5H22a5 5 0 0 1-5-5V19Z" fill="url(#notesFill)" stroke="#1E86FF" strokeWidth="3.5" />
          <path d="M24 16h16" stroke="#1E86FF" strokeWidth="4" strokeLinecap="round" />
          <path d="m41 12 10 10" stroke="#1E86FF" strokeWidth="4" strokeLinecap="round" />
          <circle cx="47" cy="18" r="8" fill="#FF6262" stroke="#261318" strokeWidth="3" />
          <path d="M44.5 21.5 33 33" stroke="#261318" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      );
    case "streaks":
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="streakFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8FF2FF" />
              <stop offset="100%" stopColor="#39C6FF" />
            </linearGradient>
          </defs>
          <path
            d="M8 33c8-9 18-11 31-11 8 0 13 2 17 4-1 5-4 9-9 11l-5 2 9 10c-5 2-11 0-15-4l-3-4c-3 4-7 7-13 8 2-6 4-10 5-13l-17 3Z"
            fill="url(#streakFill)"
            stroke="#1388F5"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path d="M16 32c8-4 18-6 28-5" stroke="#D8FFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
        </svg>
      );
    case "history":
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="historyFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A0F2FF" />
              <stop offset="100%" stopColor="#46CCFF" />
            </linearGradient>
          </defs>
          <rect x="10" y="10" width="44" height="44" rx="14" fill="url(#historyFill)" stroke="#1E86FF" strokeWidth="3.5" />
          <circle cx="22" cy="32" r="3.5" fill="none" stroke="#1E86FF" strokeWidth="3" />
          <circle cx="32" cy="32" r="3.5" fill="none" stroke="#1E86FF" strokeWidth="3" />
          <circle cx="42" cy="32" r="3.5" fill="none" stroke="#1E86FF" strokeWidth="3" />
        </svg>
      );
    case "reports":
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="reportsFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9AEFFF" />
              <stop offset="100%" stopColor="#41CBFF" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="22" fill="url(#reportsFill)" stroke="#1E86FF" strokeWidth="3.5" />
          <path d="M32 32V10a22 22 0 0 1 22 22H32Z" fill="#7CE8FF" stroke="#1E86FF" strokeWidth="3" strokeLinejoin="round" />
          <path d="M32 32 16.5 47.5A22 22 0 0 1 10 32h22Z" fill="#5AD9FF" stroke="#1E86FF" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="32" cy="32" r="4" fill="#1E86FF" />
        </svg>
      );
    case "settings":
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="settingsFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#99F0FF" />
              <stop offset="100%" stopColor="#3CCBFF" />
            </linearGradient>
          </defs>
          <path
            d="m32 11 4 2 5-1 4 5 5 2-1 5 2 4-2 4 1 5-5 2-4 5-5-1-4 2-4-2-5 1-4-5-5-2 1-5-2-4 2-4-1-5 5-2 4-5 5 1 4-2Z"
            fill="url(#settingsFill)"
            stroke="#1E86FF"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="32" r="9" fill="#CCFCFF" stroke="#1E86FF" strokeWidth="3.5" />
        </svg>
      );
    case "more":
      return (
        <svg {...svgProps}>
          <defs>
            <linearGradient id="moreFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9EF1FF" />
              <stop offset="100%" stopColor="#44D0FF" />
            </linearGradient>
          </defs>
          <rect x="10" y="10" width="44" height="44" rx="14" fill="url(#moreFill)" stroke="#1E86FF" strokeWidth="3.5" />
          <circle cx="22" cy="32" r="3.5" fill="none" stroke="#1E86FF" strokeWidth="3" />
          <circle cx="32" cy="32" r="3.5" fill="none" stroke="#1E86FF" strokeWidth="3" />
          <circle cx="42" cy="32" r="3.5" fill="none" stroke="#1E86FF" strokeWidth="3" />
        </svg>
      );
  }
}

export function renderAppNavIcon(tab: NavIconKey) {
  return <WhelmNavIcon icon={tab} />;
}

export function tabTitle(tab: AppTab) {
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

export function mobileTabDescription(tab: AppTab) {
  switch (tab) {
    case "calendar":
      return "Plan blocks and read the day clearly.";
    case "leaderboard":
      return "Check rank, prestige, and movement.";
    case "reports":
      return "Read patterns, timing, and performance.";
    case "streaks":
      return "Protect the run and track milestones.";
    case "history":
      return "Review the record without guesswork.";
    case "mirror":
      return "Private reset and accountability space.";
    case "settings":
      return "Tune system behavior and account state.";
    default:
      return "Open the next lane.";
  }
}

type HomeShellFrameProps = {
  resolvedTheme: "light" | "dark";
  backgroundSkinActive: boolean;
  pageShellStyle: CSSProperties;
  activeTab: AppTab;
  mobileMoreActive: boolean;
  mobileMoreOpen: boolean;
  onSelectTab: (tab: AppTab | "more") => void;
  subtitle: string;
  xpDockStyle: CSSProperties;
  currentLevel: number;
  progressToNextLevel: number;
  todayXp: number;
  dailyCap: number;
  formattedLifetimeXp: string;
  formattedXpToNextLevel: string;
  tierColor: string | null | undefined;
  isPro: boolean;
  photoUrl: string | null | undefined;
  isMobileViewport: boolean;
  profileDisplayName: string;
  onProfileOpen: () => void;
  onMoreOpen: () => void;
  children: ReactNode;
};

export default function HomeShellFrame({
  resolvedTheme,
  backgroundSkinActive,
  pageShellStyle,
  activeTab,
  mobileMoreActive,
  mobileMoreOpen,
  onSelectTab,
  subtitle,
  xpDockStyle,
  currentLevel,
  progressToNextLevel,
  todayXp,
  dailyCap,
  formattedLifetimeXp,
  formattedXpToNextLevel,
  tierColor,
  isPro,
  photoUrl,
  isMobileViewport,
  profileDisplayName,
  onProfileOpen,
  onMoreOpen,
  children,
}: HomeShellFrameProps) {
  return (
    <main
      className={`${styles.pageShell} ${
        resolvedTheme === "light" ? styles.themeLight : styles.themeDark
      } ${backgroundSkinActive ? styles.pageShellGlass : ""}`}
      style={pageShellStyle}
    >
      <div className={styles.pageFrame}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>WHELM</p>
            <h1 className={styles.title}>Enter Whelm Flow.</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
          <div className={styles.headerActions}>
            <span className={styles.headerTag}>Whelm Flow</span>
            <span className={styles.headerTag}>No drift</span>
            <span className={styles.headerTag}>Daily command</span>
          </div>
        </header>

        <nav className={styles.tabRail}>
          {DESKTOP_PRIMARY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              data-tour={
                tab.key === "calendar"
                  ? "nav-schedule"
                  : tab.key === "today"
                    ? "nav-today"
                    : tab.key === "notes"
                      ? "nav-notes"
                      : tab.key === "leaderboard"
                        ? "nav-whelmboard"
                        : undefined
              }
              className={`${styles.tabButton} ${activeTab === tab.key ? styles.tabButtonActive : ""}`}
              onClick={() => onSelectTab(tab.key)}
            >
              <span className={styles.tabIcon}>{renderAppNavIcon(tab.key)}</span>
              <span>{tab.label}</span>
            </button>
          ))}
          <button
            type="button"
            data-tour="nav-more"
            className={`${styles.tabButton} ${mobileMoreActive || mobileMoreOpen ? styles.tabButtonActive : ""}`}
            onClick={() => onSelectTab("more")}
          >
            <span className={styles.tabIcon}>{renderAppNavIcon("more")}</span>
            <span>More</span>
          </button>
        </nav>

        <section className={styles.screen}>
          <TopAppBar
            activeTab={activeTab}
            xpDockStyle={xpDockStyle}
            currentLevel={currentLevel}
            progressToNextLevel={progressToNextLevel}
            todayXp={todayXp}
            dailyCap={dailyCap}
            formattedLifetimeXp={formattedLifetimeXp}
            formattedXpToNextLevel={formattedXpToNextLevel}
            tierColor={tierColor}
            isPro={isPro}
            photoUrl={photoUrl}
            isMobileViewport={isMobileViewport}
            profileDisplayName={profileDisplayName}
            onProfileOpen={onProfileOpen}
            onMoreOpen={onMoreOpen}
          />

          {children}
        </section>
      </div>
    </main>
  );
}
