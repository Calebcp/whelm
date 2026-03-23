import { NextRequest, NextResponse } from "next/server";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const databaseId = process.env.FIREBASE_DATABASE_ID?.trim() || "(default)";

type WorkspaceNote = {
  id: string;
  title: string;
  body: string;
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

type NotesPayload = {
  uid: string;
  notes: WorkspaceNote[];
};

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

  return {
    apiKey,
    projectId,
  };
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

function normalizeNotes(notes: WorkspaceNote[]) {
  return [...notes]
    .filter((note) => note.id && typeof note.title === "string" && typeof note.body === "string")
    .map((note) => ({
      id: note.id,
      title: note.title.slice(0, 200),
      body: note.body.slice(0, 20000),
      color:
        typeof note.color === "string" && note.color
          ? legacyColorMap[note.color] || note.color
          : "#e7e5e4",
      shellColor:
        typeof (note as WorkspaceNote).shellColor === "string" && (note as WorkspaceNote).shellColor
          ? legacyColorMap[(note as WorkspaceNote).shellColor] || (note as WorkspaceNote).shellColor
          : "#fff7d6",
      surfaceStyle:
        (note as WorkspaceNote).surfaceStyle === "airy" ? "airy" : "solid",
      isPinned: typeof note.isPinned === "boolean" ? note.isPinned : false,
      fontFamily:
        typeof note.fontFamily === "string" && note.fontFamily
          ? note.fontFamily
          : "Avenir Next",
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
    }))
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return a.updatedAtISO < b.updatedAtISO ? 1 : -1;
    });
}

function parseNotesFromDocument(document: FirestoreDocumentResponse) {
  const raw = document.fields?.notesJson?.stringValue;
  if (!raw) return [] as WorkspaceNote[];

  try {
    const parsed = JSON.parse(raw) as WorkspaceNote[];
    return Array.isArray(parsed) ? normalizeNotes(parsed) : [];
  } catch {
    return [];
  }
}

async function fetchDocument(
  request: NextRequest,
  uid: string,
): Promise<FirestoreDocumentResponse | null> {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const baseUrl = firestoreDocumentsBaseUrl();
  const { apiKey } = requireConfig();
  const response = await fetch(`${baseUrl}/userNotes/${encodeURIComponent(uid)}?key=${apiKey}`, {
    method: "GET",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to fetch notes.");
  }

  return (await response.json()) as FirestoreDocumentResponse;
}

async function upsertDocument(request: NextRequest, payload: NotesPayload) {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const baseUrl = firestoreDocumentsBaseUrl();
  const { apiKey } = requireConfig();
  const normalizedNotes = normalizeNotes(payload.notes);
  const now = new Date().toISOString();

  const response = await fetch(`${baseUrl}/userNotes/${encodeURIComponent(payload.uid)}?key=${apiKey}`, {
    method: "PATCH",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      fields: {
        uid: { stringValue: payload.uid },
        notesJson: { stringValue: JSON.stringify(normalizedNotes) },
        updatedAtISO: { stringValue: now },
      },
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to save notes.");
  }
}

async function deleteDocument(request: NextRequest, uid: string) {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const { apiKey } = requireConfig();
  const errors: string[] = [];

  for (const targetDatabaseId of deletionDatabaseIds()) {
    const baseUrl = firestoreDocumentsBaseUrl(targetDatabaseId);
    const response = await fetch(
      `${baseUrl}/userNotes/${encodeURIComponent(uid)}?key=${apiKey}`,
      {
        method: "DELETE",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
    );

    if (response.status === 404) continue;

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string; status?: string } }
        | null;
      const message =
        body?.error?.message ||
        body?.error?.status ||
        `Failed to delete notes from Firestore database "${targetDatabaseId}".`;

      if (shouldIgnoreDeletionError(message)) {
        errors.push(`notes:${targetDatabaseId}:${message}`);
        continue;
      }

      throw new Error(message);
    }
  }

  if (errors.length === deletionDatabaseIds().length) {
    throw new Error("Unable to verify note deletion in either Firestore database.");
  }
}

export async function GET(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid");
    if (!uid) return jsonError("Missing uid.", 400);

    const document = await fetchDocument(request, uid);
    const notes = document ? parseNotesFromDocument(document) : [];
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

    await upsertDocument(request, payload);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to save notes.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid");
    if (!uid) return jsonError("Missing uid.", 400);

    await deleteDocument(request, uid);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to delete notes.");
  }
}
