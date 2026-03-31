import { NextRequest, NextResponse } from "next/server";
import { resolveFirestoreDatabaseId } from "@/lib/firestore-database";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const databaseId = resolveFirestoreDatabaseId();

type PreferencesPayload = {
  uid: string;
  themeMode?: "dark" | "light";
  companionStyle?: "gentle" | "balanced" | "strict";
  backgroundSetting?: { kind: "default" } | { kind: "preset"; value: string } | { kind: "upload"; value: string };
  backgroundSkin?: {
    mode?: "solid" | "glass";
    dim?: number;
    surfaceOpacity?: number;
    blur?: number;
    imageFit?: "fill" | "fit";
  };
  proState?: {
    isPro?: boolean;
    source?: "preview" | "store" | "none";
  };
};

type FirestoreDocumentResponse = {
  fields?: {
    uid?: { stringValue?: string };
    preferencesJson?: { stringValue?: string };
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

function normalizePreferences(payload: Partial<PreferencesPayload>) {
  const backgroundSetting = payload.backgroundSetting;
  const backgroundSkin = payload.backgroundSkin;
  const proState = payload.proState;
  return {
    themeMode: payload.themeMode === "light" ? "light" : "dark",
    companionStyle:
      payload.companionStyle === "gentle" || payload.companionStyle === "strict"
        ? payload.companionStyle
        : "balanced",
    backgroundSetting:
      backgroundSetting?.kind === "preset" && typeof backgroundSetting.value === "string"
        ? backgroundSetting
        : backgroundSetting?.kind === "upload" && typeof backgroundSetting.value === "string"
          ? backgroundSetting
          : { kind: "default" as const },
    backgroundSkin: {
      mode: backgroundSkin?.mode === "solid" ? "solid" : "glass",
      dim: Math.min(0.96, Math.max(0.02, Number(backgroundSkin?.dim) || 0.58)),
      surfaceOpacity: Math.min(0.98, Math.max(0.08, Number(backgroundSkin?.surfaceOpacity) || 0.72)),
      blur: Math.min(40, Math.max(0, Number(backgroundSkin?.blur) || 18)),
      imageFit: backgroundSkin?.imageFit === "fill" ? "fill" : "fit",
    },
    proState: {
      isPro: typeof proState?.isPro === "boolean" ? proState.isPro : false,
      source: proState?.source === "store" || proState?.source === "preview" ? proState.source : "none",
    },
  };
}

async function fetchDocument(request: NextRequest, uid: string): Promise<FirestoreDocumentResponse | null> {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const { apiKey } = requireConfig();
  const response = await fetch(
    `${firestoreDocumentsBaseUrl()}/userPreferences/${encodeURIComponent(uid)}?key=${apiKey}`,
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
    throw new Error(body?.error?.message || body?.error?.status || "Failed to fetch preferences.");
  }

  return (await response.json()) as FirestoreDocumentResponse;
}

async function upsertDocument(request: NextRequest, payload: PreferencesPayload) {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const { apiKey } = requireConfig();
  const normalized = normalizePreferences(payload);
  const now = new Date().toISOString();

  const response = await fetch(
    `${firestoreDocumentsBaseUrl()}/userPreferences/${encodeURIComponent(payload.uid)}?key=${apiKey}`,
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
          preferencesJson: { stringValue: JSON.stringify(normalized) },
          updatedAtISO: { stringValue: now },
        },
      }),
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to save preferences.");
  }
}

async function deleteDocument(request: NextRequest, uid: string) {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const { apiKey } = requireConfig();
  const response = await fetch(
    `${firestoreDocumentsBaseUrl()}/userPreferences/${encodeURIComponent(uid)}?key=${apiKey}`,
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
    throw new Error(body?.error?.message || body?.error?.status || "Failed to delete preferences.");
  }
}

export async function GET(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid");
    if (!uid) return jsonError("Missing uid.", 400);
    const document = await fetchDocument(request, uid);
    const raw = document?.fields?.preferencesJson?.stringValue;
    let parsed: unknown = null;
    if (raw) {
      try { parsed = JSON.parse(raw); } catch (err) { console.error("[whelm] preferences/route: failed to parse preferencesJson — using defaults", err); }
    }
    return NextResponse.json(parsed && typeof parsed === "object" ? parsed : normalizePreferences({}));
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to load preferences.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as PreferencesPayload;
    if (!payload.uid || typeof payload.uid !== "string") return jsonError("Missing uid.", 400);
    await upsertDocument(request, payload);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to save preferences.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get("uid");
    if (!uid) return jsonError("Missing uid.", 400);
    await deleteDocument(request, uid);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to delete preferences.");
  }
}
