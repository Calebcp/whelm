import { NextRequest, NextResponse } from "next/server";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

type SessionDoc = {
  uid: string;
  completedAtISO: string;
  minutes: number;
  category?: "misc" | "language" | "software";
  note?: string;
  noteSavedAtISO?: string;
};

type FirestoreDocument = {
  fields?: Record<string, FirestoreValue>;
};

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { nullValue: null };

type RunQueryResponse = {
  document?: FirestoreDocument;
};

function requireConfig() {
  if (!projectId || !apiKey) {
    throw new Error("Missing Firebase environment variables on the server.");
  }

  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

function getAuthHeader(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader;
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function encodeSession(session: SessionDoc) {
  return {
    fields: {
      uid: { stringValue: session.uid },
      completedAtISO: { stringValue: session.completedAtISO },
      minutes: { integerValue: String(session.minutes) },
      category: { stringValue: session.category ?? "misc" },
      note: { stringValue: session.note ?? "" },
      noteSavedAtISO: { stringValue: session.noteSavedAtISO ?? "" },
    },
  };
}

function readString(fields: Record<string, FirestoreValue>, key: string, fallback = "") {
  const value = fields[key];
  return value && "stringValue" in value ? value.stringValue : fallback;
}

function readInteger(fields: Record<string, FirestoreValue>, key: string, fallback = 0) {
  const value = fields[key];
  return value && "integerValue" in value ? Number(value.integerValue) : fallback;
}

function decodeSession(document: FirestoreDocument): SessionDoc | null {
  if (!document.fields) return null;

  const category = readString(document.fields, "category", "misc");
  const note = readString(document.fields, "note");
  const noteSavedAtISO = readString(document.fields, "noteSavedAtISO");

  return {
    uid: readString(document.fields, "uid"),
    completedAtISO: readString(document.fields, "completedAtISO"),
    minutes: readInteger(document.fields, "minutes", 25),
    category:
      category === "language" || category === "software" || category === "misc"
        ? category
        : "misc",
    note: note || undefined,
    noteSavedAtISO: noteSavedAtISO || undefined,
  };
}

async function firestoreRequest(
  request: NextRequest,
  input: string,
  init: RequestInit,
) {
  const authHeader = getAuthHeader(request);

  if (!authHeader) {
    return jsonError("Missing Firebase auth token.", 401);
  }

  const response = await fetch(input, {
    ...init,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;

    return jsonError(
      body?.error?.message || body?.error?.status || "Firestore request failed.",
      response.status,
    );
  }

  return response;
}

export async function GET(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid");

    if (!uid) {
      return jsonError("Missing uid.", 400);
    }

    const baseUrl = requireConfig();
    const response = await firestoreRequest(
      request,
      `${baseUrl}:runQuery?key=${apiKey}`,
      {
        method: "POST",
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "sessions" }],
            where: {
              fieldFilter: {
                field: { fieldPath: "uid" },
                op: "EQUAL",
                value: { stringValue: uid },
              },
            },
          },
        }),
      },
    );

    if (response instanceof NextResponse) return response;

    const rows = (await response.json()) as RunQueryResponse[];
    const sessions = rows
      .map((row) => (row.document ? decodeSession(row.document) : null))
      .filter((session): session is SessionDoc => Boolean(session))
      .sort((a, b) => (a.completedAtISO < b.completedAtISO ? 1 : -1));

    return NextResponse.json({ sessions });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to load sessions.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = (await request.json()) as SessionDoc;

    if (!session?.uid || !session?.completedAtISO || typeof session.minutes !== "number") {
      return jsonError("Invalid session payload.", 400);
    }

    const baseUrl = requireConfig();
    const response = await firestoreRequest(
      request,
      `${baseUrl}/sessions?key=${apiKey}`,
      {
        method: "POST",
        body: JSON.stringify(encodeSession(session)),
      },
    );

    if (response instanceof NextResponse) return response;

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to save session.");
  }
}
