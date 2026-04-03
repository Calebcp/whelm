import test from "node:test";
import assert from "node:assert/strict";

import {
  buildStreakLedger,
  collectTrackedDayKeys,
  inferCompletedBlocksByDayFromSessions,
  mergeCompletedBlocksByDay,
} from "@/lib/streak-ledger";

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

test("inferCompletedBlocksByDayFromSessions recovers block completions from session notes", () => {
  const inferred = inferCompletedBlocksByDayFromSessions([
    {
      uid: "u1",
      completedAtISO: "2026-04-02T18:20:00",
      minutes: 25,
      note: "Planned block completed: Physics",
    },
    {
      uid: "u1",
      completedAtISO: "2026-04-02T20:10:00",
      minutes: 15,
      note: "something else",
    },
  ]);

  assert.equal(inferred.get("2026-04-02"), 1);
});

test("inferCompletedBlocksByDayFromSessions anchors planned completions to their UTC calendar day", () => {
  const inferred = inferCompletedBlocksByDayFromSessions([
    {
      uid: "u1",
      completedAtISO: "2026-03-25T01:00:00.000Z",
      minutes: 30,
      note: "Planned block completed: Morning block",
    },
  ]);

  assert.equal(inferred.get("2026-03-25"), 1);
});

test("buildStreakLedger marks qualifying protected and v2 combo days", () => {
  const effectiveCompletedBlocksByDay = mergeCompletedBlocksByDay({
    completedBlocksByDay: new Map([["2026-04-03", 1]]),
    inferredCompletedBlocksByDay: new Map([["2026-04-02", 1]]),
  });

  const ledger = buildStreakLedger({
    sessionMinutesByDay: new Map([
      ["2026-04-02", 35],
      ["2026-04-03", 10],
    ]),
    completedBlocksByDay: effectiveCompletedBlocksByDay,
    noteWordsByDay: new Map([
      ["2026-04-03", 40],
    ]),
    protectedStreakDateKeys: ["2026-04-04"],
    todayKey: "2026-04-04",
  });

  assert.deepEqual(
    ledger.map((entry) => [entry.dateKey, entry.qualifies, entry.qualificationReason]),
    [
      ["2026-04-02", true, "v2_combo"],
      ["2026-04-03", true, "v2_combo"],
      ["2026-04-04", true, "protected"],
    ],
  );
});
