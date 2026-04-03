import test from "node:test";
import assert from "node:assert/strict";

import { buildNoteWordsByDayFromHistory } from "@/lib/note-word-history";

test("buildNoteWordsByDayFromHistory preserves earlier writing days from revisions", () => {
  const noteWordsByDay = buildNoteWordsByDayFromHistory({
    notes: [
      {
        id: "note-1",
        title: "Run log",
        body: "thirty four words " + "x ".repeat(31),
        attachments: [],
        color: "#e7e5e4",
        shellColor: "#fff7d6",
        surfaceStyle: "solid",
        isPinned: false,
        fontFamily: "Avenir Next",
        fontSizePx: 16,
        category: "personal",
        reminderAtISO: "",
        createdAtISO: "2026-03-30T09:00:00.000Z",
        updatedAtISO: "2026-04-02T09:00:00.000Z",
      },
    ],
    getRevisions: () => [
      {
        id: "rev-1",
        noteId: "note-1",
        title: "Run log",
        body: "thirty four words " + "y ".repeat(31),
        capturedAtISO: "2026-04-02T09:00:00.000Z",
        sourceUpdatedAtISO: "2026-03-30T09:00:00.000Z",
        reason: "body-update",
      },
    ],
  });

  assert.equal(noteWordsByDay.get("2026-03-30"), 34);
  assert.equal(noteWordsByDay.get("2026-04-02"), 34);
});
