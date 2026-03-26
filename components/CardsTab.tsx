"use client";

import { useEffect, useMemo, useState } from "react";

import {
  applyReview,
  createCard,
  getCardsForReview,
  loadCards,
  saveCards,
  type ReviewOutcome,
  type WhelCard,
} from "@/lib/cards-store";
import { calculateXP } from "@/lib/xp-store";
import styles from "@/app/page.module.css";

type CardsTabProps = {
  uid: string;
  onXPEarned: (amount: number) => void;
};

type CardsView = "board" | "review" | "editor";
type ReviewSummary = {
  reviewed: number;
  xpEarned: number;
  zoneMoves: number;
};

const ZONE_ORDER = ["learning", "practice", "mastery", "weak"] as const;

function formatDueDate(timestamp: number): string {
  const diff = timestamp - Date.now();
  if (diff <= 0) return "Due now";
  const hours = diff / (1000 * 60 * 60);
  if (hours < 24) return `Due in ${Math.ceil(hours)}h`;
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 2) return "Due tomorrow";
  return `Due in ${Math.floor(days)}d`;
}

export default function CardsTab({ uid, onXPEarned }: CardsTabProps) {
  const [view, setView] = useState<CardsView>("board");
  const [cards, setCards] = useState<WhelCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [reviewIndex, setReviewIndex] = useState(0);
  const [answerVisible, setAnswerVisible] = useState(false);
  const [answerOpenedAt, setAnswerOpenedAt] = useState<number | null>(null);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionZoneMoves, setSessionZoneMoves] = useState(0);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      setLoading(true);
      try {
        const nextCards = await loadCards(uid);
        if (!cancelled) {
          setCards(nextCards);
          setStatus("");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Failed to load cards.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const cardsDue = useMemo(() => getCardsForReview(cards), [cards]);
  const todayCardsXp = reviewSummary?.xpEarned ?? sessionXp;
  const cardsByZone = useMemo(() => {
    const grouped: Record<(typeof ZONE_ORDER)[number], WhelCard[]> = {
      learning: [],
      practice: [],
      mastery: [],
      weak: [],
    };

    cards.forEach((card) => grouped[card.zone].push(card));
    return grouped;
  }, [cards]);

  const currentReviewCard = cardsDue[reviewIndex] ?? null;

  async function persist(nextCards: WhelCard[], nextStatus = "") {
    setCards(nextCards);
    setStatus(nextStatus);
    await saveCards(uid, nextCards);
  }

  async function handleSaveCard() {
    const trimmedFront = front.trim();
    const trimmedBack = back.trim();

    if (!trimmedFront || !trimmedBack) {
      setStatus("Front and back are both required.");
      return;
    }

    const nextCards = [...cards, createCard("notes-tab", trimmedFront, trimmedBack)];
    await persist(nextCards, "Card saved.");
    setFront("");
    setBack("");
    setReviewSummary(null);
    setView("board");
  }

  function startReviewSession() {
    setReviewIndex(0);
    setAnswerVisible(false);
    setAnswerOpenedAt(null);
    setSessionReviewed(0);
    setSessionXp(0);
    setSessionZoneMoves(0);
    setReviewSummary(null);
    setStatus("");
    setView("review");
  }

  async function handleOutcome(outcome: ReviewOutcome) {
    if (!currentReviewCard) return;

    const updatedCard = applyReview(currentReviewCard, outcome);
    const nextCards = cards.map((card) => (card.id === currentReviewCard.id ? updatedCard : card));
    const correctXp = calculateXP("card_correct", {
      currentDailyXP: sessionXp,
      streakDays: 0,
    }).awarded;
    const fastRecallXp =
      outcome === "easy" && answerOpenedAt !== null && Date.now() - answerOpenedAt <= 5000
        ? calculateXP("card_fast_recall", {
            currentDailyXP: sessionXp + correctXp,
            streakDays: 0,
          }).awarded
        : 0;
    const nextIndex = reviewIndex + 1;
    const sessionDone = nextIndex >= cardsDue.length;
    const sessionBonusXp = sessionDone
      ? calculateXP("card_session_cleared", {
          currentDailyXP: sessionXp + correctXp + fastRecallXp,
          streakDays: 0,
        }).awarded
      : 0;
    const earned = correctXp + fastRecallXp + sessionBonusXp;

    if (earned > 0) {
      onXPEarned(earned);
    }

    await persist(nextCards, "");
    setSessionReviewed((current) => current + 1);
    setSessionXp((current) => current + earned);
    setSessionZoneMoves((current) => current + (updatedCard.zone !== currentReviewCard.zone ? 1 : 0));
    setAnswerVisible(false);
    setAnswerOpenedAt(null);

    if (sessionDone) {
      setReviewSummary({
        reviewed: sessionReviewed + 1,
        xpEarned: sessionXp + earned,
        zoneMoves: sessionZoneMoves + (updatedCard.zone !== currentReviewCard.zone ? 1 : 0),
      });
      setView("board");
      return;
    }

    setReviewIndex(nextIndex);
  }

  return (
    <section className={styles.cardsTabShell}>
      {view === "board" ? (
        <div className={styles.cardsBoardStack}>
          <header className={styles.cardsHeader}>
            <div>
              <p className={styles.sectionLabel}>Notes Companion</p>
              <h2 className={styles.cardTitle}>Whelm Cards</h2>
              <p className={styles.accountMeta}>
                Today&apos;s cards XP: {todayCardsXp}. Build recall without leaving your notes lane.
              </p>
            </div>
            <div className={styles.cardsHeaderActions}>
              <button
                type="button"
                className={styles.reportButton}
                onClick={startReviewSession}
                disabled={cardsDue.length === 0}
              >
                Start Review Session
                {cardsDue.length > 0 ? (
                  <span className={styles.cardsDueBadge}>{cardsDue.length}</span>
                ) : null}
              </button>
              <button type="button" className={styles.secondaryPlanButton} onClick={() => setView("editor")}>
                Add Card
              </button>
            </div>
          </header>

          {status ? <p className={styles.accountMeta}>{status}</p> : null}
          {reviewSummary ? (
            <article className={styles.cardsSummaryCard}>
              <p className={styles.sectionLabel}>Session Summary</p>
              <strong>{reviewSummary.reviewed} cards reviewed</strong>
              <p className={styles.accountMeta}>
                XP earned: {reviewSummary.xpEarned} · zone moves: {reviewSummary.zoneMoves}
              </p>
            </article>
          ) : null}

          {loading ? (
            <p className={styles.accountMeta}>Loading cards...</p>
          ) : (
            <div className={styles.cardsBoardGrid}>
              {ZONE_ORDER.map((zone) => (
                <article key={zone} className={styles.cardsZoneColumn}>
                  <div className={styles.cardsZoneHeader}>
                    <span className={styles.sectionLabel}>
                      {zone === "learning"
                        ? "Learning"
                        : zone === "practice"
                          ? "Practice"
                          : zone === "mastery"
                            ? "Mastery"
                            : "Weak"}
                    </span>
                    <strong>{cardsByZone[zone].length}</strong>
                  </div>
                  <div className={styles.cardsZoneList}>
                    {cardsByZone[zone].length === 0 ? (
                      <p className={styles.emptyText}>No cards here yet.</p>
                    ) : (
                      cardsByZone[zone].map((card) => (
                        <article key={card.id} className={styles.cardsTile}>
                          <strong>{card.front || "Untitled card"}</strong>
                          <span className={styles.accountMeta}>
                            Lv {card.level} · {card.reviewCount} review{card.reviewCount === 1 ? "" : "s"}
                          </span>
                          <span className={styles.cardsDueDate}>{formatDueDate(card.dueDate)}</span>
                        </article>
                      ))
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {view === "review" ? (
        <div className={styles.cardsReviewOverlay}>
          <div className={styles.cardsOverlayTopBar}>
            <span className={styles.cardsOverlayProgress}>
              {currentReviewCard
                ? `${reviewIndex + 1} / ${cardsDue.length}`
                : "Done"}
            </span>
            <button
              type="button"
              className={styles.cardsOverlayExitBtn}
              onClick={() => setView("board")}
            >
              ← Exit
            </button>
          </div>

          {currentReviewCard ? (
            <div className={styles.cardsReviewCenterStage}>
              <p className={styles.cardsOverlayFront}>{currentReviewCard.front}</p>

              {answerVisible ? (
                <div className={styles.cardsOverlayAnswerPanel}>
                  {currentReviewCard.back}
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.cardsOverlayRevealBtn}
                  onClick={() => {
                    setAnswerVisible(true);
                    setAnswerOpenedAt(Date.now());
                  }}
                >
                  Reveal Answer
                </button>
              )}

              {answerVisible ? (
                <div className={styles.cardsOutcomeRow}>
                  <button type="button" className={styles.cardsOutcomeForgot} onClick={() => void handleOutcome("forgot")}>
                    Again
                  </button>
                  <button type="button" className={styles.cardsOutcomeHard} onClick={() => void handleOutcome("hard")}>
                    Hard
                  </button>
                  <button type="button" className={styles.cardsOutcomeGood} onClick={() => void handleOutcome("good")}>
                    Good
                  </button>
                  <button type="button" className={styles.cardsOutcomeEasy} onClick={() => void handleOutcome("easy")}>
                    Easy
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.cardsReviewCenterStage} style={{ alignItems: "center" }}>
              <strong style={{ color: "#f0f4ff", fontSize: "1.1rem" }}>No cards are due right now.</strong>
              <button type="button" className={styles.secondaryPlanButton} onClick={() => setView("board")}>
                Return to board
              </button>
            </div>
          )}
        </div>
      ) : null}

      {view === "editor" ? (
        <article className={styles.cardsEditorCard}>
          <p className={styles.sectionLabel}>Card Editor</p>
          <h3 className={styles.cardTitle}>Create a new card</h3>
          <label className={styles.planLabel}>
            Front
            <input
              value={front}
              onChange={(event) => setFront(event.target.value)}
              className={styles.planControl}
              placeholder="Question"
            />
          </label>
          <label className={styles.planLabel}>
            Back
            <textarea
              value={back}
              onChange={(event) => setBack(event.target.value)}
              className={styles.feedbackTextarea}
              rows={6}
              placeholder="Answer"
            />
          </label>
          {status ? <p className={styles.accountMeta}>{status}</p> : null}
          <div className={styles.noteFooterActions}>
            <button type="button" className={styles.reportButton} onClick={() => void handleSaveCard()}>
              Save Card
            </button>
            <button type="button" className={styles.secondaryPlanButton} onClick={() => setView("board")}>
              Cancel
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}
