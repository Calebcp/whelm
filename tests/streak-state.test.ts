import test from "node:test";
import assert from "node:assert/strict";

import { deriveStreakState } from "@/lib/streak-state";

test("deriveStreakState resolves purple tier and milestone from a 10 day run", () => {
  const streakQualifiedDateKeys = [
    "2026-03-26",
    "2026-03-27",
    "2026-03-28",
    "2026-03-29",
    "2026-03-30",
    "2026-03-31",
    "2026-04-01",
    "2026-04-02",
    "2026-04-03",
    "2026-04-04",
  ];

  const result = deriveStreakState({
    isPro: false,
    streak: 10,
    streakQualifiedDateKeys,
    sessionMinutesByDay: new Map([["2026-04-04", 40]]),
    noteWordsByDay: new Map(),
    completedBlocksByDay: new Map([["2026-04-04", 1]]),
    sickDaySaves: [],
    sickDaySaveDismissals: [],
    lifetimeXpSummary: {
      totalXp: 2500,
      todayXp: 80,
      todayTarget: 120,
      dailyCap: 150,
      currentLevel: 7,
      currentLevelFloorXp: 2000,
      nextLevelXp: 3000,
      progressInLevel: 500,
      progressToNextLevel: 0.5,
    },
  });

  assert.equal(result.displayStreak, 10);
  assert.equal(result.streakBandanaTier?.color, "purple");
  assert.equal(result.longestStreak, 10);
  assert.equal(result.nextBandanaMilestone?.tier.color, "blue");
});

test("deriveStreakState falls back to yesterday run when today is not yet earned", () => {
  const result = deriveStreakState({
    isPro: false,
    streak: 0,
    streakQualifiedDateKeys: [
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
    ],
    sessionMinutesByDay: new Map(),
    noteWordsByDay: new Map(),
    completedBlocksByDay: new Map(),
    sickDaySaves: [],
    sickDaySaveDismissals: [],
    lifetimeXpSummary: {
      totalXp: 500,
      todayXp: 0,
      todayTarget: 120,
      dailyCap: 150,
      currentLevel: 3,
      currentLevelFloorXp: 300,
      nextLevelXp: 700,
      progressInLevel: 200,
      progressToNextLevel: 0.5,
    },
  });

  assert.equal(result.displayStreak, 3);
  assert.equal(result.streakBandanaTier?.color, "red");
});
