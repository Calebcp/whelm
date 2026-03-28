import { NextRequest, NextResponse } from "next/server";
import { firestoreCleanupDatabaseIds, resolveFirestoreDatabaseId } from "@/lib/firestore-database";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const databaseId = resolveFirestoreDatabaseId();

type PlannedBlockDoc = {
  id: string;
  dateKey: string;
  title: string;
  note: string;
  attachmentCount?: number;
  tone?: string;
  durationMinutes: number;
  timeOfDay: string;
  sortOrder: number;
  createdAtISO: string;
  updatedAtISO: string;
  status: "active" | "completed";
  completedAtISO?: string;
};

type PlannedBlocksPayload = {
  uid: string;
  blocks: PlannedBlockDoc[];
};

type FirestoreDocumentResponse = {
  name?: string;
  fields?: {
    uid?: { stringValue?: string };
    blocksJson?: { stringValue?: string };
    updatedAtISO?: { stringValue?: string };
  };
};

const MIN_PLANNED_BLOCK_MINUTES = 15;
const MAX_PLANNED_BLOCK_MINUTES = 480;

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

function normalizeBlocks(blocks: PlannedBlockDoc[]) {
  return [...blocks]
    .filter((item) => item.id && item.dateKey && item.title)
    .map((item, index) => {
      const createdAtISO =
        typeof item.createdAtISO === "string" && item.createdAtISO
          ? item.createdAtISO
          : new Date().toISOString();
      const updatedAtISO =
        typeof item.updatedAtISO === "string" && item.updatedAtISO
          ? item.updatedAtISO
          : createdAtISO;

      return {
        id: item.id,
        dateKey: String(item.dateKey).slice(0, 10),
        title: String(item.title).slice(0, 80),
        note: String(item.note ?? "").slice(0, 280),
        attachmentCount: Math.max(0, Math.round(Number(item.attachmentCount) || 0)),
        tone: typeof item.tone === "string" && item.tone ? item.tone : undefined,
        durationMinutes: Math.min(
          MAX_PLANNED_BLOCK_MINUTES,
          Math.max(MIN_PLANNED_BLOCK_MINUTES, Number(item.durationMinutes) || 25),
        ),
        timeOfDay: String(item.timeOfDay || "09:00").slice(0, 5),
        sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
        createdAtISO,
        updatedAtISO,
        status: item.status === "completed" ? "completed" : "active",
        completedAtISO:
          item.status === "completed" && typeof item.completedAtISO === "string" && item.completedAtISO
            ? item.completedAtISO
            : undefined,
      };
    })
    .sort((a, b) =>
      a.dateKey === b.dateKey
        ? a.sortOrder - b.sortOrder || a.timeOfDay.localeCompare(b.timeOfDay)
        : a.dateKey.localeCompare(b.dateKey),
    );
}

function parseBlocksFromDocument(document: FirestoreDocumentResponse) {
  const raw = document.fields?.blocksJson?.stringValue;
  if (!raw) return [] as PlannedBlockDoc[];

  try {
    const parsed = JSON.parse(raw) as PlannedBlockDoc[];
    return Array.isArray(parsed) ? normalizeBlocks(parsed) : [];
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
  const response = await fetch(`${baseUrl}/userPlannedBlocks/${encodeURIComponent(uid)}?key=${apiKey}`, {
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
    throw new Error(body?.error?.message || body?.error?.status || "Failed to fetch planned blocks.");
  }

  return (await response.json()) as FirestoreDocumentResponse;
}

async function upsertDocument(request: NextRequest, payload: PlannedBlocksPayload) {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const baseUrl = firestoreDocumentsBaseUrl();
  const { apiKey } = requireConfig();
  const normalizedBlocks = normalizeBlocks(payload.blocks);
  const now = new Date().toISOString();

  const response = await fetch(
    `${baseUrl}/userPlannedBlocks/${encodeURIComponent(payload.uid)}?key=${apiKey}`,
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
          blocksJson: { stringValue: JSON.stringify(normalizedBlocks) },
          updatedAtISO: { stringValue: now },
        },
      }),
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to save planned blocks.");
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
      `${baseUrl}/userPlannedBlocks/${encodeURIComponent(uid)}?key=${apiKey}`,
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
        `Failed to delete planned blocks from Firestore database "${targetDatabaseId}".`;

      if (shouldIgnoreDeletionError(message)) {
        errors.push(`planned-blocks:${targetDatabaseId}:${message}`);
        continue;
      }

      throw new Error(message);
    }
  }

  if (errors.length === deletionDatabaseIds().length) {
    throw new Error("Unable to verify planned block deletion in either Firestore database.");
  }
}

export async function GET(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid");
    if (!uid) return jsonError("Missing uid.", 400);

    const document = await fetchDocument(request, uid);
    const blocks = document ? parseBlocksFromDocument(document) : [];
    return NextResponse.json({ blocks });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to load planned blocks.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as PlannedBlocksPayload;
    if (!payload.uid || typeof payload.uid !== "string") return jsonError("Missing uid.", 400);
    if (!Array.isArray(payload.blocks)) return jsonError("Missing blocks array.", 400);

    await upsertDocument(request, payload);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to save planned blocks.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid");
    if (!uid) return jsonError("Missing uid.", 400);

    await deleteDocument(request, uid);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to delete planned blocks.");
  }
}
