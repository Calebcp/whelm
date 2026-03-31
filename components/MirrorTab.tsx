"use client";

import { type CSSProperties, type Ref, type RefObject } from "react";

import styles from "@/app/page.module.css";
import AnimatedTabSection from "@/components/AnimatedTabSection";
import CollapsibleSectionCard from "@/components/CollapsibleSectionCard";
import ProUnlockCard from "@/components/ProUnlockCard";
import { WHELM_PRO_NAME, WHELM_STANDARD_NAME } from "@/lib/whelm-plans";

// ── Constants ─────────────────────────────────────────────────────────────────

const WHELM_PRO_POSITIONING =
  "Whelm Pro keeps the full reflection archive available so patterns stay readable over time.";

const STREAK_SAVE_ACCOUNTABILITY_QUESTIONS = [
  "What honestly pulled you off track yesterday?",
  "What part of it was outside your control, and what part was yours?",
  "What is the first concrete action you will complete today to get back in line?",
] as const;

const STREAK_MIRROR_TAGS = [
  { value: "forgot", label: "Forgot", accent: "#8ec5ff" },
  { value: "lazy", label: "Lazy", accent: "#f4a261" },
  { value: "too_busy", label: "Too busy", accent: "#ff8fab" },
  { value: "low_energy", label: "Low energy", accent: "#7dd3c7" },
  { value: "disorganized", label: "Disorganized", accent: "#c4b5fd" },
  { value: "other", label: "Other", accent: "#facc15" },
] as const;

type StreakMirrorTag = (typeof STREAK_MIRROR_TAGS)[number]["value"];

function getStreakMirrorTagMeta(tag: string) {
  return STREAK_MIRROR_TAGS.find((item) => item.value === tag) ?? STREAK_MIRROR_TAGS[0];
}

// ── Types ────────────────────────────────────────────────────────────────────

type StreakMirrorEntry = {
  id: string;
  dateKey: string;
  createdAtISO: string;
  updatedAtISO: string;
  tag: StreakMirrorTag | string;
  answers: Record<string, string>;
  source: "streak_save";
};

type MirrorSectionsOpen = {
  summary: boolean;
  entries: boolean;
  detail: boolean;
};

// ── Component ─────────────────────────────────────────────────────────────────

export type MirrorTabProps = {
  sectionRef?: Ref<HTMLElement>;
  entriesAnchorRef?: RefObject<HTMLDivElement | null>;
  // Summary section
  mirrorSectionsOpen: MirrorSectionsOpen;
  onToggleMirrorSection: (key: keyof MirrorSectionsOpen) => void;
  streakMirrorSaying: string;
  mirrorPrivacyOpen: boolean;
  onToggleMirrorPrivacy: () => void;
  monthlyStreakSaveCount: number;
  streakSaveMonthlyLimit: number;
  streakSaveSlotsLeft: number;
  // Entries section
  streakMirrorEntries: StreakMirrorEntry[];
  streakMirrorVisibleEntries: StreakMirrorEntry[];
  selectedStreakMirrorEntry: StreakMirrorEntry | null | undefined;
  isPro: boolean;
  onSelectMirrorEntry: (id: string) => void;
  proPanelMirrorOpen: boolean;
  onToggleProMirrorPanel: () => void;
  onStartProPreview: () => void;
  // Detail section (no extra props — driven by selectedStreakMirrorEntry)
};

export default function MirrorTab({
  sectionRef,
  entriesAnchorRef,
  mirrorSectionsOpen,
  onToggleMirrorSection,
  streakMirrorSaying,
  mirrorPrivacyOpen,
  onToggleMirrorPrivacy,
  monthlyStreakSaveCount,
  streakSaveMonthlyLimit,
  streakSaveSlotsLeft,
  streakMirrorEntries,
  streakMirrorVisibleEntries,
  selectedStreakMirrorEntry,
  isPro,
  onSelectMirrorEntry,
  proPanelMirrorOpen,
  onToggleProMirrorPanel,
  onStartProPreview,
}: MirrorTabProps) {
  return (
    <AnimatedTabSection className={styles.mirrorShell} sectionRef={sectionRef}>
      <CollapsibleSectionCard
        className={styles.mirrorHeroCard}
        label="Private Reflection"
        title="Streak Mirror"
        description="Private reflection for resets, sick-day saves, and pattern review."
        open={mirrorSectionsOpen.summary}
        onToggle={() => onToggleMirrorSection("summary")}
      >
        <div className={styles.mirrorHeroCopy}>
          <p className={styles.mirrorSaying}>{streakMirrorSaying}</p>
          <div className={styles.mirrorPrivacyWrap}>
            <button
              type="button"
              className={styles.secondaryPlanButton}
              onClick={onToggleMirrorPrivacy}
            >
              Privacy
            </button>
            {mirrorPrivacyOpen ? (
              <p className={styles.mirrorLead}>
                Private to you. No one else sees your Streak Mirror entries. Whelm keeps
                them only to support honest reflection and accountability inside the app.
              </p>
            ) : null}
          </div>
        </div>
        <div className={styles.mirrorHeroMeta}>
          <div className={styles.mirrorCounterCard}>
            <span>This month</span>
            <strong>
              {monthlyStreakSaveCount}/{streakSaveMonthlyLimit}
            </strong>
            <small>
              {streakSaveSlotsLeft > 0
                ? `${streakSaveSlotsLeft} streak save${streakSaveSlotsLeft === 1 ? "" : "s"} left`
                : "Monthly save limit reached"}
            </small>
          </div>
        </div>
      </CollapsibleSectionCard>

      <div ref={entriesAnchorRef}>
        <CollapsibleSectionCard
          className={styles.mirrorGridCard}
          label="Entries"
          title={streakMirrorEntries.length === 0 ? "No reflections yet" : "Look back clearly"}
          description={
            streakMirrorEntries.length === 0
              ? "When a streak save is used, the reflection is stored here as a private mirror entry."
              : isPro
                ? "Every saved mirror entry stays available here."
                : `${WHELM_STANDARD_NAME} keeps your 2 most recent mirror entries visible. ${WHELM_PRO_NAME} keeps the full archive available.`
          }
          open={mirrorSectionsOpen.entries}
          onToggle={() => onToggleMirrorSection("entries")}
        >
          {streakMirrorVisibleEntries.length > 0 ? (
            <div className={styles.mirrorEntryGrid}>
              {streakMirrorVisibleEntries.map((entry) => {
                const tagMeta = getStreakMirrorTagMeta(entry.tag);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`${styles.mirrorEntryCard} ${
                      selectedStreakMirrorEntry?.id === entry.id ? styles.mirrorEntryCardActive : ""
                    }`}
                    style={{ ["--mirror-accent" as const]: tagMeta.accent } as CSSProperties}
                    onClick={() => onSelectMirrorEntry(entry.id)}
                  >
                    <div className={styles.mirrorEntryCardHeader}>
                      <img src="/mirror-icon-tab.png" alt="" className={styles.mirrorEntryIcon} />
                      <span className={styles.mirrorEntryTag}>{tagMeta.label}</span>
                    </div>
                    <strong className={styles.mirrorEntryDate}>
                      {new Date(`${entry.dateKey}T00:00:00`).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </strong>
                    <p className={styles.mirrorEntryPreview}>
                      {entry.answers[STREAK_SAVE_ACCOUNTABILITY_QUESTIONS[0]]}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className={styles.emptyText}>No mirror entries yet. Honest save reflections will appear here.</p>
          )}

          {!isPro && streakMirrorEntries.length > 2 ? (
            <ProUnlockCard
              title="Full Streak Mirror archive"
              body={`${WHELM_PRO_POSITIONING} ${WHELM_STANDARD_NAME} keeps the 2 most recent mirror reflections visible. ${WHELM_PRO_NAME} keeps the full archive so patterns stay easy to trace.`}
              open={proPanelMirrorOpen}
              onToggle={onToggleProMirrorPanel}
              onPreview={onStartProPreview}
            />
          ) : null}
        </CollapsibleSectionCard>
      </div>

      <CollapsibleSectionCard
        className={styles.mirrorDetailCard}
        label="Entry View"
        title={selectedStreakMirrorEntry ? "Private accountability reflection" : "Select a mirror card"}
        description={
          selectedStreakMirrorEntry
            ? "Open the full reflection only when you want the detail."
            : "Choose one of your mirror cards to open the full reflection."
        }
        open={mirrorSectionsOpen.detail}
        onToggle={() => onToggleMirrorSection("detail")}
      >
        {selectedStreakMirrorEntry ? (
          <div className={styles.mirrorDetailBody}>
            <div className={styles.mirrorDetailMeta}>
              <span className={styles.mirrorDetailDate}>
                {new Date(`${selectedStreakMirrorEntry.dateKey}T00:00:00`).toLocaleDateString(
                  undefined,
                  {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  },
                )}
              </span>
              <span
                className={styles.mirrorEntryTag}
                style={{
                  backgroundColor: `${getStreakMirrorTagMeta(selectedStreakMirrorEntry.tag).accent}22`,
                  borderColor: `${getStreakMirrorTagMeta(selectedStreakMirrorEntry.tag).accent}66`,
                  color: getStreakMirrorTagMeta(selectedStreakMirrorEntry.tag).accent,
                }}
              >
                {getStreakMirrorTagMeta(selectedStreakMirrorEntry.tag).label}
              </span>
            </div>
            <div className={styles.mirrorAnswerList}>
              {STREAK_SAVE_ACCOUNTABILITY_QUESTIONS.map((question, index) => (
                <article key={question} className={styles.mirrorAnswerCard}>
                  <p className={styles.mirrorQuestionLabel}>Prompt {index + 1}</p>
                  <strong className={styles.mirrorQuestionText}>{question}</strong>
                  <p className={styles.mirrorAnswerText}>
                    {selectedStreakMirrorEntry.answers[question]}
                  </p>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </CollapsibleSectionCard>
    </AnimatedTabSection>
  );
}
