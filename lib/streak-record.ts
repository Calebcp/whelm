import type { StreakLedgerEntry } from "@/lib/streak-ledger";
import { buildStreakProfilePresentation } from "@/lib/streak-presentation";
import type { WhelBandanaColor } from "@/lib/whelm-mascot";

type BandanaMilestone = {
  tier: {
    label: string;
    minDays: number;
  };
  remainingDays: number;
} | null;

export type ShellStreakSummaryBase = {
  isReady: boolean;
  visibleBandanaColor: WhelBandanaColor;
  streakBandanaLabel: string | null;
  displayStreak: number;
  longestStreak: number;
  nextBandanaMilestone: BandanaMilestone;
};

export type ShellStreakSummary = {
  isReady: boolean;
  tierColor: WhelBandanaColor | null;
  currentStreakLabel: string;
  longestStreakLabel: string;
  identityLine: string;
  nextAscentTitle: string;
  nextAscentBody: string;
};

export type ShellStreakRecord = {
  summary: ShellStreakSummary;
  dailyRecords: StreakLedgerEntry[];
};

export function buildShellStreakSummary({
  profileTitle,
  streak,
}: {
  profileTitle: string;
  streak: ShellStreakSummaryBase;
}): ShellStreakSummary {
  if (!streak.isReady) {
    return {
      isReady: false,
      tierColor: null,
      currentStreakLabel: "Syncing",
      longestStreakLabel: "Syncing",
      identityLine: "Rebuilding streak identity from synced history.",
      nextAscentTitle: "Syncing streak",
      nextAscentBody: "Whelm is reconciling the streak record before announcing a tier.",
    };
  }

  const profilePresentation = buildStreakProfilePresentation({
    profileTitle,
    streakBandanaLabel: streak.streakBandanaLabel,
    displayStreak: streak.displayStreak,
    longestStreak: streak.longestStreak,
    nextBandanaMilestone: streak.nextBandanaMilestone,
  });

  return {
    isReady: true,
    tierColor: streak.visibleBandanaColor,
    currentStreakLabel: profilePresentation.currentStreakLabel,
    longestStreakLabel: profilePresentation.longestStreakLabel,
    identityLine: profilePresentation.identityLine,
    nextAscentTitle: profilePresentation.nextAscentTitle,
    nextAscentBody: profilePresentation.nextAscentBody,
  };
}

export function buildShellStreakRecord({
  profileTitle,
  streak,
  dailyRecords,
}: {
  profileTitle: string;
  streak: ShellStreakSummaryBase;
  dailyRecords: StreakLedgerEntry[];
}): ShellStreakRecord {
  return {
    summary: buildShellStreakSummary({ profileTitle, streak }),
    dailyRecords,
  };
}
