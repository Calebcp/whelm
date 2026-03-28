import { NextRequest, NextResponse } from "next/server";
import { resolveFirestoreDatabaseId } from "@/lib/firestore-database";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const databaseId = resolveFirestoreDatabaseId();

type ReviewOutcome = "forgot" | "hard" | "good" | "easy";
type CardZone = "learning" | "practice" | "mastery" | "weak";
type CardLevel = 1 | 2 | 3 | 4;

type WhelCard = {
  id: string;
  noteId: string;
  front: string;
  back: string;
  level: CardLevel;
  zone: CardZone;
  createdAt: number;
  lastReviewedAt: number | null;
  nextReviewAt: number;
  reviewCount: number;
  correctCount: number;
  lastOutcome: ReviewOutcome | null;
  easeFactor?: number;
  interval?: number;
  repetitions?: number;
  dueDate?: number;
  lastReviewed?: number | null;
};

type CardsPayload = {
  uid: string;
  cards: WhelCard[];
};

type FirestoreDocumentResponse = {
  name?: string;
  fields?: {
    uid?: { stringValue?: string };
    cardsJson?: { stringValue?: string };
    updatedAtISO?: { stringValue?: string };
  };
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

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function getAuthHeader(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader : null;
}

function normalizeCards(cards: WhelCard[]) {
  if (!Array.isArray(cards)) return [] as WhelCard[];

  return cards
    .filter((card) => card && typeof card.id === "string" && typeof card.noteId === "string")
    .map((card): WhelCard => ({
      id: String(card.id).slice(0, 200),
      noteId: String(card.noteId).slice(0, 200),
      front: String(card.front ?? "").slice(0, 500),
      back: String(card.back ?? "").slice(0, 4000),
      level: [1, 2, 3, 4].includes(Number(card.level)) ? card.level : 1,
      zone:
        card.zone === "practice" || card.zone === "mastery" || card.zone === "weak"
          ? card.zone
          : "learning",
      createdAt: Number.isFinite(card.createdAt) ? Math.round(card.createdAt) : Date.now(),
      lastReviewedAt:
        card.lastReviewedAt === null || Number.isFinite(card.lastReviewedAt)
          ? card.lastReviewedAt
          : null,
      nextReviewAt: Number.isFinite(card.nextReviewAt) ? Math.round(card.nextReviewAt) : Date.now(),
      reviewCount: Math.max(0, Math.round(Number(card.reviewCount) || 0)),
      correctCount: Math.max(0, Math.round(Number(card.correctCount) || 0)),
      lastOutcome:
        card.lastOutcome === "forgot" ||
        card.lastOutcome === "hard" ||
        card.lastOutcome === "good" ||
        card.lastOutcome === "easy"
          ? card.lastOutcome
          : null,
      easeFactor:
        Number.isFinite(Number(card.easeFactor)) && Number(card.easeFactor) >= 1.3
          ? Number(card.easeFactor)
          : 2.5,
      interval:
        Number.isFinite(Number(card.interval)) && Number(card.interval) >= 1
          ? Math.round(Number(card.interval))
          : 1,
      repetitions: Math.max(0, Math.round(Number(card.repetitions) || 0)),
      dueDate: Number.isFinite(Number(card.dueDate)) ? Math.round(Number(card.dueDate)) : Date.now(),
      lastReviewed:
        card.lastReviewed === null || Number.isFinite(Number(card.lastReviewed))
          ? (card.lastReviewed ?? null)
          : null,
    }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

function parseCardsFromDocument(document: FirestoreDocumentResponse) {
  const raw = document.fields?.cardsJson?.stringValue;
  if (!raw) return [] as WhelCard[];

  try {
    const parsed = JSON.parse(raw) as WhelCard[];
    return Array.isArray(parsed) ? normalizeCards(parsed) : [];
  } catch (err) {
    console.error("[whelm] cards/route: failed to parse cardsJson — returning empty to avoid data loss", err);
    return [];
  }
}

async function fetchDocument(request: NextRequest, uid: string): Promise<FirestoreDocumentResponse | null> {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const baseUrl = firestoreDocumentsBaseUrl();
  const { apiKey } = requireConfig();
  const response = await fetch(`${baseUrl}/userCards/${encodeURIComponent(uid)}?key=${apiKey}`, {
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
    throw new Error(body?.error?.message || body?.error?.status || "Failed to fetch cards.");
  }

  return (await response.json()) as FirestoreDocumentResponse;
}

async function upsertDocument(request: NextRequest, payload: CardsPayload) {
  const authHeader = getAuthHeader(request);
  if (!authHeader) throw new Error("Missing Firebase auth token.");

  const baseUrl = firestoreDocumentsBaseUrl();
  const { apiKey } = requireConfig();
  const incomingCards = normalizeCards(payload.cards);
  const existingDocument = await fetchDocument(request, payload.uid);
  const existingCards = existingDocument ? parseCardsFromDocument(existingDocument) : [];
  const normalizedCards = normalizeCards([...existingCards, ...incomingCards]);
  const now = new Date().toISOString();

  const response = await fetch(`${baseUrl}/userCards/${encodeURIComponent(payload.uid)}?key=${apiKey}`, {
    method: "PATCH",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      fields: {
        uid: { stringValue: payload.uid },
        cardsJson: { stringValue: JSON.stringify(normalizedCards) },
        updatedAtISO: { stringValue: now },
      },
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    const message = body?.error?.message || body?.error?.status || "Failed to save cards.";
    console.error("Cards Firestore write failed.", {
      uid: payload.uid,
      status: response.status,
      message,
    });
    throw new Error(message);
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = getAuthHeader(request);
    if (!authHeader) return jsonError("Missing Firebase auth token.", 401);

    const uid = request.nextUrl.searchParams.get("uid");
    if (!uid) return jsonError("Missing uid.", 400);

    const document = await fetchDocument(request, uid);
    const cards = document ? parseCardsFromDocument(document) : [];
    return NextResponse.json({ cards });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to load cards.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = getAuthHeader(request);
    if (!authHeader) return jsonError("Missing Firebase auth token.", 401);

    const payload = (await request.json()) as CardsPayload;
    if (!payload?.uid) return jsonError("Missing uid.", 400);
    if (!Array.isArray(payload.cards)) return jsonError("Missing cards array.", 400);

    await upsertDocument(request, payload);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save cards.";
    console.error("Cards API POST failed.", { message });
    return jsonError(message, 500);
  }
}
