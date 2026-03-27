"use client";

import { type Ref } from "react";
import { motion } from "motion/react";

import styles from "@/app/page.module.css";
import AnimatedTabSection from "@/components/AnimatedTabSection";
import StreakBandana from "@/components/StreakBandana";

// ── Types ────────────────────────────────────────────────────────────────────

type StreakMonthCell = {
  key: string;
  dateKey: string | null;
  dayNumber: number | null;
  isCurrentMonth: boolean;
  isToday: boolean;
  streakLength: number;
  streakTierColor: string | null;
  hasSession: boolean;
  isSaved: boolean;
  leftConnected: boolean;
  rightConnected: boolean;
};

type SickDaySave = {
  dateKey: string;
};

export type StreaksTabProps = {
  sectionRef?: Ref<HTMLElement>;
  primaryRef?: Ref<HTMLElement>;
  // Rules card
  streakRulesOpen: boolean;
  onToggleStreakRules: () => void;
  streakRuleSummaryLine: string;
  streakProgressBlocksLabel: string;
  streakProgressMinutesLabel: string;
  streakProgressWordsLabel: string;
  streakProtectedToday: boolean;
  streakStatusLine: string;
  // Sick day save card
  rawYesterdayMissed: boolean;
  yesterdaySave: SickDaySave | null;
  sickDaySaveEligible: boolean;
  monthlySaveLimitReached: boolean;
  yesterdayKey: string;
  monthlyStreakSaveCount: number;
  streakSaveMonthlyLimit: number;
  onOpenStreakSaveQuestionnaire: () => void;
  onDeclineSickDaySave: () => void;
  onGoToMirror: () => void;
  onGoToToday: () => void;
  // Calendar
  streakMonthLabel: string;
  streakMonthCalendar: StreakMonthCell[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  sessionMinutesByDay: Map<string, number>;
  completedBlocksByDay: Map<string, number>;
  noteWordsByDay: Map<string, number>;
  streakQualifiedDateKeys: string[];
  onGoToTodayFromCalendar: () => void;
};

export default function StreaksTab({
  sectionRef,
  primaryRef,
  streakRulesOpen,
  onToggleStreakRules,
  streakRuleSummaryLine,
  streakProgressBlocksLabel,
  streakProgressMinutesLabel,
  streakProgressWordsLabel,
  streakProtectedToday,
  streakStatusLine,
  rawYesterdayMissed,
  yesterdaySave,
  sickDaySaveEligible,
  monthlySaveLimitReached,
  yesterdayKey,
  monthlyStreakSaveCount,
  streakSaveMonthlyLimit,
  onOpenStreakSaveQuestionnaire,
  onDeclineSickDaySave,
  onGoToMirror,
  onGoToToday,
  streakMonthLabel,
  streakMonthCalendar,
  onPrevMonth,
  onNextMonth,
  sessionMinutesByDay,
  completedBlocksByDay,
  noteWordsByDay,
  streakQualifiedDateKeys,
  onGoToTodayFromCalendar,
}: StreaksTabProps) {
  return (
    <AnimatedTabSection className={styles.streaksShell} sectionRef={sectionRef}>
      <motion.article
        className={`${styles.card} ${styles.streakRulesCard}`}
        ref={primaryRef}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <button
          type="button"
          className={styles.streakRulesToggle}
          onClick={onToggleStreakRules}
          aria-expanded={streakRulesOpen}
        >
          <span>How a streak day is earned</span>
          <span className={styles.streakRulesToggleDots}>{streakRulesOpen ? "Close" : "•••"}</span>
        </button>
        {streakRulesOpen && (
          <motion.div
            className={styles.streakRulesPanel}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className={styles.accountMeta}>{streakRuleSummaryLine}</p>
            <div className={styles.streakRulesList}>
              <div className={styles.streakRuleChip}>
                <strong>{streakProgressBlocksLabel}</strong>
                <span>Completed block</span>
              </div>
              <div className={styles.streakRulesEffortGroup}>
                <div className={styles.streakRuleChip}>
                  <strong>{streakProgressMinutesLabel}</strong>
                  <span>Focus option</span>
                </div>
                <div className={styles.streakRuleOrBubble}>OR</div>
                <div className={styles.streakRuleChip}>
                  <strong>{streakProgressWordsLabel}</strong>
                  <span>Writing option</span>
                </div>
              </div>
            </div>
            <p
              className={`${styles.streakRuleStatus} ${
                streakProtectedToday ? styles.streakRuleStatusProtected : ""
              }`}
            >
              {streakStatusLine}
            </p>
          </motion.div>
        )}
      </motion.article>

      {(rawYesterdayMissed || yesterdaySave) &&
        (sickDaySaveEligible || monthlySaveLimitReached || Boolean(yesterdaySave)) && (
        <article className={`${styles.card} ${styles.streakSaveCard}`}>
          <div>
            <p className={styles.sectionLabel}>Streak Saver</p>
            <h3 className={styles.cardTitle}>Sick day save</h3>
            <p className={styles.accountMeta}>
              {yesterdaySave
                ? "Yesterday was protected as a sick day. Today still needs a real session."
                : sickDaySaveEligible
                  ? `If you genuinely missed ${new Date(`${yesterdayKey}T00:00:00`).toLocaleDateString(
                      undefined,
                      { weekday: "long" },
                    )} because you were sick, you can protect that one day now.`
                  : `No sick day save is available right now.${
                      monthlySaveLimitReached
                        ? ` You have used ${monthlyStreakSaveCount}/${streakSaveMonthlyLimit} saves this month.`
                        : ""
                    }`}
            </p>
            <p className={styles.streakSaveCounter}>
              Streak saves this month: {monthlyStreakSaveCount}/{streakSaveMonthlyLimit}
            </p>
          </div>
          <div className={styles.noteFooterActions}>
            {sickDaySaveEligible ? (
              <>
                <button
                  type="button"
                  className={styles.reportButton}
                  onClick={onOpenStreakSaveQuestionnaire}
                >
                  Open Streak Mirror
                </button>
                <button
                  type="button"
                  className={styles.secondaryPlanButton}
                  onClick={onDeclineSickDaySave}
                >
                  Let the streak reset
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.secondaryPlanButton}
                onClick={monthlySaveLimitReached ? onGoToMirror : onGoToToday}
              >
                {monthlySaveLimitReached ? "Open Streak Mirror" : "Return to Today"}
              </button>
            )}
          </div>
        </article>
      )}

      <motion.article
        className={`${styles.card} ${styles.streakCalendarCard}`}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.sectionLabel}>Calendar</p>
            <h2 className={styles.cardTitle}>Real month streak view</h2>
          </div>
          <div className={styles.noteFooterActions}>
            <button
              type="button"
              className={styles.secondaryPlanButton}
              onClick={onPrevMonth}
            >
              Prev
            </button>
            <strong className={styles.streakCalendarMonthLabel}>{streakMonthLabel}</strong>
            <button
              type="button"
              className={styles.secondaryPlanButton}
              onClick={onNextMonth}
            >
              Next
            </button>
          </div>
        </div>
        <div className={styles.streakWeekHeader}>
          <span>S</span>
          <span>M</span>
          <span>T</span>
          <span>W</span>
          <span>T</span>
          <span>F</span>
          <span>S</span>
        </div>
        <div className={styles.streakMonthGrid}>
          {streakMonthCalendar.map((cell) => {
            const cellFocusMinutes = cell.dateKey ? sessionMinutesByDay.get(cell.dateKey) ?? 0 : 0;
            const cellCompletedBlocks = cell.dateKey ? completedBlocksByDay.get(cell.dateKey) ?? 0 : 0;
            const cellNoteWords = cell.dateKey ? noteWordsByDay.get(cell.dateKey) ?? 0 : 0;
            const cellQualified = cell.dateKey ? streakQualifiedDateKeys.includes(cell.dateKey) : false;
            const title = cell.dateKey
              ? `${cell.dateKey}: ${
                  cellQualified
                    ? cell.isSaved
                      ? `protected sick day, ${cell.streakLength}-day run preserved`
                      : `${cell.streakLength}-day streak earned`
                    : cell.isToday
                      ? `today not earned yet. ${cellCompletedBlocks}/1 block, ${Math.min(
                          30,
                          cellFocusMinutes,
                        )}/30 focus minutes, ${Math.min(33, cellNoteWords)}/33 note words`
                      : cellFocusMinutes > 0 || cellCompletedBlocks > 0 || cellNoteWords > 0
                        ? `activity logged, but streak rule not completed`
                        : "no streak"
                }`
              : "Outside current month";

            return (
              <div
                key={cell.key}
                className={[
                  styles.streakMonthCell,
                  cell.dayNumber ? "" : styles.streakMonthCellEmpty,
                  cell.streakLength > 0 ? styles.streakMonthCellActive : "",
                  cell.streakTierColor ? styles[`streakMonthCellTier${cell.streakTierColor.charAt(0).toUpperCase()}${cell.streakTierColor.slice(1)}`] : "",
                  cell.isSaved ? styles.streakMonthCellSaved : "",
                  cell.leftConnected ? styles.streakMonthCellConnectLeft : "",
                  cell.rightConnected ? styles.streakMonthCellConnectRight : "",
                  cell.isToday ? styles.streakMonthCellToday : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={title}
              >
                {cell.dayNumber ? (
                  <>
                    <span className={styles.streakMonthDayNumber}>{cell.dayNumber}</span>
                    {cell.streakLength > 0 ? (
                      <StreakBandana
                        streakDays={cell.streakLength}
                        className={styles.streakMonthBandana}
                      />
                    ) : null}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className={styles.streakCalendarFooter}>
          <div className={styles.streakCalendarFooterCopy}>
            <strong>{streakProtectedToday ? "Today secured" : "Today still open"}</strong>
            <span>
              {streakProtectedToday
                ? streakStatusLine
                : `${streakProgressBlocksLabel} + (${streakProgressMinutesLabel} or ${streakProgressWordsLabel})`}
            </span>
          </div>
          <button
            type="button"
            className={styles.secondaryPlanButton}
            onClick={onGoToTodayFromCalendar}
          >
            Return to Today
          </button>
        </div>
      </motion.article>
    </AnimatedTabSection>
  );
}
