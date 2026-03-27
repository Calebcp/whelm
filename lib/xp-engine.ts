import { computeStreakEndingAtDateKey } from "@/lib/streak";
import { getStreakBandanaTier, type StreakBandanaTier } from "@/lib/streak-bandanas";
import type { AppTab } from "@/lib/app-tabs";

// ── Constants ────────────────────────────────────────────────────────────────

export const STREAK_RULE_V2_START_DATE = "2026-03-22";
export const XP_DAILY_TARGET = 120;
export const XP_DAILY_CAP = 150;
export const XP_FOCUS_DAILY_CAP = 90;
export const XP_COMPLETED_BLOCK_XP = 25;
export const XP_COMPLETED_BLOCK_DAILY_CAP = 50;
export const XP_STREAK_DAILY_BONUS = 10;
export const XP_COMBO_BONUS = 15;
export const XP_DEEP_WORK_BONUS = 25;
export const XP_WRITING_ENTRY_THRESHOLD = 33;
export const XP_WRITING_ENTRY_BONUS = 10;
export const XP_WRITING_BONUS_THRESHOLD = 100;
export const XP_WRITING_BONUS_XP = 10;
export const XP_WRITING_DAILY_CAP = 20;

// ── Types ────────────────────────────────────────────────────────────────────

export type DayXpSummary = {
  dateKey: string;
  streakLength: number;
  multiplier: number;
  baseActionXp: number;
  completedBlocksXp: number;
  focusXp: number;
  writingXp: number;
  multipliedBaseXp: number;
  streakDailyXp: number;
  streakMilestoneXp: number;
  deepWorkXp: number;
  comboXp: number;
  totalXp: number;
};

export type LifetimeXpSummary = {
  totalXp: number;
  todayXp: number;
  todayTarget: number;
  dailyCap: number;
  currentLevel: number;
  currentLevelFloorXp: number;
  nextLevelXp: number;
  progressInLevel: number;
  progressToNextLevel: number;
};

export type SessionRewardState = {
  id: string;
  minutesSpent: number;
  xpGained: number;
  todayXp: number;
  streakAfter: number;
  streakDelta: number;
  leveledUp: boolean;
  tierUnlocked: StreakBandanaTier | null;
};

export type StreakCelebrationState = {
  id: string;
  streakAfter: number;
  todayLabel: string;
  tier: StreakBandanaTier | null;
};

export type StreakNudgeState = {
  id: string;
  title: string;
  body: string;
  actionLabel: string;
  actionTab: AppTab;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getXpMultiplierForStreak(streakLength: number) {
  switch (getStreakBandanaTier(streakLength)?.color) {
    case "white":
      return 2.4;
    case "black":
      return 2;
    case "blue":
      return 1.6;
    case "purple":
      return 1.35;
    case "green":
      return 1.2;
    case "red":
      return 1.1;
    case "yellow":
    default:
      return 1;
  }
}

export function getXpWritingBonus(wordCount: number) {
  if (wordCount >= XP_WRITING_BONUS_THRESHOLD) {
    return XP_WRITING_DAILY_CAP;
  }
  if (wordCount >= XP_WRITING_ENTRY_THRESHOLD) {
    return XP_WRITING_ENTRY_BONUS;
  }
  return 0;
}

export function doesDateQualifyForStreak({
  dateKey,
  focusMinutes,
  completedBlocks,
  noteWords,
  todayKey,
  protectedDateKeys,
}: {
  dateKey: string;
  focusMinutes: number;
  completedBlocks: number;
  noteWords: number;
  todayKey: string;
  protectedDateKeys: string[];
}) {
  if (protectedDateKeys.includes(dateKey)) return true;
  if (dateKey < STREAK_RULE_V2_START_DATE) return focusMinutes > 0;
  if (dateKey > todayKey) return false;
  return completedBlocks >= 1 && (focusMinutes >= 30 || noteWords >= 33);
}

export function getXpMilestoneBonus(streakLength: number) {
  if (streakLength === 100) return 350;
  if (streakLength === 30) return 120;
  if (streakLength === 7) return 40;
  return 0;
}

export function getXpRequiredToReachLevel(level: number) {
  if (level <= 1) return 0;
  let total = 0;
  for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
    total += Math.round(85 * currentLevel ** 1.45);
  }
  return total;
}

export function getLifetimeXpSummary(totalXp: number, todayXp: number): LifetimeXpSummary {
  let currentLevel = 1;
  let nextLevelXp = getXpRequiredToReachLevel(2);

  while (totalXp >= nextLevelXp) {
    currentLevel += 1;
    nextLevelXp = getXpRequiredToReachLevel(currentLevel + 1);
  }

  const currentLevelFloorXp = getXpRequiredToReachLevel(currentLevel);
  const progressInLevel = Math.max(0, totalXp - currentLevelFloorXp);
  const levelRange = Math.max(1, nextLevelXp - currentLevelFloorXp);

  return {
    totalXp,
    todayXp,
    todayTarget: XP_DAILY_TARGET,
    dailyCap: XP_DAILY_CAP,
    currentLevel,
    currentLevelFloorXp,
    nextLevelXp,
    progressInLevel,
    progressToNextLevel: Math.min(1, progressInLevel / levelRange),
  };
}

export function formatXpMultiplier(multiplier: number) {
  return `x${multiplier.toFixed(multiplier % 1 === 0 ? 1 : 2).replace(/\.?0+$/, "")}`;
}

export function buildDayXpSummaryForDate({
  dateKey,
  sessionMinutesByDay,
  completedBlocksByDay,
  noteWordsByDay,
  streakQualifiedDateKeys,
}: {
  dateKey: string;
  sessionMinutesByDay: Map<string, number>;
  completedBlocksByDay: Map<string, number>;
  noteWordsByDay: Map<string, number>;
  streakQualifiedDateKeys: string[];
}): DayXpSummary {
  const focusMinutes = sessionMinutesByDay.get(dateKey) ?? 0;
  const completedBlocks = completedBlocksByDay.get(dateKey) ?? 0;
  const noteWords = noteWordsByDay.get(dateKey) ?? 0;
  const streakLength = computeStreakEndingAtDateKey([], dateKey, streakQualifiedDateKeys);
  const multiplier = getXpMultiplierForStreak(streakLength);
  const completedBlocksXp = Math.min(XP_COMPLETED_BLOCK_DAILY_CAP, completedBlocks * XP_COMPLETED_BLOCK_XP);
  const focusXp = Math.min(XP_FOCUS_DAILY_CAP, focusMinutes);
  const writingXp = getXpWritingBonus(noteWords);
  const baseActionXp = completedBlocksXp + focusXp + writingXp;
  const multipliedBaseXp = Math.round(baseActionXp * multiplier);
  const streakDailyXp = streakLength > 0 ? XP_STREAK_DAILY_BONUS : 0;
  const streakMilestoneXp = streakLength > 0 ? getXpMilestoneBonus(streakLength) : 0;
  const deepWorkXp = focusMinutes >= 90 ? XP_DEEP_WORK_BONUS : 0;
  const comboXp =
    completedBlocks >= 1 && (focusMinutes >= 30 || noteWords >= XP_WRITING_ENTRY_THRESHOLD)
      ? XP_COMBO_BONUS
      : 0;

  return {
    dateKey,
    streakLength,
    multiplier,
    baseActionXp,
    completedBlocksXp,
    focusXp,
    writingXp,
    multipliedBaseXp,
    streakDailyXp,
    streakMilestoneXp,
    deepWorkXp,
    comboXp,
    totalXp: Math.min(
      XP_DAILY_CAP,
      multipliedBaseXp + streakDailyXp + streakMilestoneXp + deepWorkXp + comboXp,
    ),
  };
}
