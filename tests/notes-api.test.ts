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

    if (/\/userNotes\/user-notes\/notes\?key=demo-key$/.test(url)) {
      assert.equal(init?.method, "GET");
      return createJsonResponse({ json: { documents: [] } });
    }

    if (/\/userNotes\/user-notes\?key=demo-key$/.test(url)) {
      assert.equal(init?.method, "GET");
      return createJsonResponse({ status: 404, json: { error: { message: "Not found" } } });
    }

    assert.match(url, /\/userNotes\/user-notes\/notes\/note-1\?key=demo-key$/);
    assert.equal(init?.method, "PATCH");
    assert.equal(init?.headers && (init.headers as Record<string, string>).Authorization, "Bearer token-notes");

    firestoreWriteBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

    return createJsonResponse({ json: { name: "projects/demo/documents/userNotes/user-notes/notes/note-1" } });
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
    const body = fields.body?.stringValue ?? "";
    assert.match(body, /Persistent note body/);
  } finally {
    restoreFetch();
  }
});

test("notes route writes attachments into Firestore subcollection documents", async () => {
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-project";
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
  process.env.FIREBASE_DATABASE_ID = "(default)";

  const { POST: saveNotesRoute } = await import("@/app/api/notes/route");

  let firestoreWriteBody: Record<string, unknown> | null = null;

  const restoreFetch = installFetchMock(async (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (/\/userNotes\/user-notes\/notes\?key=demo-key$/.test(url)) {
      assert.equal(init?.method, "GET");
      return createJsonResponse({ json: { documents: [] } });
    }

    if (/\/userNotes\/user-notes\?key=demo-key$/.test(url)) {
      assert.equal(init?.method, "GET");
      return createJsonResponse({ status: 404, json: { error: { message: "Not found" } } });
    }

    firestoreWriteBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return createJsonResponse({ json: { name: "projects/demo/documents/userNotes/user-notes/notes/note-2" } });
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
            id: "note-2",
            title: "With attachment",
            body: "<p>Body</p>",
            attachments: [
              {
                id: "att-1",
                name: "spec.pdf",
                mimeType: "application/pdf",
                sizeBytes: 2048,
                kind: "document",
                storagePath: "users/u/notes/note-2/spec.pdf",
                downloadUrl: "https://example.com/spec.pdf",
                uploadedAtISO: "2026-03-25T09:05:00.000Z",
              },
            ],
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
    assert.equal(response.status, 200);
    assert.ok(firestoreWriteBody);

    const fields = (firestoreWriteBody as {
      fields: {
        attachments?: {
          arrayValue?: {
            values?: Array<{
              mapValue?: { fields?: Record<string, { stringValue?: string; integerValue?: string }> };
            }>;
          };
        };
      };
    }).fields;
    const firstAttachment = fields.attachments?.arrayValue?.values?.[0]?.mapValue?.fields;
    assert.equal(firstAttachment?.name?.stringValue, "spec.pdf");
    assert.equal(firstAttachment?.storagePath?.stringValue, "users/u/notes/note-2/spec.pdf");
  } finally {
    restoreFetch();
  }
});
