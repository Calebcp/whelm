"use client";

import { type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";

import styles from "@/app/page.module.css";
import WhelmProfileAvatar from "@/components/WhelmProfileAvatar";
import { countWords } from "@/lib/date-utils";
import type { AppTab } from "@/lib/app-tabs";
import type { WorkspaceNote } from "@/lib/notes-store";
import type { PlannedBlock } from "@/hooks/usePlannedBlocks";
import type { SessionDoc } from "@/lib/streak";
import type { StreakBandanaTier } from "@/lib/streak-bandanas";
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
  currentTierColor,
  isPro,
  photoUrl,
  nextBandanaMilestone,
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
  currentTierColor: string | null | undefined;
  isPro: boolean;
  photoUrl?: string | null;
  nextBandanaMilestone: {
    tier: StreakBandanaTier;
    remainingDays: number;
  } | null;
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
              <div className={styles.feedbackHero}>
                <div className={styles.feedbackHeroAvatar}>
                  <WhelmProfileAvatar
                    tierColor={currentTierColor}
                    size="row"
                    isPro={isPro}
                    photoUrl={photoUrl}
                  />
                </div>
                <div className={styles.feedbackHeroCopy}>
                  <h2 className={styles.feedbackTitle}>Streak Mirror</h2>
                  {nextBandanaMilestone ? (
                    <p className={styles.feedbackHeroMeta}>
                      {nextBandanaMilestone.remainingDays} more day
                      {nextBandanaMilestone.remainingDays === 1 ? "" : "s"} to {nextBandanaMilestone.tier.label}.
                    </p>
                  ) : (
                    <p className={styles.feedbackHeroMeta}>Keep the line honest.</p>
                  )}
                </div>
              </div>
              <button type="button" className={styles.feedbackClose} onClick={closeStreakSaveQuestionnaire}>
                Close
              </button>
            </div>
            <p className={styles.feedbackMeta}>
              {streakSaveQuestionnairePreview
                ? "Preview only. No streak changes."
                : "Private to you. Whelm uses this only for your own accountability."}
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
              <div className={styles.feedbackHero}>
                <div className={styles.feedbackHeroAvatar}>
                  <WhelmProfileAvatar
                    tierColor={currentTierColor}
                    size="row"
                    isPro={isPro}
                    photoUrl={photoUrl}
                  />
                </div>
                <div className={styles.feedbackHeroCopy}>
                  <h2 className={styles.feedbackTitle}>
                    {sickDaySaveEligible ? "Yesterday put the line at risk." : "Yesterday reset the line."}
                  </h2>
                  <p className={styles.feedbackHeroMeta}>
                    {sickDaySaveEligible
                      ? "Whelm can still help you protect it."
                      : "Reset clearly. Keep moving."}
                  </p>
                </div>
              </div>
              <button type="button" className={styles.feedbackClose} onClick={onDismissSickDaySavePrompt}>
                Later
              </button>
            </div>
            <p className={styles.feedbackMeta}>
              {sickDaySaveEligible
                ? "If yesterday was a real sick-day miss, open Streak Mirror now."
                : monthlySaveLimitReached
                  ? "This month has no saves left. You can still review the miss in Streak Mirror."
                  : "Open Streak Mirror to review the miss and reset cleanly."}
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
            currentTierColor={currentTierColor}
            isPro={isPro}
            photoUrl={photoUrl}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {!notificationsBlocked && streakNudge ? (
          <StreakNudgeToast
            nudge={streakNudge}
            onDismiss={onDismissStreakNudge}
            onAction={onStreakNudgeAction}
            currentTierColor={currentTierColor}
            isPro={isPro}
            photoUrl={photoUrl}
            nextBandanaMilestone={nextBandanaMilestone}
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
  currentTierColor,
  isPro,
  photoUrl,
}: {
  celebration: StreakCelebrationState;
  onDismiss: () => void;
  getStreakTierColorTheme: (tierColor: string | null | undefined) => {
    accent: string;
    accentStrong: string;
    accentGlow: string;
  };
  currentTierColor: string | null | undefined;
  isPro: boolean;
  photoUrl?: string | null;
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
        <div className={styles.sessionRewardAvatarWrap}>
          <WhelmProfileAvatar
            tierColor={currentTierColor}
            size="mini"
            isPro={isPro}
          />
        </div>
        <div>
          <p className={styles.sectionLabel}>Whelm secured it</p>
          <h3 className={styles.sessionRewardTitle}>{celebration.todayLabel} is protected.</h3>
          <p className={styles.sessionRewardBody}>
            The line now holds at {celebration.streakAfter} day
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
          <strong>{celebration.tier?.label ?? "Steady"}</strong>
        </div>
      </div>
    </motion.div>
  );
}

function StreakNudgeToast({
  nudge,
  onDismiss,
  onAction,
  currentTierColor,
  isPro,
  photoUrl,
  nextBandanaMilestone,
}: {
  nudge: StreakNudgeState;
  onDismiss: () => void;
  onAction: (tab: AppTab) => void;
  currentTierColor: string | null | undefined;
  isPro: boolean;
  photoUrl?: string | null;
  nextBandanaMilestone: {
    tier: StreakBandanaTier;
    remainingDays: number;
  } | null;
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
      <div className={styles.streakNudgeHeader}>
        <div className={styles.sessionRewardAvatarWrap}>
          <WhelmProfileAvatar
            tierColor={currentTierColor}
            size="mini"
            isPro={isPro}
          />
        </div>
        {nextBandanaMilestone ? (
          <div className={styles.streakNudgePreview}>
            <span className={styles.streakNudgePreviewLabel}>Next Whelm</span>
            <strong>{nextBandanaMilestone.tier.label}</strong>
            <span>
              {nextBandanaMilestone.remainingDays} day
              {nextBandanaMilestone.remainingDays === 1 ? "" : "s"} away
            </span>
          </div>
        ) : null}
      </div>
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
