/**
 * XP computation utilities — matches the constants and logic in page.tsx exactly.
 * Do NOT change these values without also updating page.tsx.
 */

import { computeStreakEndingAtDateKey } from "@/lib/streak";
import { getStreakBandanaTier } from "@/lib/streak-bandanas";

// ── Constants ──────────────────────────────────────────────────────────────────
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
export const XP_WRITING_DAILY_CAP = 20;

export const STREAK_RULE_V2_START_DATE = "2026-03-22";
export const STREAK_SAVE_MONTHLY_LIMIT = 5;

// ── Types ──────────────────────────────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────────────────
export function getXpMultiplierForStreak(streakLength: number): number {
  switch (getStreakBandanaTier(streakLength)?.color) {
    case "white": return 2.4;
    case "black": return 2;
    case "blue":  return 1.6;
    case "purple": return 1.35;
    case "green": return 1.2;
    case "red":   return 1.1;
    case "yellow":
    default:      return 1;
  }
}

export function getXpWritingBonus(wordCount: number): number {
  if (wordCount >= XP_WRITING_BONUS_THRESHOLD) return XP_WRITING_DAILY_CAP;
  if (wordCount >= XP_WRITING_ENTRY_THRESHOLD) return XP_WRITING_ENTRY_BONUS;
  return 0;
}

export function getXpMilestoneBonus(streakLength: number): number {
  if (streakLength === 100) return 350;
  if (streakLength === 30)  return 120;
  if (streakLength === 7)   return 40;
  return 0;
}

export function getXpRequiredToReachLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += Math.round(85 * l ** 1.45);
  }
  return total;
}

export function buildDayXpSummary({
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
    totalXp: Math.min(XP_DAILY_CAP, multipliedBaseXp + streakDailyXp + streakMilestoneXp + deepWorkXp + comboXp),
  };
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
    todayTarget: 120,
    dailyCap: XP_DAILY_CAP,
    currentLevel,
    currentLevelFloorXp,
    nextLevelXp,
    progressInLevel,
    progressToNextLevel: Math.min(1, progressInLevel / levelRange),
  };
}

export type StreakTierColorTheme = {
  accent: string;
  accentStrong: string;
  accentDeep: string;
  accentGlow: string;
  shell: string;
  textStrong: string;
  textSoft: string;
};

export function getStreakTierColorTheme(tierColor: string | null | undefined): StreakTierColorTheme {
  switch (tierColor) {
    case "white":
      return { accent: "#f6fbff", accentStrong: "#dbeafe", accentDeep: "#93c5fd", accentGlow: "rgba(255, 255, 255, 0.34)", shell: "rgba(218, 233, 255, 0.18)", textStrong: "#08101e", textSoft: "rgba(11, 24, 46, 0.76)" };
    case "black":
      return { accent: "#8f9fc7", accentStrong: "#56698d", accentDeep: "#293750", accentGlow: "rgba(142, 163, 207, 0.28)", shell: "rgba(62, 79, 112, 0.24)", textStrong: "#f5f8ff", textSoft: "rgba(227, 235, 255, 0.8)" };
    case "blue":
      return { accent: "#59c7ff", accentStrong: "#2f86ff", accentDeep: "#143d9a", accentGlow: "rgba(84, 173, 255, 0.34)", shell: "rgba(48, 106, 212, 0.24)", textStrong: "#f5fbff", textSoft: "rgba(222, 241, 255, 0.86)" };
    case "purple":
      return { accent: "#bf86ff", accentStrong: "#8a4dff", accentDeep: "#4a2398", accentGlow: "rgba(174, 98, 255, 0.34)", shell: "rgba(104, 55, 177, 0.25)", textStrong: "#fbf8ff", textSoft: "rgba(241, 231, 255, 0.86)" };
    case "green":
      return { accent: "#59e07f", accentStrong: "#1fb850", accentDeep: "#0e6b30", accentGlow: "rgba(77, 212, 124, 0.32)", shell: "rgba(22, 122, 55, 0.24)", textStrong: "#f6fff8", textSoft: "rgba(225, 255, 233, 0.84)" };
    case "red":
      return { accent: "#ff7676", accentStrong: "#f24545", accentDeep: "#a11f2a", accentGlow: "rgba(255, 92, 92, 0.32)", shell: "rgba(166, 36, 48, 0.24)", textStrong: "#fff8f8", textSoft: "rgba(255, 229, 229, 0.84)" };
    case "yellow":
    default:
      return { accent: "#ffd84d", accentStrong: "#ffb400", accentDeep: "#b56f00", accentGlow: "rgba(255, 196, 38, 0.32)", shell: "rgba(171, 112, 10, 0.22)", textStrong: "#fff9ee", textSoft: "rgba(255, 242, 214, 0.84)" };
  }
}
