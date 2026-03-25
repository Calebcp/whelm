import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import { createJsonResponse, installFetchMock } from "./helpers/mock-fetch";

test("notes route writes note body into Firestore notesJson payload", async () => {
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-project";
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
  process.env.FIREBASE_DATABASE_ID = "(default)";

  const { POST: saveNotesRoute } = await import("@/app/api/notes/route");

  const noteBody = "<p>Persistent note body</p>";
  let firestoreWriteBody: Record<string, unknown> | null = null;

  const restoreFetch = installFetchMock(async (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    assert.match(url, /\/userNotes\/user-notes\?key=demo-key$/);
    assert.equal(init?.method, "PATCH");
    assert.equal(init?.headers && (init.headers as Record<string, string>).Authorization, "Bearer token-notes");

    firestoreWriteBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

    return createJsonResponse({ json: { name: "projects/demo/documents/userNotes/user-notes" } });
  });

  try {
    const request = new NextRequest("http://localhost/api/notes", {
      method: "POST",
      headers: {
        authorization: "Bearer token-notes",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        uid: "user-notes",
        notes: [
          {
            id: "note-1",
            title: "Draft",
            body: noteBody,
            attachments: [],
            color: "#e7e5e4",
            shellColor: "#fff7d6",
            surfaceStyle: "solid",
            isPinned: false,
            fontFamily: "Avenir Next",
            fontSizePx: 16,
            category: "personal",
            reminderAtISO: "",
            updatedAtISO: "2026-03-25T10:00:00.000Z",
            createdAtISO: "2026-03-25T09:00:00.000Z",
          },
        ],
      }),
    });

    const response = await saveNotesRoute(request);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.ok(firestoreWriteBody);

    const fields = (firestoreWriteBody as { fields: Record<string, { stringValue?: string }> }).fields;
    const notesJson = fields.notesJson?.stringValue ?? "";
    assert.match(notesJson, /Persistent note body/);
  } finally {
    restoreFetch();
  }
});
