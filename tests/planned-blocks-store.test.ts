import test from "node:test";
import assert from "node:assert/strict";

import { mergeBlocksPreferNewest, type PlannedBlockDoc } from "@/lib/planned-blocks-store";

function block(overrides: Partial<PlannedBlockDoc>): PlannedBlockDoc {
  return {
    id: "block-1",
    dateKey: "2026-03-29",
    title: "Morning focus",
    note: "",
    durationMinutes: 30,
    timeOfDay: "09:00",
    sortOrder: 0,
    createdAtISO: "2026-03-29T08:00:00.000Z",
    updatedAtISO: "2026-03-29T08:00:00.000Z",
    status: "active",
    ...overrides,
  };
}

test("mergeBlocksPreferNewest keeps a completed cloud block over a newer local active copy", () => {
  const merged = mergeBlocksPreferNewest(
    [
      block({
        status: "active",
        updatedAtISO: "2026-04-04T00:00:00.000Z",
      }),
    ],
    [
      block({
        status: "completed",
        completedAtISO: "2026-03-29T09:30:00.000Z",
        updatedAtISO: "2026-03-29T09:30:00.000Z",
      }),
    ],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.status, "completed");
  assert.equal(merged[0]?.completedAtISO, "2026-03-29T09:30:00.000Z");
});

test("mergeBlocksPreferNewest still uses newer timestamps when completion status matches", () => {
  const merged = mergeBlocksPreferNewest(
    [
      block({
        note: "local newer",
        updatedAtISO: "2026-03-29T10:00:00.000Z",
      }),
    ],
    [
      block({
        note: "cloud older",
        updatedAtISO: "2026-03-29T09:00:00.000Z",
      }),
    ],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.note, "local newer");
});
