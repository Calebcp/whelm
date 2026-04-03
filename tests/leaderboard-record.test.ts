import assert from "node:assert/strict";
import test from "node:test";

import {
  adoptCanonicalLeaderboardSelf,
  buildCanonicalLeaderboardSelf,
} from "@/lib/leaderboard-record";

test("adoptCanonicalLeaderboardSelf replaces stale current-user snapshot fields", () => {
  const canonicalSelf = buildCanonicalLeaderboardSelf({
    currentUserId: "user-1",
    currentUserPhotoUrl: "https://example.com/me.png",
    currentUserCreatedAtISO: "2026-01-01T00:00:00.000Z",
    profileDisplayName: "CalebR",
    displayStreak: 11,
    isPro: true,
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
    myBestStreak: 11,
    myTotalFocusHours: 441,
  });

  const normalized = adoptCanonicalLeaderboardSelf(
    {
      id: "user-1",
      username: "OldName",
      createdAtISO: "2026-01-01T00:00:00.000Z",
      totalXp: 2508,
      currentStreak: 3,
      level: 7,
      isCurrentUser: true,
    },
    canonicalSelf,
  );

  assert.equal(normalized.currentStreak, 11);
  assert.equal(normalized.totalXp, 2619);
  assert.equal(normalized.username, "CalebR");
});

test("adoptCanonicalLeaderboardSelf leaves other users unchanged", () => {
  const canonicalSelf = buildCanonicalLeaderboardSelf({
    currentUserId: "user-1",
    currentUserPhotoUrl: null,
    currentUserCreatedAtISO: "2026-01-01T00:00:00.000Z",
    profileDisplayName: "CalebR",
    displayStreak: 11,
    isPro: true,
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
    myBestStreak: 11,
    myTotalFocusHours: 441,
  });

  const normalized = adoptCanonicalLeaderboardSelf(
    {
      id: "user-2",
      username: "Andrew",
      createdAtISO: "2026-01-02T00:00:00.000Z",
      totalXp: 530,
      currentStreak: 1,
      level: 3,
      isCurrentUser: false,
    },
    canonicalSelf,
  );

  assert.equal(normalized.currentStreak, 1);
  assert.equal(normalized.username, "Andrew");
});
