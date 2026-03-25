import { auth } from "@/lib/firebase";
import { resolveApiUrl } from "@/lib/api-base";

export type CardZone = "learning" | "practice" | "mastery" | "weak";
export type CardLevel = 1 | 2 | 3 | 4;
export type ReviewOutcome = "forgot" | "hard" | "easy";

export interface WhelCard {
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
}

const INTERVALS: Record<CardLevel, Record<ReviewOutcome, number>> = {
  1: { forgot: 0, hard: 1, easy: 24 },
  2: { forgot: 0, hard: 6, easy: 72 },
  3: { forgot: 1, hard: 24, easy: 168 },
  4: { forgot: 6, hard: 72, easy: 336 },
};

function storageKey(uid: string) {
  return `whelm_cards_${uid}`;
}

function clampLevel(level: number): CardLevel {
  return Math.min(4, Math.max(1, Math.round(level))) as CardLevel;
}

function cardTimestamp(card: WhelCard) {
  return card.lastReviewedAt ?? card.createdAt;
}

function normalizeCard(input: WhelCard): WhelCard {
  const level = clampLevel(input.level);
  const lastOutcome =
    input.lastOutcome === "forgot" || input.lastOutcome === "hard" || input.lastOutcome === "easy"
      ? input.lastOutcome
      : null;

  const normalized = {
    id: String(input.id ?? ""),
    noteId: String(input.noteId ?? ""),
    front: String(input.front ?? "").slice(0, 500),
    back: String(input.back ?? "").slice(0, 4000),
    level,
    zone: "learning" as CardZone,
    createdAt: Number.isFinite(input.createdAt) ? input.createdAt : Date.now(),
    lastReviewedAt:
      input.lastReviewedAt === null || Number.isFinite(input.lastReviewedAt)
        ? input.lastReviewedAt
        : null,
    nextReviewAt: Number.isFinite(input.nextReviewAt) ? input.nextReviewAt : Date.now(),
    reviewCount: Math.max(0, Math.round(Number(input.reviewCount) || 0)),
    correctCount: Math.max(0, Math.round(Number(input.correctCount) || 0)),
    lastOutcome,
  };

  return {
    ...normalized,
    zone: deriveZone(normalized),
  };
}

function normalizeCards(cards: WhelCard[]) {
  if (!Array.isArray(cards)) return [] as WhelCard[];

  const merged = new Map<string, WhelCard>();
  for (const candidate of cards) {
    if (!candidate || typeof candidate.id !== "string") continue;
    const normalized = normalizeCard(candidate);
    const existing = merged.get(normalized.id);
    if (
      !existing ||
      cardTimestamp(normalized) > cardTimestamp(existing) ||
      (cardTimestamp(normalized) === cardTimestamp(existing) &&
        normalized.reviewCount >= existing.reviewCount)
    ) {
      merged.set(normalized.id, normalized);
    }
  }

  return [...merged.values()].sort((left, right) => left.createdAt - right.createdAt);
}

function readLocalCards(uid: string) {
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    const parsed = raw ? (JSON.parse(raw) as WhelCard[]) : [];
    return normalizeCards(parsed);
  } catch {
    return [] as WhelCard[];
  }
}

function writeLocalCards(uid: string, cards: WhelCard[]) {
  window.localStorage.setItem(storageKey(uid), JSON.stringify(normalizeCards(cards)));
}

async function authorizedCardsRequest(uid: string, input: string, init: RequestInit, timeoutMs = 12000) {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) {
    throw new Error("Your login session is missing. Sign in again.");
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const token = await user.getIdToken();

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || response.statusText || "Cards request failed.");
    }

    return response;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function deriveZone(card: WhelCard): CardZone {
  if (card.lastOutcome === "forgot") return "weak";
  if (card.level === 1) return "learning";
  if (card.level === 4) return "mastery";
  return "practice";
}

export function applyReview(card: WhelCard, outcome: ReviewOutcome): WhelCard {
  const now = Date.now();
  const level =
    outcome === "easy"
      ? clampLevel(card.level + 1)
      : outcome === "forgot"
        ? clampLevel(card.level - 1)
        : card.level;
  const intervalHours = INTERVALS[level][outcome];
  const next = {
    ...card,
    level,
    lastOutcome: outcome,
    lastReviewedAt: now,
    nextReviewAt: now + intervalHours * 60 * 60 * 1000,
    reviewCount: card.reviewCount + 1,
    correctCount: card.correctCount + (outcome === "forgot" ? 0 : 1),
  };

  return {
    ...next,
    zone: deriveZone(next),
  };
}

export function getCardsForReview(cards: WhelCard[]) {
  const zoneRank: Record<CardZone, number> = {
    weak: 0,
    learning: 1,
    practice: 2,
    mastery: 3,
  };

  return normalizeCards(cards)
    .filter((card) => card.nextReviewAt <= Date.now())
    .sort((left, right) => {
      const zoneDifference = zoneRank[left.zone] - zoneRank[right.zone];
      if (zoneDifference !== 0) return zoneDifference;
      return left.nextReviewAt - right.nextReviewAt || left.createdAt - right.createdAt;
    });
}

export function createCard(noteId: string, front: string, back: string): WhelCard {
  const now = Date.now();
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${now}-${Math.random().toString(16).slice(2)}`,
    noteId,
    front: front.trim().slice(0, 500),
    back: back.trim().slice(0, 4000),
    level: 1,
    zone: "learning",
    createdAt: now,
    lastReviewedAt: null,
    nextReviewAt: now,
    reviewCount: 0,
    correctCount: 0,
    lastOutcome: null,
  };
}

export async function loadCards(uid: string): Promise<WhelCard[]> {
  const localCards = readLocalCards(uid);

  try {
    const response = await authorizedCardsRequest(
      uid,
      resolveApiUrl(`/api/cards?uid=${encodeURIComponent(uid)}`),
      { method: "GET" },
    );
    const body = (await response.json()) as { cards?: WhelCard[] };
    const cloudCards = Array.isArray(body.cards) ? normalizeCards(body.cards) : [];
    const mergedCards = normalizeCards([...cloudCards, ...localCards]);
    writeLocalCards(uid, mergedCards);
    return mergedCards;
  } catch {
    return localCards;
  }
}

export async function saveCards(uid: string, cards: WhelCard[]): Promise<void> {
  const normalized = normalizeCards(cards);
  writeLocalCards(uid, normalized);

  try {
    await authorizedCardsRequest(uid, resolveApiUrl("/api/cards"), {
      method: "POST",
      body: JSON.stringify({
        uid,
        cards: normalized,
      }),
    });
  } catch (error) {
    console.error("Cards sync failed. Local cards remain the source of truth.", error);
  }
}
