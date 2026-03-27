"use client";

import sharedStyles from "@/app/page.module.css";
import WhelmProfileAvatar from "@/components/WhelmProfileAvatar";
import styles from "@/components/WhelmboardTab.module.css";
import { getStreakBandanaTier } from "@/lib/streak-bandanas";
import { getStreakTierColorTheme } from "@/lib/xp-utils";

type LeaderboardEntry = {
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
}: {
  selected: { entry: LeaderboardEntry; rank: number } | null;
  onClose: () => void;
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

  return (
    <div className={styles.feedbackOverlay} onClick={onClose}>
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

        {joinDate ? <p className={styles.lbProfileJoinDate}>Member since {joinDate}</p> : null}
      </div>
    </div>
  );
}
