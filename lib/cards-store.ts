import { auth } from "@/lib/firebase";
import { resolveApiUrl } from "@/lib/api-base";

export type CardZone = "learning" | "practice" | "mastery" | "weak";
export type CardLevel = 1 | 2 | 3 | 4;
export type ReviewOutcome = "forgot" | "hard" | "good" | "easy";

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
  easeFactor: number;
  interval: number;
  repetitions: number;
  dueDate: number;
  lastReviewed: number | null;
}


const SM2_RATING: Record<ReviewOutcome, number> = {
  forgot: 1,
  hard: 2,
  good: 4,
  easy: 5,
};

function applySM2(
  card: WhelCard,
  outcome: ReviewOutcome,
): Pick<WhelCard, "easeFactor" | "interval" | "repetitions" | "dueDate" | "lastReviewed"> {
  const now = Date.now();
  const rating = SM2_RATING[outcome];
  let { easeFactor, interval, repetitions } = card;

  if (rating < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
    easeFactor = easeFactor + 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02);
    easeFactor = Math.max(1.3, easeFactor);
  }

  const dueDate = now + interval * 24 * 60 * 60 * 1000;
  return { easeFactor, interval, repetitions, dueDate, lastReviewed: now };
}

function storageKey(uid: string) {
  return `whelm_cards_${uid}`;
}

function legacyStorageKey(uid: string) {
  return `whelm:cards:${uid}`;
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
    input.lastOutcome === "forgot" ||
    input.lastOutcome === "hard" ||
    input.lastOutcome === "good" ||
    input.lastOutcome === "easy"
      ? input.lastOutcome
      : null;

  const raw = input as unknown as Record<string, unknown>;
  const nextReviewAt = Number.isFinite(input.nextReviewAt) ? input.nextReviewAt : Date.now();

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
    nextReviewAt,
    reviewCount: Math.max(0, Math.round(Number(input.reviewCount) || 0)),
    correctCount: Math.max(0, Math.round(Number(input.correctCount) || 0)),
    lastOutcome,
    easeFactor: Number.isFinite(Number(raw.easeFactor)) && Number(raw.easeFactor) >= 1.3 ? Number(raw.easeFactor) : 2.5,
    interval: Number.isFinite(Number(raw.interval)) && Number(raw.interval) >= 1 ? Math.round(Number(raw.interval)) : 1,
    repetitions: Number.isFinite(Number(raw.repetitions)) ? Math.max(0, Math.round(Number(raw.repetitions))) : 0,
    dueDate: Number.isFinite(Number(raw.dueDate)) ? Number(raw.dueDate) : nextReviewAt,
    lastReviewed: raw.lastReviewed === null || Number.isFinite(Number(raw.lastReviewed)) ? (raw.lastReviewed as number | null) : null,
  };

  return {
    ...normalized,
    zone: deriveZone(normalized),
  };
}

export function normalizeCards(cards: WhelCard[]) {
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

export function readLocalCards(uid: string) {
  try {
    const raw = window.localStorage.getItem(storageKey(uid)) ?? window.localStorage.getItem(legacyStorageKey(uid));
    const parsed = raw ? (JSON.parse(raw) as WhelCard[]) : [];
    return normalizeCards(parsed);
  } catch {
    return [] as WhelCard[];
  }
}

function writeLocalCards(uid: string, cards: WhelCard[]) {
  const normalized = JSON.stringify(normalizeCards(cards));
  try {
    window.localStorage.setItem(storageKey(uid), normalized);
    window.localStorage.setItem(legacyStorageKey(uid), normalized);
  } catch {
    // localStorage can be unavailable in private browsing; keep in-memory cards alive.
  }
}

function cardsEqualByContent(left: WhelCard[], right: WhelCard[]) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (JSON.stringify(left[index]) !== JSON.stringify(right[index])) {
      return false;
    }
  }
  return true;
}

function mergeCardsForUser(uid: string, cloudCards: WhelCard[]) {
  const localCards = readLocalCards(uid);
  const normalizedCloudCards = normalizeCards(cloudCards);
  const mergedCards = normalizeCards([...normalizedCloudCards, ...localCards]);
  writeLocalCards(uid, mergedCards);

  return {
    localCards,
    cloudCards: normalizedCloudCards,
    mergedCards,
    cloudNeedsHeal:
      mergedCards.length > normalizedCloudCards.length ||
      !cardsEqualByContent(mergedCards, normalizedCloudCards),
  };
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
  const sm2 = applySM2(card, outcome);
  const next = {
    ...card,
    ...sm2,
    level,
    lastOutcome: outcome,
    lastReviewedAt: now,
    nextReviewAt: sm2.dueDate,
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
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    dueDate: now,
    lastReviewed: null,
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
    const {
      cloudCards,
      mergedCards,
      cloudNeedsHeal,
    } = mergeCardsForUser(uid, Array.isArray(body.cards) ? body.cards : []);

    if (cloudNeedsHeal && mergedCards.length > cloudCards.length) {
      void saveCards(uid, mergedCards).catch(() => undefined);
    }

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

export async function reconcileCardsSnapshot(uid: string, cloudCards: WhelCard[]) {
  const { cloudCards: normalizedCloudCards, mergedCards, cloudNeedsHeal } = mergeCardsForUser(uid, cloudCards);

  if (cloudNeedsHeal && mergedCards.length > normalizedCloudCards.length) {
    void saveCards(uid, mergedCards).catch(() => undefined);
  }

  return mergedCards;
}
