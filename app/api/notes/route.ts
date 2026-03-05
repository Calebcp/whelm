import { NextRequest, NextResponse } from "next/server";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const databaseId = process.env.FIREBASE_DATABASE_ID?.trim() || "(default)";

type WorkspaceNote = {
  id: string;
  title: string;
  body: string;
  updatedAtISO: string;
  createdAtISO: string;
};

type NotesPayload = {
  uid: string;
  notes: WorkspaceNote[];
};

type FirestoreDocumentResponse = {
  fields?: {
    uid?: { stringValue?: string };
    notesJson?: { stringValue?: string };
    updatedAtISO?: { stringValue?: string };
  };
};

function requireConfig() {
  if (!projectId || !apiKey) {
    throw new Error("Missing Firebase environment variables on the server.");
  }

  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
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
      createdAtISO: note.createdAtISO,
      updatedAtISO: note.updatedAtISO,
    }))
    .sort((a, b) => (a.updatedAtISO < b.updatedAtISO ? 1 : -1));
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

  const baseUrl = requireConfig();
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

  const baseUrl = requireConfig();
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
