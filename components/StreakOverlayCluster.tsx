"use client";

import { type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";

import styles from "@/app/page.module.css";
import { countWords } from "@/lib/date-utils";
import type { AppTab } from "@/lib/app-tabs";
import type { WorkspaceNote } from "@/lib/notes-store";
import type { PlannedBlock } from "@/hooks/usePlannedBlocks";
import type { SessionDoc } from "@/lib/streak";
import type { StreakCelebrationState, StreakNudgeState } from "@/lib/xp-engine";

type StreakTag = {
  value: "forgot" | "lazy" | "too_busy" | "low_energy" | "disorganized" | "other";
  label: string;
  accent: string;
};

export default function StreakOverlayCluster({
  notificationsBlocked,
  streakSaveQuestionnaireOpen,
  sickDaySaveEligible,
  streakSaveQuestionnairePreview,
  closeStreakSaveQuestionnaire,
  monthlyStreakSaveCount,
  streakSaveMonthlyLimit,
  streakMirrorSaying,
  questions,
  streakSaveAnswers,
  onSetStreakSaveAnswers,
  minWords,
  tags,
  streakMirrorTag,
  onSetStreakMirrorTag,
  streakSaveStatus,
  onClaimSickDaySave,
  onDismissSickDaySavePrompt,
  sickDaySavePromptOpen,
  rawYesterdayMissed,
  yesterdaySave,
  sickDaySavePromptPreview,
  monthlySaveLimitReached,
  onOpenSickDaySaveReview,
  noteUndoItem,
  deletedPlanUndo,
  onUndoDeleteNote,
  onUndoDeletePlan,
  streakCelebration,
  onDismissStreakCelebration,
  getStreakTierColorTheme,
  streakNudge,
  onDismissStreakNudge,
  onStreakNudgeAction,
}: {
  notificationsBlocked: boolean;
  streakSaveQuestionnaireOpen: boolean;
  sickDaySaveEligible: boolean;
  streakSaveQuestionnairePreview: boolean;
  closeStreakSaveQuestionnaire: () => void;
  monthlyStreakSaveCount: number;
  streakSaveMonthlyLimit: number;
  streakMirrorSaying: string;
  questions: readonly string[];
  streakSaveAnswers: Record<string, string>;
  onSetStreakSaveAnswers: (value: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)) => void;
  minWords: number;
  tags: readonly StreakTag[];
  streakMirrorTag: StreakTag["value"] | null;
  onSetStreakMirrorTag: (value: StreakTag["value"]) => void;
  streakSaveStatus: string;
  onClaimSickDaySave: () => void;
  onDismissSickDaySavePrompt: () => void;
  sickDaySavePromptOpen: boolean;
  rawYesterdayMissed: unknown;
  yesterdaySave: unknown;
  sickDaySavePromptPreview: boolean;
  monthlySaveLimitReached: boolean;
  onOpenSickDaySaveReview: () => void;
  noteUndoItem: WorkspaceNote | null;
  deletedPlanUndo: PlannedBlock | null;
  onUndoDeleteNote: () => void;
  onUndoDeletePlan: () => void;
  streakCelebration: StreakCelebrationState | null;
  onDismissStreakCelebration: () => void;
  getStreakTierColorTheme: (tierColor: string | null | undefined) => {
    accent: string;
    accentStrong: string;
    accentGlow: string;
  };
  streakNudge: StreakNudgeState | null;
  onDismissStreakNudge: () => void;
  onStreakNudgeAction: (tab: AppTab) => void;
}) {
  return (
    <>
      {streakSaveQuestionnaireOpen && (sickDaySaveEligible || streakSaveQuestionnairePreview) && (
        <div className={styles.feedbackOverlay} onClick={closeStreakSaveQuestionnaire}>
          <div
            className={`${styles.feedbackModal} ${styles.feedbackModalScrollable}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>Streak Mirror check-in</h2>
              <button type="button" className={styles.feedbackClose} onClick={closeStreakSaveQuestionnaire}>
                Close
              </button>
            </div>
            <p className={styles.feedbackMeta}>
              {streakSaveQuestionnairePreview
                ? "Preview mode only. Fill it out and close it without changing the streak."
                : "Private to you. No one else sees these reflections. Whelm keeps them only to support honest reflection and accountability inside the app."}
            </p>
            <div className={styles.mirrorModalBanner}>
              <strong>{monthlyStreakSaveCount}/{streakSaveMonthlyLimit} used this month</strong>
              <span>{streakMirrorSaying}</span>
            </div>
            <div className={styles.feedbackFormStack}>
              {questions.map((question, index) => {
                const currentAnswer = streakSaveAnswers[question] ?? "";
                const wordCount = countWords(currentAnswer);
                const metMinimum = wordCount >= minWords;
                return (
                  <label key={question} className={styles.planLabel}>
                    {index + 1}. {question}
                    <textarea
                      value={currentAnswer}
                      onChange={(event) =>
                        onSetStreakSaveAnswers((current) => ({
                          ...current,
                          [question]: event.target.value.slice(0, 2500),
                        }))
                      }
                      className={styles.feedbackTextarea}
                      rows={5}
                    />
                    <span className={`${styles.mirrorWordCount} ${metMinimum ? styles.mirrorWordCountMet : ""}`}>
                      {wordCount} / {minWords} words
                      {metMinimum ? " met" : ""}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className={styles.mirrorTagSection}>
              <p className={styles.feedbackLabel}>What best describes the miss?</p>
              <div className={styles.mirrorTagRow}>
                {tags.map((tag) => (
                  <button
                    key={tag.value}
                    type="button"
                    className={`${styles.mirrorTagButton} ${
                      streakMirrorTag === tag.value ? styles.mirrorTagButtonActive : ""
                    }`}
                    style={{ ["--mirror-accent" as const]: tag.accent } as CSSProperties}
                    onClick={() => onSetStreakMirrorTag(tag.value)}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
            {streakSaveStatus && <p className={styles.feedbackStatus}>{streakSaveStatus}</p>}
            <div className={styles.noteFooterActions}>
              <button
                type="button"
                className={styles.feedbackSubmit}
                onClick={onClaimSickDaySave}
                disabled={
                  !streakSaveQuestionnairePreview &&
                  (questions.some((question) => countWords(streakSaveAnswers[question] ?? "") < minWords) ||
                    !streakMirrorTag)
                }
              >
                {streakSaveQuestionnairePreview ? "Close preview" : "Save to Streak Mirror"}
              </button>
              <button type="button" className={styles.secondaryPlanButton} onClick={closeStreakSaveQuestionnaire}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!notificationsBlocked && sickDaySavePromptOpen && ((Boolean(rawYesterdayMissed) && !Boolean(yesterdaySave)) || sickDaySavePromptPreview) && (
        <div className={styles.feedbackOverlay} onClick={onDismissSickDaySavePrompt}>
          <div className={styles.feedbackModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>
                {sickDaySaveEligible ? "Your streak is at risk from yesterday" : "Your streak reset yesterday"}
              </h2>
              <button type="button" className={styles.feedbackClose} onClick={onDismissSickDaySavePrompt}>
                Later
              </button>
            </div>
            <p className={styles.feedbackMeta}>
              {sickDaySaveEligible
                ? "You missed yesterday, so the streak will reset unless you use a private Streak Mirror save. Open it now if the miss was genuinely caused by sickness."
                : monthlySaveLimitReached
                  ? "You missed yesterday and the streak reset. Your Streak Mirror is still there to review patterns, but this month has already used all available saves."
                  : "You missed yesterday and the streak reset. Open Streak Mirror to review what happened and reset clearly."}
            </p>
            <div className={styles.noteFooterActions}>
              <button type="button" className={styles.feedbackSubmit} onClick={onOpenSickDaySaveReview}>
                {sickDaySaveEligible ? "Open Streak Mirror save" : "Open Streak Mirror"}
              </button>
              <button type="button" className={styles.secondaryPlanButton} onClick={onDismissSickDaySavePrompt}>
                Ask later
              </button>
            </div>
          </div>
        </div>
      )}

      {!notificationsBlocked && (noteUndoItem || deletedPlanUndo) && (
        <div className={styles.undoToast}>
          <span>{noteUndoItem ? `Deleted note: ${noteUndoItem.title || "Untitled note"}` : "Removed planned block"}</span>
          {noteUndoItem && (
            <button type="button" onClick={onUndoDeleteNote}>
              Undo note
            </button>
          )}
          {deletedPlanUndo && (
            <button type="button" onClick={onUndoDeletePlan}>
              Undo plan
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {!notificationsBlocked && streakCelebration ? (
          <StreakCelebrationToast
            celebration={streakCelebration}
            onDismiss={onDismissStreakCelebration}
            getStreakTierColorTheme={getStreakTierColorTheme}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {!notificationsBlocked && streakNudge ? (
          <StreakNudgeToast
            nudge={streakNudge}
            onDismiss={onDismissStreakNudge}
            onAction={onStreakNudgeAction}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function StreakCelebrationToast({
  celebration,
  onDismiss,
  getStreakTierColorTheme,
}: {
  celebration: StreakCelebrationState;
  onDismiss: () => void;
  getStreakTierColorTheme: (tierColor: string | null | undefined) => {
    accent: string;
    accentStrong: string;
    accentGlow: string;
  };
}) {
  const tierTheme = getStreakTierColorTheme(celebration.tier?.color);
  const rewardStyle = {
    "--reward-accent": tierTheme.accent,
    "--reward-accent-strong": tierTheme.accentStrong,
    "--reward-accent-glow": tierTheme.accentGlow,
  } as CSSProperties;

  return (
    <motion.div
      className={`${styles.sessionRewardToast} ${styles.streakCelebrationToast}`}
      style={rewardStyle}
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.98 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
    >
      <button type="button" className={styles.sessionRewardClose} onClick={onDismiss} aria-label="Dismiss streak celebration">
        ×
      </button>
      <div className={styles.sessionRewardTop}>
        <div>
          <p className={styles.sectionLabel}>Streak secured</p>
          <h3 className={styles.sessionRewardTitle}>Congratulations. {celebration.todayLabel} is protected.</h3>
          <p className={styles.sessionRewardBody}>
            That last point pushed you over the line. Your streak now holds at {celebration.streakAfter} day
            {celebration.streakAfter === 1 ? "" : "s"}.
          </p>
        </div>
        <div className={styles.sessionRewardBadge}>
          <span>{celebration.streakAfter}d</span>
        </div>
      </div>
      <div className={styles.sessionRewardStats}>
        <div className={styles.sessionRewardStat}>
          <span>Today</span>
          <strong>Protected</strong>
        </div>
        <div className={styles.sessionRewardStat}>
          <span>Streak</span>
          <strong>{celebration.streakAfter} day line</strong>
        </div>
        <div className={styles.sessionRewardStat}>
          <span>Tier</span>
          <strong>{celebration.tier?.label ?? "Holding line"}</strong>
        </div>
      </div>
    </motion.div>
  );
}

function StreakNudgeToast({
  nudge,
  onDismiss,
  onAction,
}: {
  nudge: StreakNudgeState;
  onDismiss: () => void;
  onAction: (tab: AppTab) => void;
}) {
  return (
    <motion.div
      className={styles.streakNudgeToast}
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <button type="button" className={styles.sessionRewardClose} onClick={onDismiss} aria-label="Dismiss streak nudge">
        ×
      </button>
      <p className={styles.sectionLabel}>Streak at risk</p>
      <h3 className={styles.streakNudgeTitle}>{nudge.title}</h3>
      <p className={styles.streakNudgeBody}>{nudge.body}</p>
      <div className={styles.noteFooterActions}>
        <button type="button" className={styles.reportButton} onClick={() => onAction(nudge.actionTab)}>
          {nudge.actionLabel}
        </button>
        <button type="button" className={styles.secondaryPlanButton} onClick={onDismiss}>
          Later
        </button>
      </div>
    </motion.div>
  );
}
