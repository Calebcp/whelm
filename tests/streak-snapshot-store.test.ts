import assert from "node:assert/strict";
import test from "node:test";

import {
  loadLocalStreakSnapshot,
  saveLocalStreakSnapshot,
} from "@/lib/page-shell-local";

test("local streak snapshot round-trips canonical streak data", () => {
  const store = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };

  Object.defineProperty(globalThis, "window", {
    value: { localStorage },
    configurable: true,
  });

  saveLocalStreakSnapshot("user-1", {
    streak: 11,
    qualifiedDateKeys: ["2026-03-29", "2026-03-30"],
    dailyRecords: [
      {
        dateKey: "2026-03-29",
        focusMinutes: 42,
        completedBlocks: 1,
        noteWords: 0,
        isProtected: false,
        qualifies: true,
        qualificationReason: "v2_combo",
      },
    ],
    lifetimeXpSummary: {
      totalXp: 2619,
      todayXp: 80,
      todayTarget: 120,
      dailyCap: 150,
      currentLevel: 7,
      currentLevelFloorXp: 2000,
      nextLevelXp: 3000,
      progressInLevel: 619,
      progressToNextLevel: 0.619,
    },
    updatedAtISO: "2026-04-04T00:00:00.000Z",
  });

  const snapshot = loadLocalStreakSnapshot("user-1");
  assert(snapshot);
  assert.equal(snapshot.streak, 11);
  assert.equal(snapshot.lifetimeXpSummary.totalXp, 2619);
  assert.deepEqual(snapshot.qualifiedDateKeys, ["2026-03-29", "2026-03-30"]);
});
