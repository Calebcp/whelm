import { NextRequest, NextResponse } from "next/server";

import { resolveFirestoreDatabaseId } from "@/lib/firestore-database";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const databaseId = resolveFirestoreDatabaseId();

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
};

type FirestoreListResponse = {
  documents?: FirestoreDocument[];
};

type FriendDoc = {
  friendUid: string;
  friendUsername: string;
  addedAtISO: string;
};

type FriendRequestDoc = {
  fromUid: string;
  fromUsername: string;
  sentAtISO: string;
};

type OutgoingFriendRequestDoc = {
  toUid: string;
  toUsername: string;
  sentAtISO: string;
};

type FriendWithXp = FriendDoc & {
  totalXp: number;
  currentStreak: number;
  weeklyXp: number;
};

function requireConfig() {
  if (!projectId || !apiKey) {
    throw new Error("Missing Firebase environment variables on the server.");
  }

  return { projectId, apiKey };
}

function firestoreDocumentsBaseUrl() {
  const { projectId } = requireConfig();
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
}

function getAuthHeader(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader : null;
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function decodeFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("mapValue" in value) {
    const fields = value.mapValue.fields ?? {};
    return Object.fromEntries(
      Object.entries(fields).map(([key, nested]) => [key, decodeFirestoreValue(nested)]),
    );
  }
  return null;
}

function encodeFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "object" && !Array.isArray(value)) {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, nested]) => [key, encodeFirestoreValue(nested)]),
        ),
      },
    };
  }
  throw new Error("Unsupported Firestore value.");
}

async function firestoreFetch<T>(request: NextRequest, path: string, init?: RequestInit): Promise<T> {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const { apiKey } = requireConfig();
  const response = await fetch(`${firestoreDocumentsBaseUrl()}/${path}?key=${apiKey}`, {
    ...init,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    throw new Error("__NOT_FOUND__");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Firestore request failed.");
  }

  return (await response.json()) as T;
}

async function getDocument(request: NextRequest, path: string): Promise<FirestoreDocument | null> {
  try {
    return await firestoreFetch<FirestoreDocument>(request, path, { method: "GET" });
  } catch (error) {
    if (error instanceof Error && error.message === "__NOT_FOUND__") {
      return null;
    }
    throw error;
  }
}

async function listDocuments(request: NextRequest, path: string): Promise<FirestoreDocument[]> {
  try {
    const result = await firestoreFetch<FirestoreListResponse>(request, path, { method: "GET" });
    return result.documents ?? [];
  } catch (error) {
    if (error instanceof Error && error.message === "__NOT_FOUND__") {
      return [];
    }
    throw error;
  }
}

async function patchDocument(
  request: NextRequest,
  path: string,
  fields: Record<string, FirestoreValue>,
  updateMask?: string[],
) {
  const query = updateMask?.length
    ? `&${updateMask.map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join("&")}`
    : "";
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");
  const { apiKey } = requireConfig();
  const response = await fetch(`${firestoreDocumentsBaseUrl()}/${path}?key=${apiKey}${query}`, {
    method: "PATCH",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to save Firestore document.");
  }
}

async function deleteDocument(request: NextRequest, path: string) {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");
  const { apiKey } = requireConfig();
  const response = await fetch(`${firestoreDocumentsBaseUrl()}/${path}?key=${apiKey}`, {
    method: "DELETE",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 404) return;
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to delete Firestore document.");
  }
}

function decodeFriend(document: FirestoreDocument): FriendDoc | null {
  const fields = document.fields ?? {};
  const friendUid = String(decodeFirestoreValue(fields.friendUid) ?? "");
  if (!friendUid) return null;
  return {
    friendUid,
    friendUsername: String(decodeFirestoreValue(fields.friendUsername) ?? "Whelm user"),
    addedAtISO: String(decodeFirestoreValue(fields.addedAtISO) ?? ""),
  };
}

function decodeIncomingRequest(document: FirestoreDocument): FriendRequestDoc | null {
  const fields = document.fields ?? {};
  const fromUid = String(decodeFirestoreValue(fields.fromUid) ?? "");
  if (!fromUid) return null;
  return {
    fromUid,
    fromUsername: String(decodeFirestoreValue(fields.fromUsername) ?? "Whelm user"),
    sentAtISO: String(decodeFirestoreValue(fields.sentAtISO) ?? ""),
  };
}

function decodeOutgoingRequest(document: FirestoreDocument): OutgoingFriendRequestDoc | null {
  const fields = document.fields ?? {};
  const toUid = String(decodeFirestoreValue(fields.toUid) ?? "");
  if (!toUid) return null;
  return {
    toUid,
    toUsername: String(decodeFirestoreValue(fields.toUsername) ?? "Whelm user"),
    sentAtISO: String(decodeFirestoreValue(fields.sentAtISO) ?? ""),
  };
}

async function getFriendWithXp(request: NextRequest, friend: FriendDoc): Promise<FriendWithXp> {
  const document = await getDocument(request, `leaderboardProfiles/${encodeURIComponent(friend.friendUid)}`);
  const fields = document?.fields ?? {};
  return {
    ...friend,
    totalXp: Number(decodeFirestoreValue(fields.totalXp) ?? 0),
    currentStreak: Number(decodeFirestoreValue(fields.currentStreak) ?? 0),
    weeklyXp: Number(decodeFirestoreValue(fields.weeklyXp) ?? 0),
  };
}

async function getNudgeCooldowns(request: NextRequest, uid: string): Promise<Record<string, string>> {
  const document = await getDocument(request, `userPreferences/${encodeURIComponent(uid)}`);
  const raw = decodeFirestoreValue(document?.fields?.nudgeCooldowns);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string",
    ),
  );
}

function isPermissionError(message: string) {
  return (
    message.includes("PERMISSION_DENIED") ||
    message.includes("permission-denied") ||
    message.includes("Missing or insufficient permissions")
  );
}

function normalizePermissionError(message: string) {
  if (message.startsWith("Friends permissions failed at ")) {
    return message;
  }
  if (
    isPermissionError(message)
  ) {
    return "Friends data is blocked by Firestore permissions. The feature now uses the server route, but the backend rules for these collections still need to allow the signed-in user path.";
  }
  return message;
}

async function loadRequiredSection<T>(
  label: string,
  loader: () => Promise<T>,
): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    const message = error instanceof Error ? error.message : `Failed to load ${label}.`;
    if (isPermissionError(message)) {
      throw new Error(`Friends permissions failed at ${label}.`);
    }
    throw error;
  }
}

async function loadOptionalSection<T>(
  loader: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid") ?? "";
    if (!uid) return jsonError("Missing uid.", 400);

    const [friendDocs, incomingRequests, outgoingRequests, nudgeCooldowns] = await Promise.all([
      loadRequiredSection("friendships", () =>
        listDocuments(request, `friendships/${encodeURIComponent(uid)}/friends`),
      ),
      loadRequiredSection("incoming requests", () =>
        listDocuments(request, `friendRequests/${encodeURIComponent(uid)}/incoming`),
      ),
      loadRequiredSection("outgoing requests", () =>
        listDocuments(request, `friendRequests/${encodeURIComponent(uid)}/outgoing`),
      ),
      loadOptionalSection(() => getNudgeCooldowns(request, uid), {}),
    ]);

    const friends = await Promise.all(
      friendDocs
        .map((document) => decodeFriend(document))
        .filter((friend): friend is FriendDoc => Boolean(friend))
        .map((friend) => getFriendWithXp(request, friend)),
    );

    return NextResponse.json({
      friends: friends.sort((a, b) => b.weeklyXp - a.weeklyXp),
      incomingRequests: incomingRequests
        .map((document) => decodeIncomingRequest(document))
        .filter((item): item is FriendRequestDoc => Boolean(item)),
      outgoingRequests: outgoingRequests
        .map((document) => decodeOutgoingRequest(document))
        .filter((item): item is OutgoingFriendRequestDoc => Boolean(item)),
      nudgeCooldowns,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? normalizePermissionError(error.message) : "Failed to load friends.";
    return jsonError(message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          action?: string;
          fromUid?: string;
          fromUsername?: string;
          toUid?: string;
          toUsername?: string;
          uid?: string;
          friendUid?: string;
          iso?: string;
        }
      | null;

    if (!body?.action) return jsonError("Missing action.", 400);

    if (body.action === "send") {
      const fromUid = body.fromUid ?? "";
      const fromUsername = body.fromUsername ?? "";
      const toUid = body.toUid ?? "";
      const toUsername = body.toUsername ?? "";
      if (!fromUid || !toUid || fromUid === toUid) {
        return jsonError("Invalid friend request target.", 400);
      }
      const sentAtISO = new Date().toISOString();
      await Promise.all([
        patchDocument(request, `friendRequests/${encodeURIComponent(toUid)}/incoming/${encodeURIComponent(fromUid)}`, {
          fromUid: encodeFirestoreValue(fromUid),
          fromUsername: encodeFirestoreValue(fromUsername),
          sentAtISO: encodeFirestoreValue(sentAtISO),
        }),
        patchDocument(request, `friendRequests/${encodeURIComponent(fromUid)}/outgoing/${encodeURIComponent(toUid)}`, {
          toUid: encodeFirestoreValue(toUid),
          toUsername: encodeFirestoreValue(toUsername),
          sentAtISO: encodeFirestoreValue(sentAtISO),
        }),
      ]);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "nudge") {
      const uid = body.uid ?? "";
      const friendUid = body.friendUid ?? "";
      const iso = body.iso ?? new Date().toISOString();
      if (!uid || !friendUid) return jsonError("Missing nudge target.", 400);
      const cooldowns = await getNudgeCooldowns(request, uid);
      cooldowns[friendUid] = iso;
      await patchDocument(
        request,
        `userPreferences/${encodeURIComponent(uid)}`,
        {
          nudgeCooldowns: encodeFirestoreValue(cooldowns),
        },
        ["nudgeCooldowns"],
      );
      return NextResponse.json({ ok: true });
    }

    return jsonError("Unsupported action.", 400);
  } catch (error: unknown) {
    const message = error instanceof Error ? normalizePermissionError(error.message) : "Failed to save friends state.";
    return jsonError(message);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          action?: string;
          myUid?: string;
          myUsername?: string;
          fromUid?: string;
          fromUsername?: string;
        }
      | null;

    if (!body?.action) return jsonError("Missing action.", 400);

    if (body.action === "accept") {
      const myUid = body.myUid ?? "";
      const myUsername = body.myUsername ?? "";
      const fromUid = body.fromUid ?? "";
      const fromUsername = body.fromUsername ?? "";
      if (!myUid || !fromUid) return jsonError("Missing request target.", 400);
      const now = new Date().toISOString();
      await Promise.all([
        patchDocument(request, `friendships/${encodeURIComponent(myUid)}/friends/${encodeURIComponent(fromUid)}`, {
          friendUid: encodeFirestoreValue(fromUid),
          friendUsername: encodeFirestoreValue(fromUsername),
          addedAtISO: encodeFirestoreValue(now),
        }),
        patchDocument(request, `friendships/${encodeURIComponent(fromUid)}/friends/${encodeURIComponent(myUid)}`, {
          friendUid: encodeFirestoreValue(myUid),
          friendUsername: encodeFirestoreValue(myUsername),
          addedAtISO: encodeFirestoreValue(now),
        }),
        deleteDocument(request, `friendRequests/${encodeURIComponent(myUid)}/incoming/${encodeURIComponent(fromUid)}`),
        deleteDocument(request, `friendRequests/${encodeURIComponent(fromUid)}/outgoing/${encodeURIComponent(myUid)}`),
        deleteDocument(request, `friendRequests/${encodeURIComponent(fromUid)}/incoming/${encodeURIComponent(myUid)}`),
        deleteDocument(request, `friendRequests/${encodeURIComponent(myUid)}/outgoing/${encodeURIComponent(fromUid)}`),
      ]);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "decline") {
      const myUid = body.myUid ?? "";
      const fromUid = body.fromUid ?? "";
      if (!myUid || !fromUid) return jsonError("Missing request target.", 400);
      await Promise.all([
        deleteDocument(request, `friendRequests/${encodeURIComponent(myUid)}/incoming/${encodeURIComponent(fromUid)}`),
        deleteDocument(request, `friendRequests/${encodeURIComponent(fromUid)}/outgoing/${encodeURIComponent(myUid)}`),
      ]);
      return NextResponse.json({ ok: true });
    }

    return jsonError("Unsupported action.", 400);
  } catch (error: unknown) {
    const message = error instanceof Error ? normalizePermissionError(error.message) : "Failed to update friends state.";
    return jsonError(message);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { myUid?: string; friendUid?: string }
      | null;
    const myUid = body?.myUid ?? "";
    const friendUid = body?.friendUid ?? "";
    if (!myUid || !friendUid) return jsonError("Missing friend uid.", 400);

    await Promise.all([
      deleteDocument(request, `friendships/${encodeURIComponent(myUid)}/friends/${encodeURIComponent(friendUid)}`),
      deleteDocument(request, `friendships/${encodeURIComponent(friendUid)}/friends/${encodeURIComponent(myUid)}`),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? normalizePermissionError(error.message) : "Failed to remove friend.";
    return jsonError(message);
  }
}
