import { NextRequest, NextResponse } from "next/server";
import { firestoreCleanupDatabaseIds, resolveFirestoreDatabaseId } from "@/lib/firestore-database";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const databaseId = resolveFirestoreDatabaseId();

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
  return firestoreCleanupDatabaseIds();
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

function attachmentToValue(attachment: NoteAttachment): FirestoreFieldValue {
  return {
    mapValue: {
      fields: {
        id: { stringValue: attachment.id },
        name: { stringValue: attachment.name },
        mimeType: { stringValue: attachment.mimeType },
        sizeBytes: { integerValue: String(attachment.sizeBytes) },
        kind: { stringValue: attachment.kind },
        storagePath: { stringValue: attachment.storagePath },
        downloadUrl: { stringValue: attachment.downloadUrl },
        uploadedAtISO: { stringValue: attachment.uploadedAtISO },
      },
    },
  };
}

function attachmentsToFieldValue(attachments: NoteAttachment[]): FirestoreFieldValue {
  return {
    arrayValue: {
      values: normalizeAttachments(attachments).map(attachmentToValue),
    },
  };
}

function attachmentsFromFieldValue(value: FirestoreFieldValue | undefined): NoteAttachment[] {
  const rawValues = (value as FirestoreArrayValue | undefined)?.arrayValue?.values ?? [];
  return normalizeAttachments(
    rawValues
      .map((entry) => {
        const fields = (entry as FirestoreMapValue)?.mapValue?.fields;
        if (!fields) return null;
        return {
          id: str(fields.id),
          name: str(fields.name),
          mimeType: str(fields.mimeType),
          sizeBytes: int(fields.sizeBytes),
          kind: str(fields.kind, "other") as NoteAttachment["kind"],
          storagePath: str(fields.storagePath),
          downloadUrl: str(fields.downloadUrl),
          uploadedAtISO: str(fields.uploadedAtISO),
        } satisfies NoteAttachment;
      })
      .filter((attachment): attachment is NoteAttachment => Boolean(attachment)),
  );
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
    attachments: attachmentsToFieldValue(note.attachments),
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
    attachments: attachmentsFromFieldValue(f.attachments),
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

function mergeAttachments(first: WorkspaceNote["attachments"], second: WorkspaceNote["attachments"]) {
  const merged = new Map<string, NoteAttachment>();

  for (const attachment of normalizeAttachments(second)) {
    merged.set(attachment.id, attachment);
  }

  for (const attachment of normalizeAttachments(first)) {
    const existing = merged.get(attachment.id);
    if (!existing || existing.uploadedAtISO < attachment.uploadedAtISO) {
      merged.set(attachment.id, attachment);
    }
  }

  return normalizeAttachments([...merged.values()]);
}

function pickPreferredTitle(newer: WorkspaceNote, older: WorkspaceNote) {
  const newerTitle = newer.title.trim();
  const olderTitle = older.title.trim();
  if (!newerTitle && olderTitle) return older.title;
  if (newerTitle === "Untitled note" && olderTitle && olderTitle !== "Untitled note") {
    return older.title;
  }
  return newer.title;
}

function isEffectivelyEmptyNoteBody(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]*>/g, "")
    .trim().length === 0;
}

function pickPreferredBody(newer: WorkspaceNote, older: WorkspaceNote) {
  const newerBodyEmpty = isEffectivelyEmptyNoteBody(newer.body);
  const olderBodyEmpty = isEffectivelyEmptyNoteBody(older.body);
  if (newerBodyEmpty && !olderBodyEmpty) return older.body;
  return newer.body;
}

function mergeNoteVersions(first: WorkspaceNote, second: WorkspaceNote) {
  const [newer, older] =
    first.updatedAtISO >= second.updatedAtISO ? [first, second] : [second, first];

  return normalizeNotes([
    {
      ...older,
      ...newer,
      title: pickPreferredTitle(newer, older),
      body: pickPreferredBody(newer, older),
      attachments: mergeAttachments(newer.attachments, older.attachments),
      createdAtISO: older.createdAtISO || newer.createdAtISO,
      updatedAtISO: newer.updatedAtISO >= older.updatedAtISO ? newer.updatedAtISO : older.updatedAtISO,
    },
  ])[0];
}

function mergeNotesPreferNewest(primary: WorkspaceNote[], secondary: WorkspaceNote[]) {
  const merged = new Map<string, WorkspaceNote>();

  for (const note of secondary) {
    merged.set(note.id, note);
  }

  for (const note of primary) {
    const existing = merged.get(note.id);
    if (!existing) {
      merged.set(note.id, note);
      continue;
    }
    merged.set(note.id, mergeNoteVersions(existing, note));
  }

  return normalizeNotes([...merged.values()]);
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
  const legacyDocument = await fetchLegacyDocument(request, uid).catch(() => null);
  const legacyNotes = legacyDocument ? parseLegacyNotes(legacyDocument) : [];

  if (response.status === 404) return legacyNotes;

  if (!response.ok) {
    return legacyNotes;
  }

  const body = (await response.json()) as FirestoreListResponse;
  const subcollectionNotes = (body.documents ?? [])
    .map(noteFromDocument)
    .filter((n): n is WorkspaceNote => n !== null);

  return mergeNotesPreferNewest(legacyNotes, subcollectionNotes);
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
  if (errors.length > 0) {
    console.error("[whelm] notes/route DELETE: partial deletion failures:", errors);
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
    const existingNotes = await listNoteDocuments(request, payload.uid);
    const merged = mergeNotesPreferNewest(normalized, existingNotes);
    await Promise.all(merged.map((note) => upsertNoteDocument(request, payload.uid, note)));
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
