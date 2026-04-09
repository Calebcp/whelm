"use client";

import { type Ref } from "react";

import styles from "@/app/page.module.css";
import AlarmScreen from "@/components/today-time/AlarmScreen";
import BlockComposerScreen from "@/components/today-time/BlockComposerScreen";
import TimeHubGrid from "@/components/today-time/TimeHubGrid";
import TimerScreen from "@/components/today-time/TimerScreen";
import { type TimerSessionContext } from "@/components/Timer";
import SenseiFigure, { type SenseiVariant } from "@/components/SenseiFigure";
import WhelmRitualScene from "@/components/WhelmRitualScene";
import type { TodayTimeHub } from "@/hooks/useTodayTimeHub";
import type { TodayAlarmInstance } from "@/lib/today-alarm-instances";
import { type WhelBandanaColor } from "@/lib/whelm-mascot";
import type { WorkspaceNote } from "@/lib/notes-store";
import type { SessionDoc } from "@/lib/streak";
import { WHELM_PRO_NAME, WHELM_STANDARD_NAME } from "@/lib/whelm-plans";

// ── Constants ─────────────────────────────────────────────────────────────────

const WHELM_PRO_POSITIONING =
  "Whelm Pro unlocks unlimited history, full customization, and the deeper Whelm command layer.";

// ── Types ────────────────────────────────────────────────────────────────────

type PlannedBlock = {
  id: string;
  dateKey: string;
  title: string;
  timeOfDay: string;
  durationMinutes: number;
  status: "active" | "completed" | "deleted";
};

type FocusMetrics = {
  disciplineScore: number;
  todayMinutes: number;
  todaySessions: number;
  weekMinutes: number;
};

type SenseiGuidance = {
  tone: string;
  ritual: string;
  voiceMode: string;
  actionLabel: string;
  actionTab: string;
};

type TodayHeroCopy = {
  eyebrow: string;
  title: string;
  body: string;
  signatureLine: string;
};

type NextSenseiMilestone = {
  next: number | null;
  remaining: number;
};

// ── Local helpers ─────────────────────────────────────────────────────────────

function normalizeTimeLabel(raw: string) {
  if (!raw) return "Any time";
  const parsed = new Date(`2000-01-01T${raw}:00`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}


function formatSenseiLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SenseiAvatar({
  message,
  variant,
  bandanaColor = "yellow",
  emoteVideoSrc,
  autoPlayEmote = false,
}: {
  message: string;
  variant: SenseiVariant;
  bandanaColor?: WhelBandanaColor;
  emoteVideoSrc?: string;
  autoPlayEmote?: boolean;
}) {
  return (
    <SenseiFigure
      variant={variant}
      bandanaColor={bandanaColor}
      size="card"
      message={message}
      className={styles.senseiAvatarPlacement}
      align="center"
      emoteVideoSrc={emoteVideoSrc}
      autoPlayEmote={autoPlayEmote}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export type TodayTabProps = {
  // Refs
  todaySectionRef?: Ref<HTMLElement>;
  todayTimerRef?: Ref<HTMLDivElement>;
  todaySummaryRef?: Ref<HTMLElement>;
  // Display flags
  isMobileViewport: boolean;
  isPro: boolean;
  resolvedTheme: "dark" | "light";
  liveTodayKey: string;
  // Timer
  todaySessionNoteCount: number;
  // Summary/metrics
  focusMetrics: FocusMetrics;
  streak: number;
  mobileTodayOverviewOpen: boolean;
  nextPlannedBlock: PlannedBlock | null;
  dueReminderNotes: WorkspaceNote[];
  lastSession: SessionDoc | null;
  lastSessionHoursAgo: number | null;
  latestNote: WorkspaceNote | null;
  orderedNotes: WorkspaceNote[];
  todayActivePlannedBlocksCount: number;
  attachableAlarmBlocks: PlannedBlock[];
  activeAlarmCommitmentLabel?: string | null;
  activeAlarmCommitmentMeta?: string | null;
  activeTodayAlarmInstance?: TodayAlarmInstance | null;
  latestMissedTodayAlarmInstance?: TodayAlarmInstance | null;
  // Sensei / companion
  senseiGuidance: SenseiGuidance;
  todayHeroCopy: TodayHeroCopy;
  companionStageLabel: string;
  nextSenseiMilestone: NextSenseiMilestone;
  senseiReaction: string;
  bandanaColor: WhelBandanaColor;
  // Report
  reportCopyStatus: string;
  // Handlers
  onOpenSessionNotes: () => void;
  onSessionStart: (context: TimerSessionContext) => void;
  onSessionAbandon: (context: TimerSessionContext & { elapsedMinutes: number; abandonReason: "reset" | "route_change" | "component_unmount" | "unknown" }) => void;
  userEmail: string;
  onSessionComplete: (note: string, minutesSpent: number, context?: TimerSessionContext) => void;
  onSaveSessionNote: (
    note: string,
    minutesSpent: number,
    context?: TimerSessionContext,
  ) => void | Promise<void>;
  onToggleMobileTodayOverview: () => void;
  onTodayPrimaryAction: () => void;
  onOpenNote: (id: string | null) => void;
  onCreateWorkspaceNote: () => void;
  onCopyWeeklyReport: () => void;
  onUpgrade: () => void;
  onSnoozeActiveAlarm: () => void;
  onClearMissedAlarm: () => void;
  onSavePlannedBlock: (input: {
    id?: string;
    dateKey: string;
    title: string;
    note?: string;
    timeOfDay: string;
    durationMinutes: number;
  }) => boolean;
  onOpenScheduleDay: (dateKey: string) => void;
  // Computed label
  senseiActionTabTitle: string;
  timeHub: TodayTimeHub;
};

export default function TodayTab({
  todaySectionRef,
  todayTimerRef,
  todaySummaryRef,
  isMobileViewport,
  isPro,
  resolvedTheme,
  todaySessionNoteCount,
  focusMetrics,
  streak,
  mobileTodayOverviewOpen,
  nextPlannedBlock,
  dueReminderNotes,
  lastSession,
  lastSessionHoursAgo,
  latestNote,
  orderedNotes,
  todayActivePlannedBlocksCount,
  attachableAlarmBlocks,
  activeAlarmCommitmentLabel: _activeAlarmCommitmentLabel,
  activeAlarmCommitmentMeta: _activeAlarmCommitmentMeta,
  activeTodayAlarmInstance,
  latestMissedTodayAlarmInstance,
  senseiGuidance,
  todayHeroCopy,
  companionStageLabel,
  nextSenseiMilestone,
  senseiReaction,
  bandanaColor,
  reportCopyStatus,
  onOpenSessionNotes,
  onSessionStart,
  onSessionAbandon,
  onSessionComplete,
  onSaveSessionNote,
  onToggleMobileTodayOverview,
  onTodayPrimaryAction,
  onOpenNote,
  onCreateWorkspaceNote,
  onCopyWeeklyReport,
  onUpgrade,
  onSnoozeActiveAlarm,
  onClearMissedAlarm,
  onSavePlannedBlock: _onSavePlannedBlock,
  onOpenScheduleDay: _onOpenScheduleDay,
  senseiActionTabTitle,
  userEmail,
  timeHub,
}: TodayTabProps) {

  return (
    <>
      {timeHub.state.isFullscreen ? (
        <section className={styles.timeToolFullscreenShell}>
          {timeHub.state.activeTool === "timer" ? (
            <TimerScreen
              draft={timeHub.state.timerDraft}
              autoStartToken={timeHub.state.timerAutoStartToken}
              appearance={resolvedTheme}
              isPro={isPro}
              sessionNoteCount={todaySessionNoteCount}
              onClose={timeHub.actions.closeTool}
              onOpenSessionNotes={onOpenSessionNotes}
              onSaveSessionNote={onSaveSessionNote}
              onSessionStart={onSessionStart}
              onSessionAbandon={onSessionAbandon}
              onComplete={onSessionComplete}
            />
          ) : timeHub.state.activeTool === "block" ? (
            <BlockComposerScreen
              draft={timeHub.state.blockDraft}
              onChange={timeHub.actions.setBlockDraft}
              onClose={timeHub.actions.closeTool}
              onSave={timeHub.actions.saveBlock}
            />
          ) : (
            <AlarmScreen
              alarms={timeHub.state.alarms}
              draft={timeHub.state.alarmDraft}
              attachableBlocks={attachableAlarmBlocks.map((item) => ({
                id: item.id,
                title: item.title,
                dateKey: item.dateKey,
                timeOfDay: item.timeOfDay,
                durationMinutes: item.durationMinutes,
              }))}
              activeInstance={activeTodayAlarmInstance}
              latestMissedInstance={latestMissedTodayAlarmInstance}
              onClose={timeHub.actions.closeTool}
              onStartNew={timeHub.actions.startNewAlarm}
              onChange={timeHub.actions.setAlarmDraft}
              onEdit={timeHub.actions.editAlarm}
              onSave={timeHub.actions.saveAlarm}
              onDelete={timeHub.actions.deleteAlarm}
              onToggle={timeHub.actions.toggleAlarm}
              onSnoozeActive={onSnoozeActiveAlarm}
              onClearMissed={onClearMissedAlarm}
            />
          )}
        </section>
      ) : null}

      <div ref={todayTimerRef}>
        <TimeHubGrid
          bandanaColor={bandanaColor}
          onOpenTimer={() => timeHub.actions.openTool("timer")}
          onOpenBlock={() => timeHub.actions.openTool("block")}
          onOpenAlarm={() => timeHub.actions.openTool("alarm")}
        />
      </div>

      {isMobileViewport && <section className={styles.mobileTodayStack} ref={todaySectionRef}>
        <article className={styles.mobileSummaryCard} ref={todaySummaryRef}>
          <button
            type="button"
            className={styles.mobileSummaryToggle}
            onClick={onToggleMobileTodayOverview}
            aria-expanded={mobileTodayOverviewOpen}
          >
            <div>
              <p className={styles.sectionLabel}>Today</p>
              <strong className={styles.mobileSectionToggleTitle}>Today&apos;s overview</strong>
            </div>
            <span>{mobileTodayOverviewOpen ? "Hide" : "Open"}</span>
          </button>
          {mobileTodayOverviewOpen ? (
            <div className={styles.mobileSummaryBody}>
              <div className={styles.mobileSummaryHeader}>
                <button
                  type="button"
                  className={styles.reportButton}
                  onClick={onTodayPrimaryAction}
                >
                  {senseiGuidance.actionLabel}
                </button>
              </div>
              <div className={styles.mobileSummaryGrid}>
                <div className={styles.mobileSummaryItem}>
                  <span className={styles.mobileSummaryLabel}>Focus</span>
                  <strong>{focusMetrics.todayMinutes}m</strong>
                </div>
                <div className={styles.mobileSummaryItem}>
                  <span className={styles.mobileSummaryLabel}>Sessions</span>
                  <strong>{focusMetrics.todaySessions}</strong>
                </div>
                <div className={styles.mobileSummaryItem}>
                  <span className={styles.mobileSummaryLabel}>Streak</span>
                  <strong>{streak}d</strong>
                </div>
              </div>
              <div className={styles.mobileSummaryRail}>
                <article className={styles.mobileSummaryRailItem}>
                  <span>Next block</span>
                  <strong>{nextPlannedBlock?.title ?? "No block set"}</strong>
                  <small>
                    {nextPlannedBlock
                      ? `${normalizeTimeLabel(nextPlannedBlock.timeOfDay)} · ${nextPlannedBlock.durationMinutes}m`
                      : "Nothing scheduled"}
                  </small>
                </article>
                <article className={styles.mobileSummaryRailItem}>
                  <span>Reminders</span>
                  <strong>{dueReminderNotes.length} due today</strong>
                  <small>
                    {dueReminderNotes[0]?.title ?? "No reminders today"}
                  </small>
                </article>
              </div>
            </div>
          ) : null}
        </article>
      </section>}

      <section className={styles.statsGrid} ref={!isMobileViewport ? todaySectionRef : undefined}>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Discipline Score</span>
          <strong className={styles.statValue}>
            {focusMetrics.disciplineScore}
            <span className={styles.statSuffix}>/100</span>
          </strong>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Focus Today</span>
          <strong className={styles.statValue}>{focusMetrics.todayMinutes}m</strong>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Current Streak</span>
          <strong className={styles.statValue}>
            {streak} day{streak === 1 ? "" : "s"}
          </strong>
        </article>
        <article className={styles.statCard}>
          <span className={styles.statLabel}>Focus Week</span>
          <strong className={styles.statValueSmall}>{focusMetrics.weekMinutes} minutes</strong>
        </article>
      </section>

      {!isMobileViewport && (
        <section className={styles.todayCommandStrip}>
          <article className={styles.todayCommandTile}>
            <span>Next block</span>
            <strong>{nextPlannedBlock?.title ?? "No active block queued"}</strong>
            <small>
              {nextPlannedBlock
                ? `${normalizeTimeLabel(nextPlannedBlock.timeOfDay)} · ${nextPlannedBlock.durationMinutes}m`
                : "Use the Today time hub to place the next move."}
            </small>
          </article>
          <article className={styles.todayCommandTile}>
            <span>Last session</span>
            <strong>
              {lastSession
                ? new Date(lastSession.completedAtISO).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "No session saved"}
            </strong>
            <small>
              {lastSessionHoursAgo !== null
                ? `${Math.round(lastSessionHoursAgo)}h ago`
                : "Start the first clean block of the day."}
            </small>
          </article>
          <article className={styles.todayCommandTile}>
            <span>Return points</span>
            <strong>{dueReminderNotes.length} due today</strong>
            <small>
              {dueReminderNotes[0]?.title
                ? `First return point: ${dueReminderNotes[0].title}`
                : "No reminders are pulling on you right now."}
            </small>
          </article>
          <article className={styles.todayCommandTile}>
            <span>Latest note</span>
            <strong>{latestNote?.title || "No note captured yet"}</strong>
            <small>
              {latestNote
                ? new Date(latestNote.updatedAtISO).toLocaleDateString()
                : "Capture one thought worth returning to."}
            </small>
          </article>
        </section>
      )}

      {!isPro && (
        <section className={styles.adStrip}>
          <p className={styles.adBadge}>{WHELM_PRO_NAME}</p>
          <p className={styles.adCopy}>
            {WHELM_PRO_POSITIONING}
          </p>
          <button type="button" className={styles.inlineUpgrade} onClick={onUpgrade}>
            Upgrade to {WHELM_PRO_NAME}
          </button>
        </section>
      )}

      <section className={styles.mainGrid}>
        <article
          className={`${styles.card} ${styles.senseiCard} ${styles[`senseiCard${senseiGuidance.tone[0].toUpperCase()}${senseiGuidance.tone.slice(1)}`]}`}
        >
          <div className={styles.senseiRitualBackdrop}>
            <WhelmRitualScene variant="orb" />
          </div>
          <div className={styles.senseiCardHeader}>
            <SenseiAvatar
              message={todayHeroCopy.eyebrow}
              variant="neutral"
              bandanaColor={bandanaColor}
              emoteVideoSrc="/emotes/welcomeemoting.mp4"
              autoPlayEmote
            />
            <div className={styles.senseiDialogueStack}>
              <div className={styles.senseiSpeechPanel}>
                <p className={styles.senseiSpeechEyebrow}>Whelm</p>
                <p className={styles.senseiGreeting}>{todayHeroCopy.title}</p>
                <p className={styles.senseiMessage}>{todayHeroCopy.body}</p>
                <p className={styles.senseiSignature}>"{todayHeroCopy.signatureLine}"</p>
              </div>
            </div>
          </div>
          <div className={styles.senseiMetrics}>
            <span className={styles.senseiMetricPill}>
              Presence: {formatSenseiLabel(companionStageLabel)}
            </span>
            <span className={styles.senseiMetricPill}>
              Stance: {formatSenseiLabel(senseiGuidance.ritual)}
            </span>
            <span className={styles.senseiMetricPill}>
              Tone: {formatSenseiLabel(senseiGuidance.voiceMode)}
            </span>
            <span className={styles.senseiMetricPill}>
              Today: {focusMetrics.todaySessions} session
              {focusMetrics.todaySessions === 1 ? "" : "s"}
            </span>
            <span className={styles.senseiMetricPill}>Streak: {streak}d</span>
            <span className={styles.senseiMetricPill}>
              Ready: {todayActivePlannedBlocksCount}
            </span>
            {nextSenseiMilestone.next ? (
              <span className={styles.senseiMetricPill}>
                Next mark: {nextSenseiMilestone.next} ({nextSenseiMilestone.remaining} left)
              </span>
            ) : (
              <span className={styles.senseiMetricPill}>Legend tier unlocked</span>
            )}
          </div>
          <div className={styles.senseiActionRow}>
            <button
              type="button"
              className={styles.reportButton}
              onClick={onTodayPrimaryAction}
            >
              {senseiGuidance.actionLabel}
            </button>
            <span className={styles.accountMeta}>
              Whelm is directing your next move toward {senseiActionTabTitle}.
            </span>
          </div>
          {senseiReaction && <p className={styles.senseiReaction}>{senseiReaction}</p>}
        </article>

        <div className={styles.leftColumn}>
          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.sectionLabel}>Command Center</p>
                <h2 className={styles.cardTitle}>Today under command</h2>
                <p className={styles.accountMeta}>The minimum clear read on whether the day is tightening or drifting.</p>
              </div>
              <button type="button" className={styles.reportButton} onClick={onCopyWeeklyReport}>
                {reportCopyStatus || "Copy Whelm report"}
              </button>
            </div>
            <ul className={styles.commandList}>
              <li>
                <strong>{focusMetrics.todaySessions}</strong> sessions completed
              </li>
              <li>
                <strong>{focusMetrics.todayMinutes}m</strong> focused
              </li>
              <li>
                Last session:{" "}
                <strong>
                  {lastSession
                    ? new Date(lastSession.completedAtISO).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "not started"}
                </strong>
              </li>
              <li>
                <strong>{orderedNotes.filter((note) => note.isPinned).length}</strong> pinned notes
              </li>
            </ul>
          </article>
        </div>

        <aside className={styles.rightColumn}>
          <article className={`${styles.card} ${styles.todayUtilityCard}`}>
            <p className={styles.sectionLabel}>Quick Capture</p>
            <h2 className={styles.cardTitle}>Keep the thought</h2>
            <p className={styles.accountMeta}>Recent notes should be one tap away, not buried under editing chrome.</p>
            <div className={styles.quickNoteList}>
              {orderedNotes.slice(0, 4).map((note) => (
                <button
                  key={note.id}
                  type="button"
                  className={styles.quickNoteItem}
                    onClick={() => {
                      onOpenNote(note.id);
                    }}
                  style={{ backgroundColor: note.color || "#f8fafc" }}
                >
                  <strong>{note.title || "Untitled note"}</strong>
                  <span>{new Date(note.updatedAtISO).toLocaleDateString()}</span>
                </button>
              ))}
              {orderedNotes.length === 0 && (
                <p className={styles.emptyText}>No notes yet. Create your first note.</p>
              )}
            </div>
            <button type="button" className={styles.newNoteButton} onClick={onCreateWorkspaceNote}>
              + New note
            </button>
          </article>

          <article className={`${styles.card} ${styles.todayUtilityCard}`}>
            <p className={styles.sectionLabel}>Due Today</p>
            <h2 className={styles.cardTitle}>Return points</h2>
            <p className={styles.accountMeta}>These are the things that should pull you back into the right lane.</p>
            {dueReminderNotes.length === 0 ? (
              <p className={styles.emptyText}>No note reminders due today.</p>
            ) : (
              <div className={styles.reminderList}>
                {dueReminderNotes.slice(0, 5).map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    className={styles.reminderItem}
                    onClick={() => {
                      onOpenNote(note.id);
                    }}
                  >
                    <strong>{note.title || "Untitled note"}</strong>
                    <span>
                      {new Date(note.reminderAtISO || "").toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </article>

          <article className={`${styles.card} ${styles.todayAccessCard}`}>
            <p className={styles.sectionLabel}>Access</p>
            <p className={styles.accountMeta}>
              {isPro ? WHELM_PRO_NAME : WHELM_STANDARD_NAME}
            </p>
            <p className={styles.accountMeta}>{userEmail}</p>
            {!isPro && (
              <button type="button" className={styles.inlineUpgrade} onClick={onUpgrade}>
                Upgrade to {WHELM_PRO_NAME}
              </button>
            )}
          </article>
        </aside>
      </section>
    </>
  );
}
