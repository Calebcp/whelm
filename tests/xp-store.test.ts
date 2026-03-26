import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDayXpSummaryForDate,
  calculateLevel,
  calculateXP,
} from "@/lib/xp-store";

function dateRange(length: number, endDateKey: string) {
  const dates: string[] = [];
  const [year, month, day] = endDateKey.split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));

  for (let index = 0; index < length; index += 1) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return dates.sort();
}

function xpRequiredToReachLevel(level: number) {
  if (level <= 1) return 0;
  let total = 0;
  for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
    total += Math.round(85 * currentLevel ** 1.45);
  }
  return total;
}

test("a completed session awards correct base XP", () => {
  const result = calculateXP("session_complete", {
    currentDailyXP: 0,
    streakDays: 3,
    sessionDurationMinutes: 45,
  });

  assert.deepEqual(result, {
    awarded: 45,
    reason: "session_complete",
  });
});

test("daily cap is enforced when awarding XP", () => {
  const result = calculateXP("session_complete", {
    currentDailyXP: 140,
    streakDays: 12,
    sessionDurationMinutes: 30,
  });

  assert.deepEqual(result, {
    awarded: 10,
    reason: "session_complete",
    cappedAt: 150,
  });
});

test("streak bonus multiplier applies correctly at day 7, 30, and 100", () => {
  const dateKey = "2026-03-25";

  const day7 = buildDayXpSummaryForDate({
    dateKey,
    sessionMinutesByDay: new Map([[dateKey, 30]]),
    completedBlocksByDay: new Map(),
    noteWordsByDay: new Map(),
    streakQualifiedDateKeys: dateRange(7, dateKey),
  });
  const day30 = buildDayXpSummaryForDate({
    dateKey,
    sessionMinutesByDay: new Map([[dateKey, 30]]),
    completedBlocksByDay: new Map(),
    noteWordsByDay: new Map(),
    streakQualifiedDateKeys: dateRange(30, dateKey),
  });
  const day100 = buildDayXpSummaryForDate({
    dateKey,
    sessionMinutesByDay: new Map([[dateKey, 30]]),
    completedBlocksByDay: new Map(),
    noteWordsByDay: new Map(),
    streakQualifiedDateKeys: dateRange(100, dateKey),
  });

  assert.equal(day7.multiplier, 1.2);
  assert.equal(day30.multiplier, 1.6);
  assert.equal(day100.multiplier, 2.4);
});

test("calculateLevel returns correct level at XP boundaries", () => {
  assert.equal(calculateLevel(0), 1);
  assert.equal(calculateLevel(xpRequiredToReachLevel(2) - 1), 1);
  assert.equal(calculateLevel(xpRequiredToReachLevel(2)), 2);
  assert.equal(calculateLevel(xpRequiredToReachLevel(3) - 1), 2);
  assert.equal(calculateLevel(xpRequiredToReachLevel(3)), 3);
});

test("card XP events are accepted without throwing", () => {
  assert.doesNotThrow(() =>
    calculateXP("card_correct", {
      currentDailyXP: 0,
      streakDays: 0,
    }),
  );
  assert.doesNotThrow(() =>
    calculateXP("card_fast_recall", {
      currentDailyXP: 0,
      streakDays: 0,
    }),
  );
  assert.doesNotThrow(() =>
    calculateXP("card_session_cleared", {
      currentDailyXP: 0,
      streakDays: 0,
    }),
  );

  assert.equal(
    calculateXP("card_correct", { currentDailyXP: 0, streakDays: 0 }).awarded,
    5,
  );
  assert.equal(
    calculateXP("card_fast_recall", { currentDailyXP: 0, streakDays: 0 }).awarded,
    0,
  );
});
