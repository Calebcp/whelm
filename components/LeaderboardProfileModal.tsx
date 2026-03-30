"use client";

import sharedStyles from "@/app/page.module.css";
import WhelmProfileAvatar from "@/components/WhelmProfileAvatar";
import styles from "@/components/WhelmboardTab.module.css";
import type { FriendProfile } from "@/hooks/useFriends";
import { getStreakBandanaTier } from "@/lib/streak-bandanas";
import { getStreakTierColorTheme } from "@/lib/xp-utils";

type LeaderboardEntry = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  isProStyle?: boolean;
  isCurrentUser?: boolean;
  currentStreak: number;
  totalXp: number;
  level: number;
  bestStreak?: number | null;
  totalFocusHours?: number | null;
  createdAtISO: string;
};

export default function LeaderboardProfileModal({
  selected,
  onClose,
  alreadyFriendUids,
  sentRequestUids,
  incomingRequestUids,
  onSendFriendRequest,
}: {
  selected: { entry: LeaderboardEntry; rank: number } | null;
  onClose: () => void;
  alreadyFriendUids: Set<string>;
  sentRequestUids: Set<string>;
  incomingRequestUids: Set<string>;
  onSendFriendRequest: (target: FriendProfile) => void;
}) {
  if (!selected) return null;

  const { entry, rank } = selected;
  const tier = getStreakBandanaTier(entry.currentStreak);
  const theme = getStreakTierColorTheme(tier?.color);
  const joinDate = (() => {
    try {
      return new Date(entry.createdAtISO).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return null;
    }
  })();
  const canFriend = !entry.isCurrentUser && Boolean(entry.id);
  const alreadyFriend = canFriend && alreadyFriendUids.has(entry.id);
  const hasIncomingRequest = canFriend && incomingRequestUids.has(entry.id);
  const hasSentRequest = canFriend && sentRequestUids.has(entry.id);
  const profileTarget: FriendProfile = {
    userId: entry.id,
    username: entry.username,
    totalXp: entry.totalXp,
    currentStreak: entry.currentStreak,
    weeklyXp: 0,
  };

  return (
    <div className={sharedStyles.feedbackOverlay} onClick={onClose}>
      <div className={styles.lbProfileSheet} onClick={(event) => event.stopPropagation()}>
        <div className={styles.lbProfileHeader}>
          <span className={sharedStyles.sectionLabel}>Player Profile</span>
          <button type="button" className={sharedStyles.feedbackClose} onClick={onClose} aria-label="Close profile">
            ✕
          </button>
        </div>

        <div className={styles.lbProfileHero}>
          <WhelmProfileAvatar
            tierColor={tier?.color}
            size="compact"
            isPro={entry.isProStyle}
            photoUrl={entry.avatarUrl}
          />
          <div className={styles.lbProfileHeroMeta}>
            <div className={styles.lbProfileNameRow}>
              <strong className={styles.lbProfileUsername}>{entry.username.slice(0, 16)}</strong>
              {entry.isCurrentUser ? <span className={styles.leaderboardYouBadge}>You</span> : null}
            </div>
            <p className={styles.lbProfileRank}>Rank #{rank}</p>
            {tier ? (
              <span
                className={styles.lbProfileBandanaBadge}
                style={{
                  background: theme.shell,
                  color: theme.accent,
                  borderColor: theme.accent,
                }}
              >
                {tier.label}
              </span>
            ) : (
              <span className={styles.lbProfileBandanaBadge} style={{ opacity: 0.5 }}>
                No bandana yet
              </span>
            )}
          </div>
        </div>

        <div className={styles.lbProfileStatsGrid}>
          <div className={styles.lbProfileStat}>
            <span className={styles.lbProfileStatValue}>{entry.totalXp.toLocaleString()}</span>
            <span className={styles.lbProfileStatLabel}>Total XP</span>
          </div>
          <div className={styles.lbProfileStat}>
            <span className={styles.lbProfileStatValue}>Lv {entry.level}</span>
            <span className={styles.lbProfileStatLabel}>Level</span>
          </div>
          <div className={styles.lbProfileStat}>
            <span className={styles.lbProfileStatValue}>{entry.currentStreak}</span>
            <span className={styles.lbProfileStatLabel}>Streak days</span>
          </div>
          {(entry.bestStreak ?? 0) > 0 ? (
            <div className={styles.lbProfileStat}>
              <span className={styles.lbProfileStatValue}>{entry.bestStreak}</span>
              <span className={styles.lbProfileStatLabel}>Best streak</span>
            </div>
          ) : null}
          {(entry.totalFocusHours ?? 0) > 0 ? (
            <div className={styles.lbProfileStat}>
              <span className={styles.lbProfileStatValue}>{entry.totalFocusHours}h</span>
              <span className={styles.lbProfileStatLabel}>Focus hours</span>
            </div>
          ) : null}
        </div>

        <div className={styles.lbProfileActions}>
          {entry.isCurrentUser ? (
            <span className={styles.lbProfileStaticChip}>You</span>
          ) : alreadyFriend ? (
            <span className={styles.lbProfileStaticChip}>Friends</span>
          ) : hasSentRequest ? (
            <span className={styles.lbProfileStaticChip}>Sent</span>
          ) : hasIncomingRequest ? (
            <button
              type="button"
              className={styles.lbProfilePrimaryAction}
              onClick={() => onSendFriendRequest(profileTarget)}
            >
              Accept friend request
            </button>
          ) : (
            <button
              type="button"
              className={styles.lbProfilePrimaryAction}
              onClick={() => onSendFriendRequest(profileTarget)}
            >
              Add friend
            </button>
          )}
        </div>

        {joinDate ? <p className={styles.lbProfileJoinDate}>Member since {joinDate}</p> : null}
      </div>
    </div>
  );
}
