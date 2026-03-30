"use client";

import { type CSSProperties, type Ref, useState } from "react";
import { motion } from "motion/react";

import sharedStyles from "@/app/page.module.css";
import AnimatedTabSection from "@/components/AnimatedTabSection";
import FriendsTab from "@/components/FriendsTab";
import WhelmProfileAvatar from "@/components/WhelmProfileAvatar";
import styles from "@/components/WhelmboardTab.module.css";
import { getStreakBandanaTier } from "@/lib/streak-bandanas";
import { getStreakTierColorTheme } from "@/lib/xp-utils";
import type {
  FriendProfile,
  FriendRequestDoc,
  FriendWithXp,
  OutgoingFriendRequestDoc,
} from "@/hooks/useFriends";

// ── Types ────────────────────────────────────────────────────────────────────

type WhelmboardSurfaceTab = "global" | "friends" | "bandana";
type LeaderboardMetricTab = "xp" | "streak";

type LeaderboardEntry = {
  id: string;
  username: string;
  createdAtISO: string;
  level: number;
  totalXp: number;
  currentStreak: number;
  bestStreak?: number;
  totalFocusHours?: number;
  avatarUrl?: string | null;
  isProStyle?: boolean;
  isCurrentUser?: boolean;
};

type LeaderboardMovement = {
  delta: number;
  previousRank: number | null;
  direction: "up" | "down" | "same" | "new";
};

type LeaderboardBandanaHolder = {
  color: string;
  label: string;
  entry: LeaderboardEntry | null;
};

type LeaderboardRowData = {
  entry: LeaderboardEntry;
  rank: number;
  movement: LeaderboardMovement;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function bandanaCursorAssetPath(color: string | null | undefined, size: 128 | 256 = 128) {
  if (!color) return "";
  return `/streak/cursor/bandana-${color}-${size}.png`;
}

function bandanaImageGlow(color: string | null | undefined): string {
  if (!color) return "transparent";
  return `var(--bandana-glow-${color}, rgba(255,255,255,0.3))`;
}

function formatLeaderboardXp(totalXp: number) {
  return `${totalXp.toLocaleString()} XP`;
}

function getLeaderboardBandanaMeta(streak: number) {
  const tier = getStreakBandanaTier(streak);
  const theme = getStreakTierColorTheme(tier?.color);
  return {
    tier,
    theme,
    label: tier ? tier.label : "No bandana",
    shortLabel: tier ? tier.label.replace(" Bandana", "") : "None",
  };
}

function leaderboardMovementLabel(movement: LeaderboardMovement, tab: LeaderboardMetricTab) {
  if (movement.direction === "new") return tab === "xp" ? "New challenger" : "New";
  if (movement.direction === "same") return tab === "xp" ? "No movement" : "Flat";
  const magnitude = Math.abs(movement.delta);
  return movement.direction === "up"
    ? `${tab === "xp" ? "Up" : "+"}${magnitude}`
    : `${tab === "xp" ? "Down" : "-"}${magnitude}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LeaderboardMovementIndicator({
  movement,
  tab,
}: {
  movement: LeaderboardMovement;
  tab: LeaderboardMetricTab;
}) {
  const label = leaderboardMovementLabel(movement, tab);
  const magnitude = Math.abs(movement.delta);
  const directionClassName =
    movement.direction === "up"
      ? styles.leaderboardMovementUp
      : movement.direction === "down"
        ? styles.leaderboardMovementDown
        : movement.direction === "new"
          ? styles.leaderboardMovementNew
          : styles.leaderboardMovementSame;

  const icon =
    movement.direction === "up"
      ? "▲"
      : movement.direction === "down"
        ? "▼"
        : movement.direction === "new"
          ? "✦"
          : "•";
  const text =
    movement.direction === "same"
      ? tab === "xp"
        ? "Flat"
        : "Even"
      : movement.direction === "new"
        ? "New"
        : `${movement.direction === "up" ? "+" : "-"}${magnitude}`;

  return (
    <motion.span
      className={`${styles.leaderboardMovementBadge} ${directionClassName}`}
      initial={{ opacity: 0, scale: 0.92, y: 2 }}
      animate={
        movement.direction === "same"
          ? { opacity: 1, scale: 1, y: 0 }
          : { opacity: 1, scale: [0.96, 1.04, 1], y: [2, -1, 0] }
      }
      transition={{
        duration: movement.direction === "same" ? 0.2 : 0.55,
        ease: [0.22, 1, 0.36, 1],
      }}
      title={label}
      aria-label={label}
    >
      <span className={styles.leaderboardMovementArrow} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.leaderboardMovementText}>{text}</span>
    </motion.span>
  );
}

function LeaderboardRow({
  entry,
  rank,
  movement,
  tab,
  onClick,
}: {
  entry: LeaderboardEntry;
  rank: number;
  movement: LeaderboardMovement;
  tab: LeaderboardMetricTab;
  onClick?: () => void;
}) {
  const bandana = getLeaderboardBandanaMeta(entry.currentStreak);
  const rankAccent =
    rank === 1 ? styles.leaderboardRowGold
    : rank === 2 ? styles.leaderboardRowSilver
    : rank === 3 ? styles.leaderboardRowBronze
    : "";
  const displayName = entry.username.slice(0, 16);

  return (
    <motion.article
      className={`${styles.leaderboardRow} ${rankAccent} ${
        entry.isCurrentUser ? styles.leaderboardRowCurrentUser : ""
      } ${onClick ? styles.leaderboardRowClickable : ""}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.26,
        delay: Math.min((rank - 1) * 0.035, 0.18),
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <span className={styles.leaderboardRowRank}>#{rank}</span>
      <div className={styles.leaderboardAvatarWrap}>
        <WhelmProfileAvatar
          tierColor={bandana.tier?.color}
          size="mini"
          isPro={entry.isProStyle}
          photoUrl={entry.avatarUrl}
        />
      </div>
      <div className={styles.leaderboardRowIdentity}>
        <strong className={styles.leaderboardRowUsername}>{displayName}</strong>
        <div className={styles.leaderboardRowMeta}>
          {bandana.tier ? (
            <img
              src={bandanaCursorAssetPath(bandana.tier.color, 128)}
              alt={bandana.tier.label}
              className={styles.leaderboardBandanaImg}
              style={{ filter: `drop-shadow(0 0 5px ${bandanaImageGlow(bandana.tier.color)})` }}
            />
          ) : (
            <span className={styles.leaderboardBandanaChip}>None</span>
          )}
          {entry.isCurrentUser ? <span className={styles.leaderboardYouBadge}>You</span> : null}
          <LeaderboardMovementIndicator movement={movement} tab={tab} />
        </div>
      </div>
      <div className={styles.leaderboardRowStats}>
        {tab === "xp" ? (
          <>
            <span className={styles.leaderboardRowXp}>{formatLeaderboardXp(entry.totalXp)}</span>
            <span className={styles.leaderboardRowStreak}>{entry.currentStreak}d</span>
          </>
        ) : (
          <span className={styles.leaderboardRowStreakStat}>
            <span>{entry.currentStreak} days</span>
            {bandana.tier ? (
              <img
                src={bandanaCursorAssetPath(bandana.tier.color, 128)}
                alt={bandana.tier.label}
                className={styles.leaderboardBandanaImgStat}
                style={{ filter: `drop-shadow(0 0 4px ${bandanaImageGlow(bandana.tier.color)})` }}
              />
            ) : null}
          </span>
        )}
      </div>
    </motion.article>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export type WhelmboardTabProps = {
  sectionRef?: Ref<HTMLElement>;
  primaryRef?: Ref<HTMLElement>;
  // Metric tab
  leaderboardMetricTab: LeaderboardMetricTab;
  onSetMetricTab: (tab: LeaderboardMetricTab) => void;
  // Current user rank info
  leaderboardCurrentUserRank: number | false | undefined;
  leaderboardCurrentUserMovement: LeaderboardMovement;
  // Board data
  leaderboardSource: string;
  leaderboardTotalEntries: number;
  leaderboardRows: LeaderboardRowData[];
  leaderboardAroundRows: LeaderboardRowData[];
  leaderboardBandanaHolders: LeaderboardBandanaHolder[];
  leaderboardError: string;
  leaderboardLoading: boolean;
  leaderboardHasEntries: boolean;
  leaderboardHasMore: boolean;
  leaderboardIsLive: boolean;
  seenChallengerIds: Set<string>;
  onSelectProfile: (row: { entry: LeaderboardEntry; rank: number }) => void;
  onLoadMore: () => void;
  // Friends tab props
  friends: FriendWithXp[];
  incomingRequests: FriendRequestDoc[];
  outgoingRequests: OutgoingFriendRequestDoc[];
  searchResults: FriendProfile[];
  searchQuery: string;
  searchLoading: boolean;
  friendsLoading: boolean;
  friendsError: string;
  sentRequestUids: Set<string>;
  alreadyFriendUids: Set<string>;
  incomingRequestUids: Set<string>;
  onFriendSearch: (q: string) => void;
  onSendFriendRequest: (target: FriendProfile) => void;
  onAcceptFriendRequest: (req: FriendRequestDoc) => void;
  onDeclineFriendRequest: (req: FriendRequestDoc) => void;
  onRemoveFriend: (friendUid: string) => void;
  onNudgeFriend: (friendUid: string) => void;
  canNudgeFriend: (friendUid: string) => boolean;
  nudgeAvailableInMinutes: (friendUid: string) => number;
};

const SURFACE_TABS: Array<{ id: WhelmboardSurfaceTab; label: string; iconSrc: string; iconAlt: string }> = [
  { id: "global", label: "Global", iconSrc: "/whelmboard-icons/globe-icon.png", iconAlt: "Global" },
  { id: "friends", label: "Friends", iconSrc: "/whelmboard-icons/friends-icon.png", iconAlt: "Friends" },
  { id: "bandana", label: "Bandana Tiers", iconSrc: "/streak/cursor/bandana-white-128.png", iconAlt: "Bandana tiers" },
];

export default function WhelmboardTab({
  sectionRef,
  primaryRef,
  leaderboardMetricTab,
  onSetMetricTab,
  leaderboardCurrentUserRank,
  leaderboardCurrentUserMovement,
  leaderboardSource,
  leaderboardTotalEntries,
  leaderboardRows,
  leaderboardAroundRows,
  leaderboardBandanaHolders,
  leaderboardError,
  leaderboardLoading,
  leaderboardHasEntries,
  leaderboardHasMore,
  leaderboardIsLive,
  seenChallengerIds,
  onSelectProfile,
  onLoadMore,
  friends,
  incomingRequests,
  outgoingRequests,
  searchResults,
  searchQuery,
  searchLoading,
  friendsLoading,
  friendsError,
  sentRequestUids,
  alreadyFriendUids,
  incomingRequestUids,
  onFriendSearch,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onRemoveFriend,
  onNudgeFriend,
  canNudgeFriend,
  nudgeAvailableInMinutes,
}: WhelmboardTabProps) {
  const [surfaceTab, setSurfaceTab] = useState<WhelmboardSurfaceTab>("global");

  return (
    <AnimatedTabSection
      className={`${styles.leaderboardShell} ${styles.wbThemeShell}`}
      sectionRef={sectionRef}
    >
      {/* Compact header */}
      <div className={styles.wbHeader} ref={primaryRef as React.RefObject<HTMLDivElement>}>
        <div>
          <p className={sharedStyles.sectionLabel}>Whelmboard</p>
          <h2 className={styles.wbTitle}>
            {surfaceTab === "global"
              ? "Global Whelm rank"
              : surfaceTab === "friends"
                ? "Friends"
                : "Bandana Tiers"}
          </h2>
        </div>
        {surfaceTab === "global" && (
          <div className={styles.wbHeaderRight}>
            {leaderboardIsLive && (
              <div className={styles.wbLiveDot} title="Live updates" aria-label="Live">
                <span className={styles.wbLivePulse} aria-hidden="true" />
                <span className={styles.wbLiveLabel}>Live</span>
              </div>
            )}
            <div className={styles.wbRankBadge}>
              <span>{leaderboardMetricTab === "xp" ? "XP" : "Streak"}</span>
              <strong>#{leaderboardCurrentUserRank || "--"}</strong>
            </div>
            <LeaderboardMovementIndicator
              movement={leaderboardCurrentUserMovement}
              tab={leaderboardMetricTab}
            />
          </div>
        )}
        {surfaceTab === "friends" && incomingRequests.length > 0 && (
          <div className={styles.wbHeaderRight}>
            <span className={styles.wbFriendRequestBadge}>
              <img
                src="/whelmboard-icons/friends-icon.png"
                alt=""
                aria-hidden="true"
                className={styles.wbFriendRequestBadgeIcon}
              />
              {incomingRequests.length} pending
            </span>
          </div>
        )}
      </div>

      {/* Surface tab nav: Global | Friends | Bandana Tiers */}
      <div className={styles.wbSurfaceTabs} role="tablist" aria-label="Whelmboard surfaces">
        {SURFACE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={surfaceTab === tab.id}
            className={`${styles.wbSurfaceTab} ${
              surfaceTab === tab.id ? styles.wbSurfaceTabActive : ""
            }`}
            onClick={() => setSurfaceTab(tab.id)}
          >
            <span className={styles.wbSurfaceTabInner}>
              <img src={tab.iconSrc} alt="" aria-hidden="true" className={styles.wbSurfaceTabIcon} />
              <span>{tab.label}</span>
            </span>
          </button>
        ))}
      </div>

      {/* ── Global surface ── */}
      {surfaceTab === "global" && (
        <>
          {/* XP / Streak metric toggle */}
          <div className={styles.leaderboardToggle} role="tablist" aria-label="Leaderboard metric">
            <button
              type="button"
              role="tab"
              aria-selected={leaderboardMetricTab === "xp"}
              className={`${styles.leaderboardToggleButton} ${
                leaderboardMetricTab === "xp" ? styles.leaderboardToggleButtonActive : ""
              }`}
              onClick={() => {
                if (leaderboardMetricTab === "xp") return;
                onSetMetricTab("xp");
              }}
            >
              XP
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={leaderboardMetricTab === "streak"}
              className={`${styles.leaderboardToggleButton} ${
                leaderboardMetricTab === "streak" ? styles.leaderboardToggleButtonActive : ""
              }`}
              onClick={() => {
                if (leaderboardMetricTab === "streak") return;
                onSetMetricTab("streak");
              }}
            >
              Streak
            </button>
          </div>

          {/* Leaderboard list */}
          <div className={styles.wbLeaderboardPane}>
            <div className={styles.wbPaneHeader}>
              <span className={sharedStyles.sectionLabel}>Standings</span>
              <span className={styles.leaderboardCountPill}>
                {(leaderboardSource === "snapshot" ? leaderboardTotalEntries : leaderboardRows.length)} players
              </span>
            </div>

            {leaderboardError ? (
              <p className={sharedStyles.analyticsEmptyState}>{leaderboardError}</p>
            ) : null}

            {leaderboardLoading ? (
              <div className={styles.leaderboardLoadingList}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className={styles.leaderboardLoadingRow} aria-hidden="true" />
                ))}
              </div>
            ) : !leaderboardHasEntries ? (
              <div className={styles.leaderboardEmptyState}>
                <strong>No Whelmboard data yet</strong>
                <p className={sharedStyles.accountMeta}>
                  Once competitive data is available, the global Whelmboard will populate here.
                </p>
              </div>
            ) : (
              <div className={styles.leaderboardBoardList}>
                {leaderboardRows.map((row) => (
                  <LeaderboardRow
                    key={row.entry.id}
                    entry={row.entry}
                    rank={row.rank}
                    movement={
                      row.movement.direction === "new" && seenChallengerIds.has(row.entry.id)
                        ? { ...row.movement, direction: "same" as const }
                        : row.movement
                    }
                    tab={leaderboardMetricTab}
                    onClick={() => onSelectProfile({ entry: row.entry, rank: row.rank })}
                  />
                ))}
              </div>
            )}

            {!leaderboardLoading && leaderboardHasMore ? (
              <div className={styles.leaderboardFooter}>
                <button
                  type="button"
                  className={sharedStyles.secondaryPlanButton}
                  onClick={onLoadMore}
                >
                  Load more
                </button>
              </div>
            ) : null}

            {!leaderboardLoading && leaderboardAroundRows.length > 0 ? (
              <div className={styles.wbAroundSection}>
                <div className={styles.wbPaneHeader}>
                  <span className={sharedStyles.sectionLabel}>Around you</span>
                </div>
                <div className={styles.leaderboardBoardList}>
                  {leaderboardAroundRows.map((row) => (
                    <LeaderboardRow
                      key={`around-${row.entry.id}-${row.rank}`}
                      entry={row.entry}
                      rank={row.rank}
                      movement={
                        row.movement.direction === "new" && seenChallengerIds.has(row.entry.id)
                          ? { ...row.movement, direction: "same" as const }
                          : row.movement
                      }
                      tab={leaderboardMetricTab}
                      onClick={() => onSelectProfile({ entry: row.entry, rank: row.rank })}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}

      {/* ── Friends surface ── */}
      {surfaceTab === "friends" && (
        <FriendsTab
          friends={friends}
          incomingRequests={incomingRequests}
          outgoingRequests={outgoingRequests}
          searchResults={searchResults}
          searchQuery={searchQuery}
          searchLoading={searchLoading}
          friendsLoading={friendsLoading}
          error={friendsError}
          sentRequestUids={sentRequestUids}
          alreadyFriendUids={alreadyFriendUids}
          incomingRequestUids={incomingRequestUids}
          onSearch={onFriendSearch}
          onSendRequest={onSendFriendRequest}
          onAccept={onAcceptFriendRequest}
          onDecline={onDeclineFriendRequest}
          onRemoveFriend={onRemoveFriend}
          onNudge={onNudgeFriend}
          canNudgeFriend={canNudgeFriend}
          nudgeAvailableInMinutes={nudgeAvailableInMinutes}
        />
      )}

      {/* ── Bandana Tiers surface ── */}
      {surfaceTab === "bandana" && (
        <div className={styles.wbBandanaPane}>
          <div className={styles.wbPaneHeader}>
            <span className={sharedStyles.sectionLabel}>Bandana tiers</span>
          </div>
          <div className={styles.leaderboardBandanaList}>
            {leaderboardBandanaHolders.map((holder) => (
              <div key={holder.color} className={styles.leaderboardBandanaRow}>
                <img
                  src={bandanaCursorAssetPath(holder.color, 128)}
                  alt={holder.label}
                  className={styles.leaderboardBandanaTierImg}
                  style={{ filter: `drop-shadow(0 0 6px ${bandanaImageGlow(holder.color)})` }}
                />
                <span className={styles.leaderboardBandanaName}>{holder.label}</span>
                <span className={styles.leaderboardBandanaHolder}>{holder.entry?.username ?? "—"}</span>
                <span className={styles.leaderboardBandanaXp}>
                  {holder.entry ? formatLeaderboardXp(holder.entry.totalXp) : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AnimatedTabSection>
  );
}
