export type StreakIdentityPresentation = {
  tierLabel: string;
  profileTitle: string;
};

export type StreakProfilePresentation = {
  currentStreakLabel: string;
  longestStreakLabel: string;
  nextAscentTitle: string;
  nextAscentBody: string;
  identityLine: string;
};

export type StreakTodayPresentation = {
  protectionTitle: string;
  protectionBody: string;
  protectionStatusLabel: string;
  rulesBlocksLabel: string;
  rulesMinutesLabel: string;
  rulesWordsLabel: string;
};

export function buildStreakProfilePresentation({
  profileTitle,
  streakBandanaLabel,
  displayStreak,
  longestStreak,
  nextBandanaMilestone,
}: {
  profileTitle: string;
  streakBandanaLabel: string | null | undefined;
  displayStreak: number;
  longestStreak: number;
  nextBandanaMilestone:
    | {
        tier: {
          label: string;
          minDays: number;
        };
        remainingDays: number;
      }
    | null;
}) {
  return {
    currentStreakLabel: `${displayStreak}d`,
    longestStreakLabel: `${longestStreak}d`,
    nextAscentTitle: nextBandanaMilestone
      ? `${nextBandanaMilestone.tier.label} at ${nextBandanaMilestone.tier.minDays} days`
      : "White Bandana reached",
    nextAscentBody: nextBandanaMilestone
      ? `${nextBandanaMilestone.remainingDays} more day${
          nextBandanaMilestone.remainingDays === 1 ? "" : "s"
        } to level up the profile.`
      : "Top tier achieved. Keep the run alive.",
    identityLine: `${profileTitle} · ${streakBandanaLabel ?? "No bandana yet"}`,
  };
}

export function buildStreakTodayPresentation({
  streakProtectedToday,
  streakStatusLine,
  streakProgressBlocksLabel,
  streakProgressMinutesLabel,
  streakProgressWordsLabel,
}: {
  streakProtectedToday: boolean;
  streakStatusLine: string;
  streakProgressBlocksLabel: string;
  streakProgressMinutesLabel: string;
  streakProgressWordsLabel: string;
}) {
  return {
    protectionTitle: streakProtectedToday ? "Today secured" : "Today still open",
    protectionBody: streakProtectedToday
      ? streakStatusLine
      : `${streakProgressBlocksLabel} + (${streakProgressMinutesLabel} or ${streakProgressWordsLabel})`,
    protectionStatusLabel: streakProtectedToday ? "Protected" : "Open",
    rulesBlocksLabel: streakProgressBlocksLabel,
    rulesMinutesLabel: streakProgressMinutesLabel,
    rulesWordsLabel: streakProgressWordsLabel,
  };
}
