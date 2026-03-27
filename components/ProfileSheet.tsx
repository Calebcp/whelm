"use client";

import styles from "@/app/page.module.css";
import WhelmProfileAvatar from "@/components/WhelmProfileAvatar";

type ProfileTierTheme = {
  title: string;
  imagePath: string;
};

type StreakBandanaTier = {
  color: string;
  label: string;
};

type PlannedBlockLike = {
  title: string;
  timeOfDay: string;
  durationMinutes: number;
};

type NextBandanaMilestone = {
  tier: {
    label: string;
    minDays: number;
  };
  remainingDays: number;
} | null;

export default function ProfileSheet({
  open,
  onClose,
  tierColor,
  isPro,
  photoUrl,
  profileDisplayName,
  profileTierTheme,
  streakBandanaTier,
  nextPlannedBlock,
  normalizeTimeLabel,
  displayStreak,
  longestStreak,
  lifetimeFocusMinutes,
  sessionsCount,
  nextBandanaMilestone,
  onOpenStreaks,
  onOpenMoreTabs,
}: {
  open: boolean;
  onClose: () => void;
  tierColor: string | null | undefined;
  isPro: boolean;
  photoUrl: string | null | undefined;
  profileDisplayName: string;
  profileTierTheme: ProfileTierTheme;
  streakBandanaTier: StreakBandanaTier | null;
  nextPlannedBlock: PlannedBlockLike | null;
  normalizeTimeLabel: (raw: string) => string;
  displayStreak: number;
  longestStreak: number;
  lifetimeFocusMinutes: number;
  sessionsCount: number;
  nextBandanaMilestone: NextBandanaMilestone;
  onOpenStreaks: () => void;
  onOpenMoreTabs: () => void;
}) {
  if (!open) return null;

  return (
    <div className={styles.feedbackOverlay} onClick={onClose}>
      <div className={styles.profileSheet} onClick={(event) => event.stopPropagation()}>
        <div className={styles.feedbackHeader}>
          <h2 className={styles.feedbackTitle}>Profile</h2>
          <button type="button" className={styles.feedbackClose} onClick={onClose}>
            Close
          </button>
        </div>

        <article className={styles.profileHero}>
          <WhelmProfileAvatar tierColor={tierColor} size="hero" isPro={isPro} photoUrl={photoUrl} />
          <div className={styles.profileHeroCopy}>
            <p className={styles.sectionLabel}>Whelm Identity</p>
            <h3 className={styles.profileHeroTitle}>{profileDisplayName}</h3>
            <p className={styles.accountMeta}>
              {profileTierTheme.title} · {streakBandanaTier?.label ?? "No bandana yet"}
            </p>
          </div>
        </article>

        <article className={styles.profileCommandCard}>
          <span>Current directive</span>
          <strong>{nextPlannedBlock?.title ?? "No active block queued"}</strong>
          <small>
            {nextPlannedBlock
              ? `${normalizeTimeLabel(nextPlannedBlock.timeOfDay)} · ${nextPlannedBlock.durationMinutes}m`
              : "Open Schedule or Today and place the next deliberate move."}
          </small>
        </article>

        <div className={styles.profileStatsGrid}>
          <article className={styles.profileStatCard}>
            <span>Current streak</span>
            <strong>{displayStreak}d</strong>
          </article>
          <article className={styles.profileStatCard}>
            <span>Longest streak</span>
            <strong>{longestStreak}d</strong>
          </article>
          <article className={styles.profileStatCard}>
            <span>Lifetime focus</span>
            <strong>{lifetimeFocusMinutes}m</strong>
          </article>
          <article className={styles.profileStatCard}>
            <span>Total sessions</span>
            <strong>{sessionsCount}</strong>
          </article>
        </div>

        <article className={styles.profileProgressCard}>
          <p className={styles.sectionLabel}>Next ascent</p>
          <h3 className={styles.cardTitle}>
            {nextBandanaMilestone
              ? `${nextBandanaMilestone.tier.label} at ${nextBandanaMilestone.tier.minDays} days`
              : "White Bandana reached"}
          </h3>
          <p className={styles.accountMeta}>
            {nextBandanaMilestone
              ? `${nextBandanaMilestone.remainingDays} more day${
                  nextBandanaMilestone.remainingDays === 1 ? "" : "s"
                } to level up the profile.`
              : "Top tier achieved. Keep the run alive."}
          </p>
        </article>

        <div className={styles.noteFooterActions}>
          <button type="button" className={styles.reportButton} onClick={onOpenStreaks}>
            Open Streaks
          </button>
          <button type="button" className={styles.secondaryPlanButton} onClick={onOpenMoreTabs}>
            More tabs
          </button>
        </div>
      </div>
    </div>
  );
}
