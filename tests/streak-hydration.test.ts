import test from "node:test";
import assert from "node:assert/strict";

import { resolveHydratedStreak } from "@/lib/streak-hydration";

test("resolveHydratedStreak preserves the last good streak only while evidence is still hydrating", () => {
  const result = resolveHydratedStreak({
    computedStreak: 0,
    lastGoodStreak: 10,
    sessionsSynced: false,
    plannedBlocksHydrated: true,
    notesHydrated: true,
  });

  assert.equal(result.streak, 10);
  assert.equal(result.isProvisional, true);
});

test("resolveHydratedStreak drops stale streak fallback once all evidence is hydrated", () => {
  const result = resolveHydratedStreak({
    computedStreak: 0,
    lastGoodStreak: 10,
    sessionsSynced: true,
    plannedBlocksHydrated: true,
    notesHydrated: true,
  });

  assert.equal(result.streak, 0);
  assert.equal(result.isProvisional, false);
});

test("resolveHydratedStreak promotes fresh non-zero streaks immediately", () => {
  const result = resolveHydratedStreak({
    computedStreak: 7,
    lastGoodStreak: 3,
    sessionsSynced: false,
    plannedBlocksHydrated: false,
    notesHydrated: false,
  });

  assert.equal(result.streak, 7);
  assert.equal(result.nextLastGoodStreak, 7);
  assert.equal(result.isProvisional, false);
});
