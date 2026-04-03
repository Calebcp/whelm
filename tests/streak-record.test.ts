import assert from "node:assert/strict";
import test from "node:test";

import { buildShellStreakSummary } from "@/lib/streak-record";

test("buildShellStreakSummary returns syncing copy while streak truth is provisional", () => {
  const summary = buildShellStreakSummary({
    profileTitle: "Purple Return",
    streak: {
      isReady: false,
      visibleBandanaColor: "purple",
      streakBandanaLabel: "Purple Bandana",
      displayStreak: 10,
      longestStreak: 14,
      nextBandanaMilestone: null,
    },
  });

  assert.equal(summary.isReady, false);
  assert.equal(summary.tierColor, null);
  assert.equal(summary.currentStreakLabel, "Syncing");
});

test("buildShellStreakSummary returns finalized shell copy from one streak summary source", () => {
  const summary = buildShellStreakSummary({
    profileTitle: "Purple Return",
    streak: {
      isReady: true,
      visibleBandanaColor: "purple",
      streakBandanaLabel: "Purple Bandana",
      displayStreak: 10,
      longestStreak: 14,
      nextBandanaMilestone: {
        tier: {
          label: "Blue Bandana",
          minDays: 20,
        },
        remainingDays: 10,
      },
    },
  });

  assert.equal(summary.isReady, true);
  assert.equal(summary.tierColor, "purple");
  assert.equal(summary.currentStreakLabel, "10d");
  assert.equal(summary.longestStreakLabel, "14d");
  assert.match(summary.identityLine, /Purple Return/);
});
