import test from "node:test";
import assert from "node:assert/strict";

import { canSyncLeaderboardProfile } from "@/lib/leaderboard-sync";

test("canSyncLeaderboardProfile waits until sessions are synced and streak is final", () => {
  assert.equal(
    canSyncLeaderboardProfile({
      sessionsSynced: false,
      streakIsProvisional: false,
    }),
    false,
  );

  assert.equal(
    canSyncLeaderboardProfile({
      sessionsSynced: true,
      streakIsProvisional: true,
    }),
    false,
  );

  assert.equal(
    canSyncLeaderboardProfile({
      sessionsSynced: true,
      streakIsProvisional: false,
    }),
    true,
  );
});
