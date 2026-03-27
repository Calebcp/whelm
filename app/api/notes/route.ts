import { NextRequest, NextResponse } from "next/server";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const databaseId = process.env.FIREBASE_DATABASE_ID?.trim() || "(default)";

type WorkspaceNote = {
  id: string;
  title: string;
  body: string;
  attachments: NoteAttachment[];
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

type NoteAttachment = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: "image" | "document" | "spreadsheet" | "presentation" | "archive" | "text" | "other";
  storagePath: string;
  downloadUrl: string;
  uploadedAtISO: string;
};

type NotesPayload = {
  uid: string;
  notes: WorkspaceNote[];
};

// ── Firestore REST types ──────────────────────────────────────────────────────

type FirestoreStringValue = { stringValue: string };
type FirestoreBoolValue = { booleanValue: boolean };
type FirestoreIntValue = { integerValue: string };
type FirestoreArrayValue = { arrayValue: { values?: FirestoreFieldValue[] } };
type FirestoreMapValue = { mapValue: { fields?: Record<string, FirestoreFieldValue> } };
type FirestoreFieldValue =
  | FirestoreStringValue
  | FirestoreBoolValue
  | FirestoreIntValue
  | FirestoreArrayValue
  | FirestoreMapValue
  | Record<string, never>;

type FirestoreNoteFields = Record<string, FirestoreFieldValue>;
type FirestoreNoteDocument = {
  name?: string;
  fields?: FirestoreNoteFields;
};
type FirestoreListResponse = {
  documents?: FirestoreNoteDocument[];
};

// ── Legacy single-document type (for GET fallback) ───────────────────────────
type FirestoreDocumentResponse = {
  name?: string;
  fields?: {
    uid?: { stringValue?: string };
    notesJson?: { stringValue?: string };
    updatedAtISO?: { stringValue?: string };
  };
};

const legacyColorMap: Record<string, string> = {
  red: "#fecaca",
  green: "#bbf7d0",
  yellow: "#fef08a",
  blue: "#bfdbfe",
  gray: "#e7e5e4",
  violet: "#ddd6fe",
  pink: "#fbcfe8",
};

function requireConfig() {
  if (!projectId || !apiKey) {
    throw new Error("Missing Firebase environment variables on the server.");
  }
  return { apiKey, projectId };
}

function firestoreDocumentsBaseUrl(targetDatabaseId = databaseId) {
  const { projectId } = requireConfig();
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${targetDatabaseId}/documents`;
}

function deletionDatabaseIds() {
  return [...new Set(["(default)", databaseId])];
}

function shouldIgnoreDeletionError(message: string) {
  return (
    message.includes("PERMISSION_DENIED") ||
    message.includes("permission-denied") ||
    message.includes("Missing or insufficient permissions") ||
    message.includes("NOT_FOUND") ||
    message.includes("not found") ||
    message.includes("does not exist")
  );
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function getAuthHeader(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader : null;
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function str(v: FirestoreFieldValue | undefined, fallback = ""): string {
  return (v as FirestoreStringValue)?.stringValue ?? fallback;
}

function bool(v: FirestoreFieldValue | undefined, fallback = false): boolean {
  return (v as FirestoreBoolValue)?.booleanValue ?? fallback;
}

function int(v: FirestoreFieldValue | undefined, fallback = 0): number {
  const iv = (v as FirestoreIntValue)?.integerValue;
  return iv !== undefined ? parseInt(iv, 10) || fallback : fallback;
}

function noteToFields(note: WorkspaceNote): FirestoreNoteFields {
  return {
    id: { stringValue: note.id },
    title: { stringValue: note.title },
    body: { stringValue: note.body },
    color: { stringValue: note.color },
    shellColor: { stringValue: note.shellColor },
    surfaceStyle: { stringValue: note.surfaceStyle },
    isPinned: { booleanValue: note.isPinned },
    fontFamily: { stringValue: note.fontFamily },
    fontSizePx: { integerValue: String(note.fontSizePx) },
    category: { stringValue: note.category },
    reminderAtISO: { stringValue: note.reminderAtISO },
    updatedAtISO: { stringValue: note.updatedAtISO },
    createdAtISO: { stringValue: note.createdAtISO },
  };
}

function noteFromDocument(doc: FirestoreNoteDocument): WorkspaceNote | null {
  const f = doc.fields;
  if (!f) return null;
  const id = str(f.id);
  if (!id) return null;

  const color = str(f.color, "#e7e5e4");
  const shellColor = str(f.shellColor, "#fff7d6");

  return {
    id,
    title: str(f.title),
    body: str(f.body),
    color: legacyColorMap[color] ?? color,
    shellColor: legacyColorMap[shellColor] ?? shellColor,
    surfaceStyle: str(f.surfaceStyle) === "airy" ? "airy" : "solid",
    isPinned: bool(f.isPinned),
    fontFamily: str(f.fontFamily, "Avenir Next"),
    fontSizePx: Math.min(32, Math.max(12, int(f.fontSizePx, 16))),
    category:
      (str(f.category) as WorkspaceNote["category"]) === "school" ||
      (str(f.category) as WorkspaceNote["category"]) === "work"
        ? (str(f.category) as WorkspaceNote["category"])
        : "personal",
    reminderAtISO: str(f.reminderAtISO),
    updatedAtISO: str(f.updatedAtISO),
    createdAtISO: str(f.createdAtISO),
    attachments: [],
  };
}

function normalizeNotes(notes: WorkspaceNote[]) {
  return [...notes]
    .filter((note) => note.id && typeof note.title === "string" && typeof note.body === "string")
    .map((note) => ({
      id: note.id,
      title: note.title.slice(0, 200),
      body: note.body.slice(0, 20000),
      attachments: normalizeAttachments(note.attachments),
      color:
        typeof note.color === "string" && note.color
          ? legacyColorMap[note.color] || note.color
          : "#e7e5e4",
      shellColor:
        typeof note.shellColor === "string" && note.shellColor
          ? legacyColorMap[note.shellColor] || note.shellColor
          : "#fff7d6",
      surfaceStyle: note.surfaceStyle === "airy" ? "airy" : "solid",
      isPinned: typeof note.isPinned === "boolean" ? note.isPinned : false,
      fontFamily: typeof note.fontFamily === "string" && note.fontFamily ? note.fontFamily : "Avenir Next",
      fontSizePx:
        typeof note.fontSizePx === "number" && Number.isFinite(note.fontSizePx)
          ? Math.min(32, Math.max(12, Math.round(note.fontSizePx)))
          : 16,
      category:
        note.category === "school" || note.category === "work" || note.category === "personal"
          ? note.category
          : "personal",
      reminderAtISO: typeof note.reminderAtISO === "string" ? note.reminderAtISO : "",
      createdAtISO: note.createdAtISO,
      updatedAtISO: note.updatedAtISO,
    } satisfies WorkspaceNote))
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return a.updatedAtISO < b.updatedAtISO ? 1 : -1;
    });
}

function normalizeAttachments(attachments: WorkspaceNote["attachments"]) {
  if (!Array.isArray(attachments)) return [] as NoteAttachment[];

  return attachments
    .filter(
      (attachment) =>
        attachment &&
        typeof attachment.id === "string" &&
        typeof attachment.name === "string" &&
        typeof attachment.mimeType === "string" &&
        typeof attachment.storagePath === "string" &&
        typeof attachment.downloadUrl === "string" &&
        typeof attachment.uploadedAtISO === "string",
    )
    .map((attachment) => ({
      id: attachment.id,
      name: attachment.name.slice(0, 180),
      mimeType: attachment.mimeType.slice(0, 140),
      sizeBytes: Math.max(0, Math.round(Number(attachment.sizeBytes) || 0)),
      kind:
        attachment.kind === "image" ||
        attachment.kind === "document" ||
        attachment.kind === "spreadsheet" ||
        attachment.kind === "presentation" ||
        attachment.kind === "archive" ||
        attachment.kind === "text"
          ? attachment.kind
          : "other",
      storagePath: attachment.storagePath.slice(0, 500),
      downloadUrl: attachment.downloadUrl.slice(0, 2000),
      uploadedAtISO: attachment.uploadedAtISO,
    }) satisfies NoteAttachment)
    .sort((a, b) => (a.uploadedAtISO < b.uploadedAtISO ? 1 : -1));
}

// ── Firestore REST helpers ────────────────────────────────────────────────────

/** List all note documents in the `userNotes/{uid}/notes` subcollection. */
async function listNoteDocuments(
  request: NextRequest,
  uid: string,
): Promise<WorkspaceNote[]> {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const baseUrl = firestoreDocumentsBaseUrl();
  const { apiKey } = requireConfig();

  const response = await fetch(
    `${baseUrl}/userNotes/${encodeURIComponent(uid)}/notes?key=${apiKey}`,
    {
      method: "GET",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      cache: "no-store",
    },
  );

  if (response.status === 404) return [];

  if (!response.ok) {
    // Fall back to the legacy single-document format so old clients still work.
    const legacyNotes = await fetchLegacyDocument(request, uid);
    return legacyNotes ? parseLegacyNotes(legacyNotes) : [];
  }

  const body = (await response.json()) as FirestoreListResponse;
  if (!body.documents || body.documents.length === 0) {
    // Subcollection is empty — try legacy document as fallback.
    const legacyNotes = await fetchLegacyDocument(request, uid).catch(() => null);
    return legacyNotes ? parseLegacyNotes(legacyNotes) : [];
  }

  return body.documents.map(noteFromDocument).filter((n): n is WorkspaceNote => n !== null);
}

/** Write a single note document to `userNotes/{uid}/notes/{noteId}`. */
async function upsertNoteDocument(
  request: NextRequest,
  uid: string,
  note: WorkspaceNote,
): Promise<void> {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const baseUrl = firestoreDocumentsBaseUrl();
  const { apiKey } = requireConfig();

  const response = await fetch(
    `${baseUrl}/userNotes/${encodeURIComponent(uid)}/notes/${encodeURIComponent(note.id)}?key=${apiKey}`,
    {
      method: "PATCH",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ fields: noteToFields(note) }),
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    const message = body?.error?.message || body?.error?.status || "Failed to save note.";
    console.error("Notes Firestore write failed.", { uid, noteId: note.id, status: response.status, message });
    throw new Error(message);
  }
}

/** Delete all note documents in the subcollection, then the legacy parent document. */
async function deleteAllNoteDocuments(request: NextRequest, uid: string): Promise<void> {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const { apiKey } = requireConfig();
  const errors: string[] = [];

  // 1. List and delete all subcollection docs.
  for (const targetDatabaseId of deletionDatabaseIds()) {
    const baseUrl = firestoreDocumentsBaseUrl(targetDatabaseId);
    try {
      const listRes = await fetch(
        `${baseUrl}/userNotes/${encodeURIComponent(uid)}/notes?key=${apiKey}`,
        {
          method: "GET",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          cache: "no-store",
        },
      );

      if (listRes.ok) {
        const body = (await listRes.json()) as FirestoreListResponse;
        const docs = body.documents ?? [];
        await Promise.allSettled(
          docs.map(async (doc) => {
            if (!doc.name) return;
            const deleteRes = await fetch(`${doc.name}?key=${apiKey}`, {
              method: "DELETE",
              headers: { Authorization: authHeader },
              cache: "no-store",
            });
            if (!deleteRes.ok && deleteRes.status !== 404) {
              const b = (await deleteRes.json().catch(() => null)) as { error?: { message?: string } } | null;
              const msg = b?.error?.message ?? "Unknown delete error";
              if (!shouldIgnoreDeletionError(msg)) throw new Error(msg);
            }
          }),
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (!shouldIgnoreDeletionError(msg)) errors.push(`subcollection:${targetDatabaseId}:${msg}`);
    }

    // 2. Also delete the legacy parent document.
    const deleteParentRes = await fetch(
      `${firestoreDocumentsBaseUrl(targetDatabaseId)}/userNotes/${encodeURIComponent(uid)}?key=${apiKey}`,
      {
        method: "DELETE",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        cache: "no-store",
      },
    );

    if (deleteParentRes.status === 404) continue;
    if (!deleteParentRes.ok) {
      const body = (await deleteParentRes.json().catch(() => null)) as
        | { error?: { message?: string; status?: string } }
        | null;
      const message =
        body?.error?.message ||
        body?.error?.status ||
        `Failed to delete notes from Firestore database "${targetDatabaseId}".`;

      if (shouldIgnoreDeletionError(message)) {
        errors.push(`parent:${targetDatabaseId}:${message}`);
        continue;
      }
      throw new Error(message);
    }
  }

  if (errors.length > 0 && errors.length === deletionDatabaseIds().length * 2) {
    throw new Error("Unable to verify note deletion in any Firestore database.");
  }
}

// ── Legacy document helpers (read-only fallback) ──────────────────────────────

async function fetchLegacyDocument(
  request: NextRequest,
  uid: string,
): Promise<FirestoreDocumentResponse | null> {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const baseUrl = firestoreDocumentsBaseUrl();
  const { apiKey } = requireConfig();
  const response = await fetch(`${baseUrl}/userNotes/${encodeURIComponent(uid)}?key=${apiKey}`, {
    method: "GET",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) return null;

  return (await response.json()) as FirestoreDocumentResponse;
}

function parseLegacyNotes(document: FirestoreDocumentResponse): WorkspaceNote[] {
  const raw = document.fields?.notesJson?.stringValue;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WorkspaceNote[];
    return Array.isArray(parsed) ? normalizeNotes(parsed) : [];
  } catch {
    return [];
  }
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid");
    if (!uid) return jsonError("Missing uid.", 400);

    const notes = await listNoteDocuments(request, uid);
    return NextResponse.json({ notes });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to load notes.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as NotesPayload;
    if (!payload?.uid) return jsonError("Missing uid.", 400);
    if (!Array.isArray(payload.notes)) return jsonError("Missing notes array.", 400);

    const normalized = normalizeNotes(payload.notes);
    await Promise.all(normalized.map((note) => upsertNoteDocument(request, payload.uid, note)));
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save notes.";
    console.error("Notes API POST failed.", { message });
    return jsonError(message, 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid");
    if (!uid) return jsonError("Missing uid.", 400);

    await deleteAllNoteDocuments(request, uid);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to delete notes.");
  }
}
