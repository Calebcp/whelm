import { computeStreakEndingAtDateKey } from "@/lib/streak";
import { getStreakBandanaTier } from "@/lib/streak-bandanas";
import {
  XP_COMPLETED_BLOCK_DAILY_CAP,
  XP_COMPLETED_BLOCK_XP,
  XP_COMBO_BONUS,
  XP_DAILY_CAP,
  XP_DAILY_TARGET,
  XP_DEEP_WORK_BONUS,
  XP_STREAK_DAILY_BONUS,
  XP_WRITING_ENTRY_BONUS,
  XP_WRITING_ENTRY_THRESHOLD,
  XP_WRITING_BONUS_THRESHOLD,
  XP_WRITING_DAILY_CAP,
} from "@/lib/xp-engine";
export const XP_CONFIG = {
  dailyCap: XP_DAILY_CAP,
  streakBonusMultiplier: 1,
  deepWorkBonus: XP_DEEP_WORK_BONUS,
  writingBonus: XP_WRITING_ENTRY_BONUS,
  comboBonus: XP_COMBO_BONUS,
} as const;
const STREAK_MILESTONE_BONUSES: Record<number, number> = { 7: 40, 30: 120, 100: 350 };
export type XPEvent = "session_complete" | "deep_work" | "note_written" | "combo" | "card_correct" | "card_fast_recall" | "card_session_cleared";
export interface XPResult { awarded: number; reason: string; cappedAt?: number }
export type DayXpSummary = { dateKey: string; streakLength: number; multiplier: number; baseActionXp: number; completedBlocksXp: number; focusXp: number; writingXp: number; multipliedBaseXp: number; streakDailyXp: number; streakMilestoneXp: number; deepWorkXp: number; comboXp: number; totalXp: number };
export type LifetimeXpSummary = { totalXp: number; todayXp: number; todayTarget: number; dailyCap: number; currentLevel: number; currentLevelFloorXp: number; nextLevelXp: number; progressInLevel: number; progressToNextLevel: number };
function getXpMultiplierForStreak(streakLength: number) {
  switch (getStreakBandanaTier(streakLength)?.color) {
    case "white": return 2.4;
    case "black": return 2;
    case "blue": return 1.6;
    case "purple": return 1.35;
    case "green": return 1.2;
    case "red": return 1.1;
    default: return 1;
  }
}
function getXpWritingBonus(wordCount: number) {
  if (wordCount >= XP_WRITING_BONUS_THRESHOLD) return XP_WRITING_DAILY_CAP;
  if (wordCount >= XP_WRITING_ENTRY_THRESHOLD) return XP_CONFIG.writingBonus;
  return 0;
}
function getXpMilestoneBonus(streakLength: number) {
  return STREAK_MILESTONE_BONUSES[streakLength] ?? 0;
}
export function calculateXP(
  event: XPEvent,
  context: {
    currentDailyXP: number;
    streakDays: number;
    sessionDurationMinutes?: number;
  },
): XPResult {
  const remaining = Math.max(0, XP_CONFIG.dailyCap - context.currentDailyXP);
  let awarded = 0;
  let reason = event;

  switch (event) {
    case "session_complete":
      // 20 XP per 30-min session, uncapped — return directly before daily cap check
      return { awarded: Math.floor((context.sessionDurationMinutes ?? 0) / 30) * 20, reason: "session_complete" };
    case "deep_work":
      awarded = (context.sessionDurationMinutes ?? 0) >= 90 ? XP_CONFIG.deepWorkBonus : 0;
      reason = "deep_work";
      break;
    case "note_written":
      awarded = getXpWritingBonus(context.sessionDurationMinutes ?? 0);
      reason = "note_written";
      break;
    case "combo":
      awarded = XP_CONFIG.comboBonus;
      reason = "combo";
      break;
    case "card_correct":
      // Flashcard XP is uncapped — return directly before daily cap check
      return { awarded: 5, reason: "card_correct" };
    case "card_fast_recall":
      return { awarded: 0, reason: "card fast recall" };
    case "card_session_cleared":
      // Clear-all bonus is uncapped — return directly before daily cap check
      return { awarded: 20, reason: "card_session_cleared" };
  }

  const cappedAward = Math.min(remaining, awarded);
  return cappedAward < awarded
    ? { awarded: cappedAward, reason, cappedAt: XP_CONFIG.dailyCap }
    : { awarded: cappedAward, reason };
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
  const focusXp = Math.floor(focusMinutes / 30) * 20;
  const writingXp = getXpWritingBonus(noteWords);
  const baseActionXp = completedBlocksXp + focusXp + writingXp;
  const multipliedBaseXp = Math.round(baseActionXp * multiplier);
  const streakDailyXp = streakLength > 0 ? XP_STREAK_DAILY_BONUS : 0;
  const streakMilestoneXp = streakLength > 0 ? getXpMilestoneBonus(streakLength) : 0;
  const deepWorkXp = focusMinutes >= 90 ? XP_CONFIG.deepWorkBonus : 0;
  const comboXp = completedBlocks >= 1 && (focusMinutes >= 30 || noteWords >= XP_WRITING_ENTRY_THRESHOLD)
    ? XP_CONFIG.comboBonus
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
    totalXp: Math.min(XP_CONFIG.dailyCap, multipliedBaseXp + streakDailyXp + streakMilestoneXp + deepWorkXp + comboXp),
  };
}
function getXpRequiredToReachLevel(level: number) {
  if (level <= 1) return 0;
  let total = 0;
  for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
    total += Math.round(85 * currentLevel ** 1.45);
  }
  return total;
}
export function calculateLevel(totalXP: number): number {
  let currentLevel = 1;
  let nextLevelXp = getXpRequiredToReachLevel(2);
  while (totalXP >= nextLevelXp) {
    currentLevel += 1;
    nextLevelXp = getXpRequiredToReachLevel(currentLevel + 1);
  }
  return currentLevel;
}
export function getLifetimeXpSummary(totalXp: number, todayXp: number): LifetimeXpSummary {
  const currentLevel = calculateLevel(totalXp);
  const currentLevelFloorXp = getXpRequiredToReachLevel(currentLevel);
  const nextLevelXp = getXpRequiredToReachLevel(currentLevel + 1);
  const progressInLevel = Math.max(0, totalXp - currentLevelFloorXp);
  const levelRange = Math.max(1, nextLevelXp - currentLevelFloorXp);
  return {
    totalXp,
    todayXp,
    todayTarget: XP_DAILY_TARGET,
    dailyCap: XP_CONFIG.dailyCap,
    currentLevel,
    currentLevelFloorXp,
    nextLevelXp,
    progressInLevel,
    progressToNextLevel: Math.min(1, progressInLevel / levelRange),
  };
}
export function getDailyXPRemaining(currentDailyXP: number): number {
  return Math.max(0, XP_CONFIG.dailyCap - currentDailyXP);
}
