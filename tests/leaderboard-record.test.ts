import assert from "node:assert/strict";
import test from "node:test";

import { buildLeaderboardProfile, mergeLeaderboardProfiles } from "@/lib/leaderboard";
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

test("mergeLeaderboardProfiles keeps fresher existing progress when incoming data regresses", () => {
  const existing = buildLeaderboardProfile({
    userId: "user-1",
    username: "CalebR",
    totalXp: 4587,
    currentStreak: 13,
    level: 8,
    createdAtISO: "2026-01-01T00:00:00.000Z",
    bestStreak: 13,
    totalFocusHours: 22,
    weeklyXp: 640,
  });
  const incoming = buildLeaderboardProfile({
    userId: "user-1",
    username: "CalebR",
    totalXp: 4503,
    currentStreak: 12,
    level: 8,
    createdAtISO: "2026-01-01T00:00:00.000Z",
    bestStreak: 12,
    totalFocusHours: 20,
    weeklyXp: 556,
  });

  const merged = mergeLeaderboardProfiles(existing, incoming);

  assert.equal(merged.totalXp, 4587);
  assert.equal(merged.currentStreak, 13);
  assert.equal(merged.weeklyXp, 640);
  assert.equal(merged.totalFocusHours, 22);
  assert.equal(merged.bestStreak, 13);
});

test("mergeLeaderboardProfiles accepts incoming data when it advances progress", () => {
  const existing = buildLeaderboardProfile({
    userId: "user-1",
    username: "CalebR",
    totalXp: 4503,
    currentStreak: 12,
    level: 8,
    createdAtISO: "2026-01-01T00:00:00.000Z",
    bestStreak: 12,
    totalFocusHours: 20,
    weeklyXp: 556,
  });
  const incoming = buildLeaderboardProfile({
    userId: "user-1",
    username: "CalebR",
    totalXp: 4587,
    currentStreak: 13,
    level: 8,
    createdAtISO: "2026-01-01T00:00:00.000Z",
    bestStreak: 13,
    totalFocusHours: 22,
    weeklyXp: 640,
  });

  const merged = mergeLeaderboardProfiles(existing, incoming);

  assert.equal(merged.totalXp, 4587);
  assert.equal(merged.currentStreak, 13);
  assert.equal(merged.weeklyXp, 640);
  assert.equal(merged.totalFocusHours, 22);
  assert.equal(merged.bestStreak, 13);
});
