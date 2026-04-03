import test from "node:test";
import assert from "node:assert/strict";

import { collectTrackedDayKeys } from "@/lib/tracked-day-keys";

test("collectTrackedDayKeys includes inferred completed-block dates", () => {
  const trackedDayKeys = collectTrackedDayKeys({
    sessionMinutesByDay: new Map([["2026-04-02", 35]]),
    completedBlocksByDay: new Map([["2026-04-01", 1], ["2026-04-02", 1]]),
    noteWordsByDay: new Map([["2026-04-03", 40]]),
    protectedStreakDateKeys: ["2026-04-04"],
  });

  assert.deepEqual([...trackedDayKeys].sort(), [
    "2026-04-01",
    "2026-04-02",
    "2026-04-03",
    "2026-04-04",
  ]);
});
