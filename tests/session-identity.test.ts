import assert from "node:assert/strict";
import test from "node:test";

import { canonicalSessionIdentity, sessionDocumentId } from "@/lib/session-identity";

test("canonicalSessionIdentity ignores noteSavedAtISO-only differences", () => {
  const base = {
    uid: "user-1",
    completedAtISO: "2026-04-04T01:00:00.000Z",
    minutes: 30,
    category: "misc" as const,
    note: "Planned block completed: Calc",
  };

  assert.equal(
    canonicalSessionIdentity({ ...base, noteSavedAtISO: "2026-04-04T01:01:00.000Z" }),
    canonicalSessionIdentity({ ...base, noteSavedAtISO: "2026-04-04T01:02:00.000Z" }),
  );
});

test("sessionDocumentId is stable for semantically identical sessions", () => {
  const base = {
    uid: "user-1",
    completedAtISO: "2026-04-04T01:00:00.000Z",
    minutes: 30,
    category: "misc" as const,
    note: "Planned block completed: Calc",
  };

  assert.equal(
    sessionDocumentId({ ...base, noteSavedAtISO: "2026-04-04T01:01:00.000Z" }),
    sessionDocumentId({ ...base, noteSavedAtISO: "2026-04-04T01:02:00.000Z" }),
  );
});
