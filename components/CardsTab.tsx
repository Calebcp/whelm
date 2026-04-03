"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import {
  applyReview,
  createCard,
  getCardsForReview,
  loadCards,
  normalizeCards,
  reconcileCardsSnapshot,
  saveCards,
  type ReviewOutcome,
  type WhelCard,
} from "@/lib/cards-store";
import { db } from "@/lib/firebase";
import { calculateXP } from "@/lib/xp-store";
import styles from "@/app/page.module.css";

type CardsTabProps = {
  uid: string;
  onXPEarned: (amount: number) => void;
};

type CardsView = "library" | "deck" | "review" | "editor";
type ReviewSummary = {
  reviewed: number;
  xpEarned: number;
  zoneMoves: number;
};

type CardGroup = {
  id: string;
  title: string;
  description: string;
  cards: WhelCard[];
  icon: string;
  accentClassName: string;
  shelfTitle: string;
};

type OutcomeButtonMeta = {
  outcome: ReviewOutcome;
  label: string;
  hint: string;
  className: string;
};

const ZONE_ORDER = ["learning", "practice", "mastery", "weak"] as const;
const OUTCOME_BUTTONS: OutcomeButtonMeta[] = [
  { outcome: "forgot", label: "Again", hint: "Reset it", className: "cardsOutcomeForgot" },
  { outcome: "hard", label: "Hard", hint: "Needs work", className: "cardsOutcomeHard" },
  { outcome: "good", label: "Good", hint: "Solid recall", className: "cardsOutcomeGood" },
  { outcome: "easy", label: "Easy", hint: "Locked in", className: "cardsOutcomeEasy" },
];
const COLLECTION_FILTERS = [
  { id: "all", label: "All" },
  { id: "due-now", label: "Due now" },
  { id: "new", label: "New" },
  { id: "hard", label: "Hard" },
  { id: "mastery", label: "Mastery" },
] as const;

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
  const [view, setView] = useState<CardsView>("library");
  const [cards, setCards] = useState<WhelCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [cardsSearch, setCardsSearch] = useState("");
  const [activeCollectionFilter, setActiveCollectionFilter] = useState<(typeof COLLECTION_FILTERS)[number]["id"]>("all");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [answerVisible, setAnswerVisible] = useState(false);
  const [answerOpenedAt, setAnswerOpenedAt] = useState<number | null>(null);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionZoneMoves, setSessionZoneMoves] = useState(0);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [noDueNotice, setNoDueNotice] = useState<string | null>(null);
  const [reviewQueueIds, setReviewQueueIds] = useState<string[]>([]);
  const [reviewSessionTotal, setReviewSessionTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    void loadCards(uid)
      .then((loaded) => {
        setCards(loaded);
        setStatus("");
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));

    const unsub = onSnapshot(
      doc(db, "userCards", uid),
      (snap) => {
        if (!snap.exists()) {
          setLoading(false);
          return;
        }
        const json = snap.data()?.cardsJson;
        if (typeof json !== "string") {
          setLoading(false);
          return;
        }
        try {
          const parsed = JSON.parse(json) as WhelCard[];
          if (Array.isArray(parsed)) {
            void reconcileCardsSnapshot(uid, parsed)
              .then((merged) => {
                setCards(merged);
              })
              .catch(() => {
                setCards(normalizeCards(parsed));
              });
            setStatus("");
          }
        } catch {
          // ignore parse errors
        }
        setLoading(false);
      },
      (err) => {
        setStatus(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [uid]);

  const cardsDue = useMemo(() => getCardsForReview(cards), [cards]);
  const todayCardsXp = reviewSummary?.xpEarned ?? sessionXp;
  const reviewQueue = useMemo(
    () => reviewQueueIds
      .map((id) => cards.find((card) => card.id === id) ?? null)
      .filter((card): card is WhelCard => card !== null && card.nextReviewAt <= Date.now()),
    [cards, reviewQueueIds],
  );

  const nextCardDueLabel = useMemo(() => {
    if (cardsDue.length > 0 || cards.length === 0) return null;
    const earliest = cards.reduce((min, c) => (c.dueDate < min ? c.dueDate : min), Infinity);
    if (!isFinite(earliest)) return null;
    const diff = earliest - Date.now();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.ceil((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `Next due in ${hours}h ${mins}m` : `Next due in ${mins}m`;
  }, [cards, cardsDue]);

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

  const currentReviewCard = reviewQueue[0] ?? null;

  const cardGroups = useMemo<CardGroup[]>(() => {
    const groups: CardGroup[] = [
      {
        id: "due-now",
        title: "Due now",
        description: "Cards ready to study immediately.",
        shelfTitle: "Review now",
        icon: "●",
        accentClassName: "cardsCollectionDue",
        cards: [],
      },
      {
        id: "new",
        title: "New cards",
        description: "Fresh cards that have not been reviewed yet.",
        shelfTitle: "Fresh starts",
        icon: "+",
        accentClassName: "cardsCollectionNew",
        cards: [],
      },
      {
        id: "hard",
        title: "Hard recalls",
        description: "Cards that are still resisting recall.",
        shelfTitle: "Needs another pass",
        icon: "!",
        accentClassName: "cardsCollectionHard",
        cards: [],
      },
      {
        id: "learning",
        title: "Learning lane",
        description: "Cards actively moving through the ladder.",
        shelfTitle: "In motion",
        icon: "~",
        accentClassName: "cardsCollectionLearning",
        cards: [],
      },
      {
        id: "easy",
        title: "Easy wins",
        description: "Cards you recently rated easy.",
        shelfTitle: "Fast recall",
        icon: "✓",
        accentClassName: "cardsCollectionEasy",
        cards: [],
      },
      {
        id: "mastery",
        title: "Mastery",
        description: "Cards that are mostly settled.",
        shelfTitle: "Locked in",
        icon: "◆",
        accentClassName: "cardsCollectionMastery",
        cards: [],
      },
    ];

    for (const card of cards) {
      if (card.nextReviewAt <= Date.now()) {
        groups[0].cards.push(card);
      } else if (card.reviewCount === 0) {
        groups[1].cards.push(card);
      } else if (card.zone === "weak" || card.lastOutcome === "hard" || card.lastOutcome === "forgot") {
        groups[2].cards.push(card);
      } else if (card.zone === "mastery") {
        groups[5].cards.push(card);
      } else if (card.lastOutcome === "easy") {
        groups[4].cards.push(card);
      } else {
        groups[3].cards.push(card);
      }
    }

    return groups;
  }, [cards]);

  const filteredGroups = useMemo(() => {
    const query = cardsSearch.trim().toLowerCase();
    return cardGroups
      .filter((group) => activeCollectionFilter === "all" || group.id === activeCollectionFilter)
      .map((group) => ({
        ...group,
        cards:
          query.length === 0
            ? group.cards
            : group.cards.filter((card) =>
                `${card.front} ${card.back}`.toLowerCase().includes(query),
              ),
      }))
      .filter((group) => group.cards.length > 0 || query.length === 0);
  }, [activeCollectionFilter, cardGroups, cardsSearch]);

  const selectedGroup =
    (selectedGroupId ? cardGroups.find((group) => group.id === selectedGroupId) : null) ?? filteredGroups[0] ?? cardGroups[0] ?? null;

  const totalReviewableCount = cardsDue.length;
  const totalNewCount = cardGroups.find((group) => group.id === "new")?.cards.length ?? 0;
  const totalHardCount = cardGroups.find((group) => group.id === "hard")?.cards.length ?? 0;

  const masteryPct = cards.length === 0 ? 0 : Math.round((cardsByZone.mastery.length / cards.length) * 100);

  function buildNoDueStatus(nextCards: WhelCard[]) {
    const dueCards = getCardsForReview(nextCards);
    if (dueCards.length > 0) return "";
    if (nextCards.length === 0) return "No cards yet. Add one to start reviewing.";

    const earliest = nextCards.reduce((min, card) => (card.dueDate < min ? card.dueDate : min), Infinity);
    if (!isFinite(earliest)) return "No cards are due right now.";

    const diff = earliest - Date.now();
    if (diff <= 0) return "No cards are due right now.";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.ceil((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0
      ? `No cards are due right now. Next review opens in ${hours}h ${mins}m.`
      : `No cards are due right now. Next review opens in ${mins}m.`;
  }

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
    setView("library");
  }

  function startReviewSession() {
    if (cardsDue.length === 0) {
      const message = buildNoDueStatus(cards);
      setStatus(message);
      setNoDueNotice(message);
      return;
    }
    setReviewQueueIds(cardsDue.map((card) => card.id));
    setReviewSessionTotal(cardsDue.length);
    setCardFlipped(false);
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
    const nextDueCards = getCardsForReview(nextCards);
    const remainingQueueIds = reviewQueueIds.filter(
      (id) => id !== currentReviewCard.id && nextDueCards.some((card) => card.id === id),
    );
    const additionalDueIds = nextDueCards
      .map((card) => card.id)
      .filter((id) => !remainingQueueIds.includes(id));
    const nextQueueIds = [...remainingQueueIds, ...additionalDueIds];
    const sessionDone = nextQueueIds.length === 0;
    const sessionBonusXp = sessionDone
      ? calculateXP("card_session_cleared", {
          currentDailyXP: sessionXp + correctXp + fastRecallXp,
          streakDays: 0,
        }).awarded
      : 0;
    const earned = correctXp + fastRecallXp + sessionBonusXp;
    const capReached = earned === 0;

    if (earned > 0) {
      onXPEarned(earned);
    }

    await persist(nextCards, capReached ? "XP cap reached for this action today" : "");
    setReviewQueueIds(nextQueueIds);
    setSessionReviewed((current) => current + 1);
    setSessionXp((current) => current + earned);
    setSessionZoneMoves((current) => current + (updatedCard.zone !== currentReviewCard.zone ? 1 : 0));
    setCardFlipped(false);
    setAnswerVisible(false);
    setAnswerOpenedAt(null);

    if (sessionDone) {
      const nextStatus = buildNoDueStatus(nextCards);
      setReviewSummary({
        reviewed: sessionReviewed + 1,
        xpEarned: sessionXp + earned,
        zoneMoves: sessionZoneMoves + (updatedCard.zone !== currentReviewCard.zone ? 1 : 0),
      });
      setStatus(nextStatus);
      if (nextStatus) {
        setNoDueNotice(nextStatus);
      }
      setReviewQueueIds([]);
      setReviewSessionTotal(0);
      setView("deck");
      return;
    }

  }

  return (
    <section className={styles.cardsTabShell}>
      {noDueNotice ? (
        <div className={styles.cardsNoticeOverlay} onClick={() => setNoDueNotice(null)}>
          <div className={styles.cardsNoticeModal} onClick={(event) => event.stopPropagation()}>
            <p className={styles.sectionLabel}>Review Queue</p>
            <strong className={styles.cardsNoticeTitle}>No cards due right now</strong>
            <p className={styles.accountMeta}>{noDueNotice}</p>
            <button
              type="button"
              className={styles.secondaryPlanButton}
              onClick={() => setNoDueNotice(null)}
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}

      {view === "library" ? (
        <div className={styles.cardsBoardStack}>
          <header className={styles.cardsLibraryHero}>
            <div className={styles.cardsLibraryHeroCopy}>
              <p className={styles.sectionLabel}>Cards world</p>
              <h2 className={styles.cardTitle}>Whelm Cards</h2>
              <p className={styles.accountMeta}>
                Explore your recall library, open a collection, and study what is due without losing the bigger map.
              </p>
            </div>
            <div className={styles.cardsHeaderActions}>
              <button
                type="button"
                className={`${styles.reportButton} ${cardsDue.length > 0 ? styles.cardsDueGlow : styles.cardsReviewButtonIdle}`}
                onClick={startReviewSession}
              >
                Study due now
                {cardsDue.length > 0 ? <span className={styles.cardsDueBadge}>{cardsDue.length}</span> : null}
              </button>
              <button type="button" className={styles.secondaryPlanButton} onClick={() => setView("editor")}>
                Add card
              </button>
            </div>
          </header>

          <div className={styles.cardsLibrarySearchBar}>
            <input
              value={cardsSearch}
              onChange={(event) => setCardsSearch(event.target.value)}
              className={styles.cardsLibrarySearchInput}
              placeholder="Search cards"
            />
          </div>

          <div className={styles.cardsFilterRow}>
            {COLLECTION_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={filter.id === activeCollectionFilter ? styles.cardsFilterChipActive : styles.cardsFilterChip}
                onClick={() => setActiveCollectionFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>

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

          {cards.length > 0 && (
            <div className={styles.cardsOverviewGrid}>
              <article className={styles.cardsOverviewStat}>
                <span className={styles.sectionLabel}>Due today</span>
                <strong>{totalReviewableCount}</strong>
              </article>
              <article className={styles.cardsOverviewStat}>
                <span className={styles.sectionLabel}>New</span>
                <strong>{totalNewCount}</strong>
              </article>
              <article className={styles.cardsOverviewStat}>
                <span className={styles.sectionLabel}>Hard</span>
                <strong>{totalHardCount}</strong>
              </article>
              <article className={styles.cardsOverviewStat}>
                <span className={styles.sectionLabel}>Mastery</span>
                <strong>{masteryPct}%</strong>
              </article>
            </div>
          )}

          {loading ? (
            <p className={styles.accountMeta}>Loading cards...</p>
          ) : cards.length === 0 ? (
            <div className={styles.cardsEmptyState}>
              <img
                src="/timer-whelms/yellow_whelm_leaning_watch-removebg-preview.png"
                alt="Whelm mascot"
                className={styles.cardsEmptyMascot}
              />
              <p className={styles.cardsEmptyTitle}>No cards yet</p>
              <p className={styles.cardsEmptyBody}>
                Add your first card and build a recall habit alongside your notes.
              </p>
            </div>
          ) : (
            <div className={styles.cardsBoardGrid}>
              {filteredGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={`${styles.cardsCollectionCard} ${styles[group.accentClassName as keyof typeof styles]}`}
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    setView("deck");
                  }}
                >
                  <div className={styles.cardsCollectionHead}>
                    <span className={styles.cardsCollectionIcon}>{group.icon}</span>
                    <span className={styles.cardsCollectionCount}>{group.cards.length}</span>
                  </div>
                  <div className={styles.cardsCollectionBody}>
                    <span className={styles.sectionLabel}>{group.shelfTitle}</span>
                    <strong>{group.title}</strong>
                    <p className={styles.accountMeta}>{group.description}</p>
                  </div>
                  <div className={styles.cardsCollectionPreview}>
                    {group.cards.slice(0, 2).map((card) => (
                      <span key={card.id} className={styles.cardsCollectionPreviewLine}>
                        {card.front || "Untitled card"}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {view === "deck" && selectedGroup ? (
        <div className={styles.cardsDeckShell}>
          <div className={styles.cardsDeckTopBar}>
            <button type="button" className={styles.secondaryPlanButton} onClick={() => setView("library")}>
              Back to library
            </button>
            <div className={styles.cardsHeaderActions}>
              <button
                type="button"
                className={`${styles.reportButton} ${selectedGroup.id === "due-now" && cardsDue.length > 0 ? styles.cardsDueGlow : ""}`}
                onClick={startReviewSession}
              >
                Study cards
              </button>
              <button type="button" className={styles.secondaryPlanButton} onClick={() => setView("editor")}>
                Add cards
              </button>
            </div>
          </div>

          <article className={`${styles.cardsDeckHero} ${styles[selectedGroup.accentClassName as keyof typeof styles]}`}>
            <p className={styles.sectionLabel}>Card collection</p>
            <h3 className={styles.cardTitle}>{selectedGroup.title}</h3>
            <p className={styles.accountMeta}>{selectedGroup.description}</p>
            <div className={styles.cardsDeckStats}>
              <div className={styles.cardsDeckStat}>
                <strong>{selectedGroup.cards.filter((card) => card.nextReviewAt <= Date.now()).length}</strong>
                <span>Cards for today</span>
              </div>
              <div className={styles.cardsDeckStat}>
                <strong>{selectedGroup.cards.length}</strong>
                <span>Cards in collection</span>
              </div>
              <div className={styles.cardsDeckStat}>
                <strong>{selectedGroup.cards.filter((card) => card.zone === "mastery").length}</strong>
                <span>Mastered</span>
              </div>
            </div>
          </article>

          <div className={styles.cardsDeckList}>
            {selectedGroup.cards.map((card) => (
              <article key={card.id} className={styles.cardsDeckItem}>
                <div className={styles.cardsDeckItemCopy}>
                  <strong>{card.front || "Untitled card"}</strong>
                  <p>{card.back || "No answer yet."}</p>
                </div>
                <div className={styles.cardsDeckItemMeta}>
                  <span>Lv {card.level}</span>
                  <span>{formatDueDate(card.dueDate)}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {view === "review" ? (
        <div className={styles.cardsReviewOverlay}>
          <div className={styles.cardsOverlayTopBar}>
            <span className={styles.cardsOverlayProgress}>
              {currentReviewCard
                ? `${sessionReviewed + 1} / ${Math.max(reviewSessionTotal, sessionReviewed + reviewQueue.length)}`
                : "Done"}
            </span>
            <button
              type="button"
              className={styles.cardsOverlayExitBtn}
              onClick={() => {
                setReviewQueueIds([]);
                setReviewSessionTotal(0);
                setView(selectedGroup ? "deck" : "library");
              }}
            >
              ← Exit
            </button>
          </div>

          {currentReviewCard ? (
            <div className={styles.cardsReviewCenterStage}>
              {/* 3D flip card */}
              <div
                className={styles.cardsFlipScene}
                onClick={() => {
                  if (!cardFlipped) {
                    setCardFlipped(true);
                    setAnswerVisible(true);
                    setAnswerOpenedAt(Date.now());
                  }
                }}
                role="button"
                aria-label={cardFlipped ? "Card answer" : "Tap to reveal answer"}
                style={{ minHeight: 200 }}
              >
                <div className={`${styles.cardsFlipCard} ${cardFlipped ? styles.cardsFlipCardFlipped : ""}`}>
                  <div className={styles.cardsFlipFront}>
                    <span className={styles.cardsFlipFrontText}>{currentReviewCard.front}</span>
                  </div>
                  <div className={styles.cardsFlipBack}>
                    <span className={styles.cardsFlipBackText}>{currentReviewCard.back}</span>
                  </div>
                </div>
              </div>
              {!cardFlipped && (
                <p className={styles.cardsFlipHint}>Tap card to flip</p>
              )}

              {answerVisible ? (
                <div className={styles.cardsOutcomeRow}>
                  {OUTCOME_BUTTONS.map((button) => (
                    <button
                      key={button.outcome}
                      type="button"
                      className={styles[button.className as keyof typeof styles]}
                      onClick={() => void handleOutcome(button.outcome)}
                    >
                      <span className={styles.cardsOutcomeLabel}>{button.label}</span>
                      <span className={styles.cardsOutcomeHint}>{button.hint}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.cardsReviewCenterStage} style={{ alignItems: "center" }}>
              <strong style={{ color: "#f0f4ff", fontSize: "1.1rem" }}>No cards are due right now.</strong>
              <button type="button" className={styles.secondaryPlanButton} onClick={() => setView(selectedGroup ? "deck" : "library")}>
                Return to library
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
            <button type="button" className={styles.secondaryPlanButton} onClick={() => setView(selectedGroup ? "deck" : "library")}>
              Cancel
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}
