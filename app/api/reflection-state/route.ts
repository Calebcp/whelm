import { NextRequest, NextResponse } from "next/server";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const databaseId = process.env.FIREBASE_DATABASE_ID?.trim() || "(default)";

type ReflectionMirrorEntry = {
  id: string;
  dateKey: string;
  createdAtISO: string;
  updatedAtISO: string;
  tag: string;
  answers: Record<string, string>;
  source: "streak_save";
};

type ReflectionSickDaySave = {
  id: string;
  dateKey: string;
  claimedAtISO: string;
  reason: "sick";
};

type ReflectionPayload = {
  uid: string;
  mirrorEntries: ReflectionMirrorEntry[];
  sickDaySaves: ReflectionSickDaySave[];
  sickDaySaveDismissals: string[];
};

type FirestoreDocumentResponse = {
  fields?: {
    uid?: { stringValue?: string };
    mirrorEntriesJson?: { stringValue?: string };
    sickDaySavesJson?: { stringValue?: string };
    sickDaySaveDismissalsJson?: { stringValue?: string };
    updatedAtISO?: { stringValue?: string };
  };
};

function requireConfig() {
  if (!projectId || !apiKey) {
    throw new Error("Missing Firebase environment variables on the server.");
  }
  return { projectId, apiKey };
}

function firestoreDocumentsBaseUrl(targetDatabaseId = databaseId) {
  const { projectId } = requireConfig();
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${targetDatabaseId}/documents`;
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function getAuthHeader(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader : null;
}

function normalizeMirrorEntries(entries: ReflectionMirrorEntry[]) {
  if (!Array.isArray(entries)) return [] as ReflectionMirrorEntry[];
  return entries
    .filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.dateKey === "string" &&
        typeof item.createdAtISO === "string" &&
        typeof item.updatedAtISO === "string" &&
        typeof item.tag === "string" &&
        item.answers &&
        typeof item.answers === "object",
    )
    .map((item) => ({
      id: item.id,
      dateKey: item.dateKey.slice(0, 10),
      createdAtISO: item.createdAtISO,
      updatedAtISO: item.updatedAtISO,
      tag: item.tag.slice(0, 80),
      answers: Object.fromEntries(
        Object.entries(item.answers).map(([question, answer]) => [
          question.slice(0, 120),
          String(answer ?? "").slice(0, 2500),
        ]),
      ),
      source: "streak_save" as const,
    }))
    .sort((a, b) => (a.updatedAtISO < b.updatedAtISO ? 1 : -1));
}

function normalizeSickDaySaves(saves: ReflectionSickDaySave[]) {
  if (!Array.isArray(saves)) return [] as ReflectionSickDaySave[];
  return saves
    .filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.dateKey === "string" &&
        typeof item.claimedAtISO === "string" &&
        item.reason === "sick",
    )
    .map((item) => ({
      id: item.id,
      dateKey: item.dateKey.slice(0, 10),
      claimedAtISO: item.claimedAtISO,
      reason: "sick" as const,
    }))
    .sort((a, b) => (a.claimedAtISO < b.claimedAtISO ? 1 : -1));
}

function normalizeDismissals(dateKeys: string[]) {
  if (!Array.isArray(dateKeys)) return [] as string[];
  return [...new Set(dateKeys.filter((value) => typeof value === "string").map((value) => value.slice(0, 10)))];
}

function normalizePayload(payload: ReflectionPayload) {
  return {
    mirrorEntries: normalizeMirrorEntries(payload.mirrorEntries),
    sickDaySaves: normalizeSickDaySaves(payload.sickDaySaves),
    sickDaySaveDismissals: normalizeDismissals(payload.sickDaySaveDismissals),
  };
}

async function fetchDocument(
  request: NextRequest,
  uid: string,
): Promise<FirestoreDocumentResponse | null> {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const { apiKey } = requireConfig();
  const response = await fetch(
    `${firestoreDocumentsBaseUrl()}/userReflectionState/${encodeURIComponent(uid)}?key=${apiKey}`,
    {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to fetch reflection state.");
  }

  return (await response.json()) as FirestoreDocumentResponse;
}

function parseDocument(document: FirestoreDocumentResponse) {
  const mirrorEntries = document.fields?.mirrorEntriesJson?.stringValue;
  const sickDaySaves = document.fields?.sickDaySavesJson?.stringValue;
  const sickDaySaveDismissals = document.fields?.sickDaySaveDismissalsJson?.stringValue;

  return {
    mirrorEntries: normalizeMirrorEntries(mirrorEntries ? (JSON.parse(mirrorEntries) as ReflectionMirrorEntry[]) : []),
    sickDaySaves: normalizeSickDaySaves(sickDaySaves ? (JSON.parse(sickDaySaves) as ReflectionSickDaySave[]) : []),
    sickDaySaveDismissals: normalizeDismissals(
      sickDaySaveDismissals ? (JSON.parse(sickDaySaveDismissals) as string[]) : [],
    ),
  };
}

async function upsertDocument(request: NextRequest, payload: ReflectionPayload) {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const { apiKey } = requireConfig();
  const normalized = normalizePayload(payload);
  const now = new Date().toISOString();

  const response = await fetch(
    `${firestoreDocumentsBaseUrl()}/userReflectionState/${encodeURIComponent(payload.uid)}?key=${apiKey}`,
    {
      method: "PATCH",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        fields: {
          uid: { stringValue: payload.uid },
          mirrorEntriesJson: { stringValue: JSON.stringify(normalized.mirrorEntries) },
          sickDaySavesJson: { stringValue: JSON.stringify(normalized.sickDaySaves) },
          sickDaySaveDismissalsJson: { stringValue: JSON.stringify(normalized.sickDaySaveDismissals) },
          updatedAtISO: { stringValue: now },
        },
      }),
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to save reflection state.");
  }
}

async function deleteDocument(request: NextRequest, uid: string) {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const { apiKey } = requireConfig();
  const response = await fetch(
    `${firestoreDocumentsBaseUrl()}/userReflectionState/${encodeURIComponent(uid)}?key=${apiKey}`,
    {
      method: "DELETE",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) return;
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to delete reflection state.");
  }
}

export async function GET(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid");
    if (!uid) return jsonError("Missing uid.", 400);
    const document = await fetchDocument(request, uid);
    const state = document
      ? parseDocument(document)
      : { mirrorEntries: [], sickDaySaves: [], sickDaySaveDismissals: [] };
    return NextResponse.json(state);
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to load reflection state.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as ReflectionPayload;
    if (!payload.uid || typeof payload.uid !== "string") return jsonError("Missing uid.", 400);
    await upsertDocument(request, payload);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to save reflection state.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid");
    if (!uid) return jsonError("Missing uid.", 400);
    await deleteDocument(request, uid);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to delete reflection state.");
  }
}
