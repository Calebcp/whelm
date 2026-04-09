import test from "node:test";
import assert from "node:assert/strict";

type WorkspaceNoteShape = {
  id: string;
  title: string;
  body: string;
  attachments: [];
  color: string;
  shellColor: string;
  surfaceStyle: "solid" | "airy";
  isPinned: boolean;
  fontFamily: string;
  fontSizePx: number;
  category: "personal" | "school" | "work";
  reminderAtISO: string;
  updatedAtISO: string;
  createdAtISO: string;
};

function makeNote(overrides: Partial<WorkspaceNoteShape>): WorkspaceNoteShape {
  return {
    id: "note-1",
    title: "Test note",
    body: "<p>Default body</p>",
    attachments: [],
    color: "#e7e5e4",
    shellColor: "#fff7d6",
    surfaceStyle: "solid",
    isPinned: false,
    fontFamily: "Avenir Next",
    fontSizePx: 16,
    category: "personal",
    reminderAtISO: "",
    updatedAtISO: "2026-03-30T00:00:00.000Z",
    createdAtISO: "2026-03-29T00:00:00.000Z",
    ...overrides,
  };
}

test("mergeNotesPreferNewest keeps older non-empty body when newer body is effectively blank HTML", async () => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "demo.firebaseapp.com";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-project";
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "demo.appspot.com";
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "1234567890";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:1234567890:web:abcdef";
  process.env.FIREBASE_DATABASE_ID = "(default)";

  const { mergeNotesPreferNewest } = await import("@/lib/notes-store");
  const older = makeNote({
    body: "<p>I still have real words here</p>",
    updatedAtISO: "2026-03-29T23:00:00.000Z",
  });
  const newerBlank = makeNote({
    body: "<div><br></div>",
    updatedAtISO: "2026-03-30T00:00:00.000Z",
  });

  const [merged] = mergeNotesPreferNewest([older], [newerBlank]);

  assert.ok(merged);
  assert.equal(merged.body, "<p>I still have real words here</p>");
  assert.equal(merged.updatedAtISO, "2026-03-30T00:00:00.000Z");
});

test("mergeNotesPreferNewest keeps an intentionally blank newer title", async () => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "demo.firebaseapp.com";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-project";
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "demo.appspot.com";
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "1234567890";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:1234567890:web:abcdef";
  process.env.FIREBASE_DATABASE_ID = "(default)";

  const { mergeNotesPreferNewest } = await import("@/lib/notes-store");
  const older = makeNote({
    title: "Original title",
    updatedAtISO: "2026-03-29T23:00:00.000Z",
  });
  const newerBlankTitle = makeNote({
    title: "",
    updatedAtISO: "2026-03-30T00:00:00.000Z",
  });

  const [merged] = mergeNotesPreferNewest([older], [newerBlankTitle]);

  assert.ok(merged);
  assert.equal(merged.title, "");
  assert.equal(merged.updatedAtISO, "2026-03-30T00:00:00.000Z");
});

test("mergeNotesPreferNewest keeps legacy-only notes alongside subcollection notes", async () => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "demo.firebaseapp.com";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-project";
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "demo.appspot.com";
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "1234567890";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:1234567890:web:abcdef";
  process.env.FIREBASE_DATABASE_ID = "(default)";

  const { mergeNotesPreferNewest } = await import("@/lib/notes-store");
  const legacyOnly = makeNote({
    id: "legacy-only",
    title: "Legacy only",
    body: "<p>Still only in notesJson</p>",
    updatedAtISO: "2026-03-29T20:00:00.000Z",
  });
  const subcollectionOnly = makeNote({
    id: "subcollection-only",
    title: "Subcollection only",
    body: "<p>Already migrated</p>",
    updatedAtISO: "2026-03-30T01:00:00.000Z",
  });

  const merged = mergeNotesPreferNewest([legacyOnly], [subcollectionOnly]);

  assert.equal(merged.length, 2);
  assert.ok(merged.some((note) => note.id === "legacy-only"));
  assert.ok(merged.some((note) => note.id === "subcollection-only"));
});

test("notes editor interop restores plain line breaks from stored bodies", async () => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "demo.firebaseapp.com";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-project";
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "demo.appspot.com";
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "1234567890";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:1234567890:web:abcdef";
  process.env.FIREBASE_DATABASE_ID = "(default)";

  const { __notesEditorInterop } = await import("@/hooks/useNotes");
  const sourceText = "First line\n\nSecond line";

  const stored = __notesEditorInterop.editorTextToStoredBody(sourceText);
  const restored = __notesEditorInterop.storedBodyToEditorText(stored);

  assert.equal(stored, "First line<br/><br/>Second line");
  assert.equal(restored, sourceText);
});

test("notes editor interop converts escaped br text back into normal spacing", async () => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "demo.firebaseapp.com";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-project";
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "demo.appspot.com";
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "1234567890";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:1234567890:web:abcdef";
  process.env.FIREBASE_DATABASE_ID = "(default)";

  const { __notesEditorInterop } = await import("@/hooks/useNotes");

  const restored = __notesEditorInterop.storedBodyToEditorText(
    "First line&lt;br/&gt;&lt;br/&gt;Second line",
  );

  assert.equal(restored, "First line\n\nSecond line");
});
