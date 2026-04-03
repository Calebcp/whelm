import { addDays, dayKeyLocal, monthKeyLocal, startOfDayLocal } from "@/lib/date-utils";
import { computeHistoricalStreaks, computeStreakEndingAtDateKey } from "@/lib/streak";
import { getStreakBandanaTier, STREAK_BANDANA_TIERS } from "@/lib/streak-bandanas";
import { STREAK_RULE_V2_START_DATE, getStreakTierColorTheme } from "@/lib/xp-utils";
import { getWhelmStreakSaveMonthlyLimit } from "@/lib/whelm-plans";
import type { LifetimeXpSummary } from "@/lib/xp-engine";
import type { AppTab } from "@/lib/app-tabs";

type SickDaySaveInput = {
  dateKey: string;
  claimedAtISO: string;
};

export type BandanaMilestone = {
  tier: (typeof STREAK_BANDANA_TIERS)[number];
  remainingDays: number;
  targetDate: Date;
};

export type StreakNudgeDraft = {
  title: string;
  body: string;
  actionLabel: string;
  actionTab: AppTab;
};

export function buildNextBandanaMilestone(streak: number, countsTodayIfEarnedNow = false): BandanaMilestone | null {
  const nextTier = STREAK_BANDANA_TIERS.find((tier) => streak < tier.minDays) ?? null;
  if (!nextTier) return null;

  const remainingDays = nextTier.minDays - streak;
  const daysUntilTarget = Math.max(0, remainingDays - (countsTodayIfEarnedNow ? 1 : 0));
  const targetDate = addDays(startOfDayLocal(new Date()), daysUntilTarget);

  return {
    tier: nextTier,
    remainingDays,
    targetDate,
  };
}

export function deriveStreakState({
  isPro,
  streak,
  streakQualifiedDateKeys,
  sessionMinutesByDay,
  noteWordsByDay,
  completedBlocksByDay,
  sickDaySaves,
  sickDaySaveDismissals,
  lifetimeXpSummary,
}: {
  isPro: boolean;
  streak: number;
  streakQualifiedDateKeys: string[];
  sessionMinutesByDay: ReadonlyMap<string, number>;
  noteWordsByDay: ReadonlyMap<string, number>;
  completedBlocksByDay: ReadonlyMap<string, number>;
  sickDaySaves: SickDaySaveInput[];
  sickDaySaveDismissals: string[];
  lifetimeXpSummary: LifetimeXpSummary;
}) {
  const historicalStreaksByDay = computeHistoricalStreaks([], streakQualifiedDateKeys);
  const todayKey = dayKeyLocal(new Date());
  const yesterdayKey = dayKeyLocal(addDays(startOfDayLocal(new Date()), -1));
  const dayBeforeYesterdayKey = dayKeyLocal(addDays(startOfDayLocal(new Date()), -2));
  const todayLabel = new Date().toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });

  const todayCompletedBlocksCount = completedBlocksByDay.get(todayKey) ?? 0;
  const todayFocusMinutes = sessionMinutesByDay.get(todayKey) ?? 0;
  const todayNoteWords = noteWordsByDay.get(todayKey) ?? 0;
  const todayMinutesProgress = Math.min(30, todayFocusMinutes);
  const todayWordsProgress = Math.min(33, todayNoteWords);
  const hasEarnedToday = streakQualifiedDateKeys.includes(todayKey);
  const yesterdaySave = sickDaySaves.find((save) => save.dateKey === yesterdayKey) ?? null;
  const rawYesterdayMissed = !streakQualifiedDateKeys.includes(yesterdayKey);
  const priorRunBeforeYesterday = computeStreakEndingAtDateKey(
    [],
    dayBeforeYesterdayKey,
    streakQualifiedDateKeys,
  );

  const streakSaveMonthlyLimit = getWhelmStreakSaveMonthlyLimit(isPro);
  const currentMonthKey = monthKeyLocal(new Date());
  const monthlyStreakSaveCount = sickDaySaves.filter(
    (save) => monthKeyLocal(save.claimedAtISO) === currentMonthKey,
  ).length;
  const streakSaveSlotsLeft = Math.max(0, streakSaveMonthlyLimit - monthlyStreakSaveCount);
  const monthlySaveLimitReached = monthlyStreakSaveCount >= streakSaveMonthlyLimit;
  const sickDaySaveEligible =
    rawYesterdayMissed &&
    priorRunBeforeYesterday > 0 &&
    !yesterdaySave &&
    !monthlySaveLimitReached &&
    !sickDaySaveDismissals.includes(yesterdayKey);

  const carriedRunThroughYesterday = computeStreakEndingAtDateKey(
    [],
    yesterdayKey,
    streakQualifiedDateKeys,
  );
  const displayStreak = hasEarnedToday ? streak : carriedRunThroughYesterday;
  const streakBandanaTier = getStreakBandanaTier(displayStreak);
  const xpTierTheme = getStreakTierColorTheme(streakBandanaTier?.color);
  const formattedLifetimeXp = lifetimeXpSummary.totalXp.toLocaleString();
  const formattedXpToNextLevel = Math.max(
    0,
    lifetimeXpSummary.nextLevelXp - lifetimeXpSummary.totalXp,
  ).toLocaleString();
  const nextBandanaMilestone = buildNextBandanaMilestone(displayStreak, !hasEarnedToday);
  const longestStreak = Math.max(0, ...Array.from(historicalStreaksByDay.values()));
  const streakMinutesLeft = Math.max(0, 30 - todayFocusMinutes);
  const streakWordsLeft = Math.max(0, 33 - todayNoteWords);
  const streakBlocksLeft = Math.max(0, 1 - todayCompletedBlocksCount);
  const streakEffortRequirementMet = todayFocusMinutes >= 30 || todayNoteWords >= 33;
  const streakRuleV2ActiveToday = todayKey >= STREAK_RULE_V2_START_DATE;
  const streakProtectedToday = hasEarnedToday;
  const streakProgressMinutesLabel = `${todayMinutesProgress}/30 focus minutes`;
  const streakProgressBlocksLabel = `${Math.min(todayCompletedBlocksCount, 1)}/1 completed block`;
  const streakProgressWordsLabel = `${todayWordsProgress}/33 note words`;
  const streakStatusLine = streakProtectedToday
    ? streakRuleV2ActiveToday
      ? `${todayLabel} is protected. The line holds.`
      : `${todayLabel} already counts toward your streak. The stricter rule starts on March 22.`
    : streakBlocksLeft > 0 && streakEffortRequirementMet
      ? `${todayLabel} is not protected yet. You met the focus or writing requirement. Complete 1 block to secure the streak.`
      : streakBlocksLeft === 0
        ? `${todayLabel} is not protected yet. Your block is done. Finish ${streakMinutesLeft} more focus minute${streakMinutesLeft === 1 ? "" : "s"} or write ${streakWordsLeft} more note word${streakWordsLeft === 1 ? "" : "s"}.`
        : `${todayLabel} is not protected yet. Complete 1 block and either reach 30 focus minutes or write 33 note words.`;

  const streakNudgeDraft: StreakNudgeDraft | null =
    streakProtectedToday || !streakRuleV2ActiveToday
      ? null
      : streakBlocksLeft > 0 && !streakEffortRequirementMet
        ? {
            title: "Protect today.",
            body: `You still need 1 completed block plus either ${streakMinutesLeft} more focus minute${
              streakMinutesLeft === 1 ? "" : "s"
            } or ${streakWordsLeft} more note word${streakWordsLeft === 1 ? "" : "s"}.`,
            actionLabel: "Open Schedule",
            actionTab: "calendar",
          }
        : streakBlocksLeft > 0
          ? {
              title: "Finish the block.",
              body: "You already earned the effort. One completed block locks today in.",
              actionLabel: "Finish A Block",
              actionTab: "calendar",
            }
          : streakMinutesLeft <= streakWordsLeft
            ? {
                title: "One session seals it.",
                body: `Your block is already done. Add ${streakMinutesLeft} more focus minute${
                  streakMinutesLeft === 1 ? "" : "s"
                } to secure the streak.`,
                actionLabel: "Open Timer",
                actionTab: "today",
              }
            : {
                title: "One note seals it.",
                body: `Your block is already done. Write ${streakWordsLeft} more note word${
                  streakWordsLeft === 1 ? "" : "s"
                } and today is secured.`,
                actionLabel: "Open Notes",
                actionTab: "notes",
              };

  const streakRuleSummaryLine = streakRuleV2ActiveToday
    ? "A streak day needs 1 completed block and either 30 focus minutes or 33 note words."
    : "Your previous streak days stay unchanged. The new stricter rule starts on March 22.";

  return {
    historicalStreaksByDay,
    todayKey,
    yesterdayKey,
    todayFocusMinutes,
    todayNoteWords,
    todayMinutesProgress,
    todayWordsProgress,
    hasEarnedToday,
    displayStreak,
    streakBandanaTier,
    xpTierTheme,
    monthlyStreakSaveCount,
    streakSaveMonthlyLimit,
    streakSaveSlotsLeft,
    rawYesterdayMissed,
    yesterdaySave,
    monthlySaveLimitReached,
    sickDaySaveEligible,
    formattedLifetimeXp,
    formattedXpToNextLevel,
    nextBandanaMilestone,
    longestStreak,
    streakRuleV2ActiveToday,
    streakProtectedToday,
    streakProgressMinutesLabel,
    streakProgressBlocksLabel,
    streakProgressWordsLabel,
    streakStatusLine,
    streakNudgeDraft,
    streakRuleSummaryLine,
  };
}
