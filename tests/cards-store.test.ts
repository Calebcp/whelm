import test, { before } from "node:test";
import assert from "node:assert/strict";
import type { WhelCard, ReviewOutcome } from "@/lib/cards-store";

// Mock browser globals needed by saveCards at call time.
const mockStorage = new Map<string, string>();

(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => { mockStorage.set(key, value); },
    removeItem: (key: string) => { mockStorage.delete(key); },
    clear: () => mockStorage.clear(),
  },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
};

// Lazily populated in `before` — env vars must be set before firebase.ts initializes.
let createCard: (noteId: string, front: string, back: string) => WhelCard;
let applyReview: (card: WhelCard, outcome: ReviewOutcome) => WhelCard;
let getCardsForReview: (cards: WhelCard[]) => WhelCard[];
let saveCards: (uid: string, cards: WhelCard[]) => Promise<void>;

before(async () => {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??= "demo-key";
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??= "demo.firebaseapp.com";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= "demo-project";
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??= "demo.appspot.com";
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??= "123456";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??= "1:123456:web:abcdef";

  const store = await import("@/lib/cards-store");
  createCard = store.createCard;
  applyReview = store.applyReview;
  getCardsForReview = store.getCardsForReview;
  saveCards = store.saveCards;
});

test("createCard returns a valid WhelCard with level 1 and zone learning", () => {
  const card = createCard("note-1", "What is 1+1?", "2");
  assert.equal(card.noteId, "note-1");
  assert.equal(card.front, "What is 1+1?");
  assert.equal(card.back, "2");
  assert.equal(card.level, 1);
  assert.equal(card.zone, "learning");
  assert.equal(card.lastOutcome, null);
  assert.equal(card.reviewCount, 0);
  assert.equal(card.correctCount, 0);
  assert.equal(card.lastReviewedAt, null);
  assert.ok(typeof card.id === "string" && card.id.length > 0);
  // SM-2 defaults
  assert.equal(card.easeFactor, 2.5);
  assert.equal(card.interval, 1);
  assert.equal(card.repetitions, 0);
  assert.equal(card.lastReviewed, null);
  assert.ok(Number.isFinite(card.dueDate));
});

test("applyReview with easy increases level and updates nextReviewAt", () => {
  const card = createCard("note-1", "Q", "A");
  const before = Date.now();
  const reviewed = applyReview(card, "easy");
  assert.equal(reviewed.level, 2);
  assert.equal(reviewed.lastOutcome, "easy");
  assert.ok(reviewed.lastReviewedAt !== null && reviewed.lastReviewedAt >= before);
  assert.ok(reviewed.nextReviewAt > reviewed.lastReviewedAt!);
  assert.equal(reviewed.reviewCount, 1);
  assert.equal(reviewed.correctCount, 1);
  // SM-2: first easy review → repetitions=1, interval=1 day
  assert.equal(reviewed.repetitions, 1);
  assert.equal(reviewed.interval, 1);
  assert.ok(reviewed.easeFactor > 2.5); // easy boosts easeFactor
  assert.ok(reviewed.dueDate > before);
  assert.ok(reviewed.lastReviewed !== null && reviewed.lastReviewed >= before);
});

test("applyReview with good keeps level and advances SM-2 correctly", () => {
  const card = createCard("note-1", "Q", "A");
  const reviewed = applyReview(card, "good");
  assert.equal(reviewed.level, 1); // good does not change level
  assert.equal(reviewed.lastOutcome, "good");
  assert.equal(reviewed.repetitions, 1);
  assert.equal(reviewed.interval, 1);
  assert.ok(Math.abs(reviewed.easeFactor - 2.5) < 0.001); // good keeps easeFactor stable
});

test("applyReview with forgot decreases level and sets zone to weak", () => {
  const base = createCard("note-1", "Q", "A");
  const atLevel2: WhelCard = { ...base, level: 2, zone: "practice" };
  const reviewed = applyReview(atLevel2, "forgot");
  assert.equal(reviewed.level, 1);
  assert.equal(reviewed.lastOutcome, "forgot");
  assert.equal(reviewed.zone, "weak");
  assert.equal(reviewed.correctCount, 0);
  // SM-2: forgot resets repetitions and interval
  assert.equal(reviewed.repetitions, 0);
  assert.equal(reviewed.interval, 1);
});

test("applyReview never sets level below 1 or above 4", () => {
  const atMin = createCard("note-1", "Q", "A"); // starts at level 1
  const afterForgot = applyReview(atMin, "forgot");
  assert.equal(afterForgot.level, 1);

  const atMax: WhelCard = { ...createCard("note-2", "Q", "A"), level: 4, zone: "mastery" };
  const afterEasy = applyReview(atMax, "easy");
  assert.equal(afterEasy.level, 4);
});

test("getCardsForReview only returns cards where nextReviewAt <= Date.now()", () => {
  const past = Date.now() - 1000;
  const future = Date.now() + 60 * 60 * 1000;

  const due: WhelCard = { ...createCard("note-1", "Q", "A"), nextReviewAt: past };
  const notDue: WhelCard = { ...createCard("note-2", "Q", "A"), nextReviewAt: future };

  const result = getCardsForReview([due, notDue]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, due.id);
});

test("getCardsForReview returns weak zone cards before learning cards", () => {
  const past = Date.now() - 1000;

  // lastOutcome: null + level 1 → deriveZone returns "learning"
  const learning: WhelCard = {
    ...createCard("note-1", "Q", "A"),
    nextReviewAt: past,
    lastOutcome: null,
    level: 1,
  };

  // lastOutcome: "forgot" → deriveZone returns "weak" regardless of level
  const weak: WhelCard = {
    ...createCard("note-2", "Q", "A"),
    nextReviewAt: past,
    lastOutcome: "forgot",
    level: 1,
  };

  const result = getCardsForReview([learning, weak]);
  assert.equal(result.length, 2);
  assert.equal(result[0].zone, "weak");
  assert.equal(result[1].zone, "learning");
});

test("saveCards writes to localStorage immediately before attempting the API call", async () => {
  mockStorage.clear();
  const card = createCard("note-1", "Q", "A");

  // Firebase auth.currentUser is null in tests — authorizedCardsRequest throws,
  // but saveCards catches that silently. The localStorage write happens before
  // the API call so it is already persisted when the catch runs.
  await saveCards("test-uid", [card]);

  const stored = mockStorage.get("whelm_cards_test-uid");
  assert.ok(stored !== undefined, "localStorage should be written before the API attempt");

  const parsed = JSON.parse(stored) as WhelCard[];
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].front, "Q");
});
