"use client";

import { type CSSProperties, type Ref, type RefObject } from "react";
import { motion } from "motion/react";

import styles from "@/app/page.module.css";
import AnimatedTabSection from "@/components/AnimatedTabSection";
import CalendarTonePicker from "@/components/CalendarTonePicker";
import SenseiFigure, { type SenseiVariant } from "@/components/SenseiFigure";
import StreakBandana from "@/components/StreakBandana";
import {
  getCalendarToneMeta,
  getCalendarToneStyle,
  type CalendarTone,
} from "@/lib/calendar-tones";
import { type WhelBandanaColor } from "@/lib/whelm-mascot";

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_PLANNED_BLOCK_MINUTES = 15;
const MAX_PLANNED_BLOCK_MINUTES = 240;

// ── Types ────────────────────────────────────────────────────────────────────

type CalendarView = "month" | "day";

type MonthCell = {
  key: string;
  dayNumber: number | null;
  minutes: number;
  level: 0 | 1 | 2 | 3;
  isCurrentMonth: boolean;
  tone?: CalendarTone;
};

type CalendarEntrySource = "plan" | "reminder" | "session";

type CalendarEntry = {
  id: string;
  source: CalendarEntrySource;
  dateKey: string;
  timeLabel: string;
  sortTime: string;
  title: string;
  subtitle: string;
  preview: string;
  tone: "Blue" | "Mint" | "Violet" | CalendarTone;
  startMinute: number;
  endMinute: number;
  isCompleted?: boolean;
  noteId?: string;
  planId?: string;
};

type AgendaTimingState = "now" | "next" | "upcoming" | "overdue" | "completed" | "logged";

type PlannedBlock = {
  id: string;
  dateKey: string;
  title: string;
  note: string;
  attachmentCount?: number;
  tone?: CalendarTone;
  durationMinutes: number;
  timeOfDay: string;
  sortOrder: number;
  createdAtISO: string;
  updatedAtISO: string;
  status: "active" | "completed";
  completedAtISO?: string;
};

type DayViewItem = CalendarEntry & {
  durationMinutes: number;
  topPct: number;
  heightPct: number;
  overlapIds: string[];
  col: number;
  totalCols: number;
};

type FocusCalendarDay = {
  dateKey: string;
  label: string;
  minutes: number;
  level: 0 | 1 | 2 | 3;
};

type CalendarCompanionPulse = {
  eyebrow: string;
  title: string;
  body: string;
  variant: SenseiVariant;
};

type PlannerSectionsOpen = {
  active: boolean;
  completed: boolean;
  incomplete: boolean;
};

type SelectedDatePlanGroups = {
  visible: PlannedBlock[];
  active: PlannedBlock[];
  completed: PlannedBlock[];
  incomplete: PlannedBlock[];
};

type SelectedDateAgendaStateSummary = {
  activeNow: CalendarEntry | null | undefined;
  nextUp: CalendarEntry | null | undefined;
  overdueCount: number;
  reminderCount: number;
  focusMinutes: number;
};

type DayViewTimeline = {
  startMinute: number;
  endMinute: number;
  totalMinutes: number;
  items: DayViewItem[];
  hourTicks: Array<{ minute: number; label: string }>;
};

// ── Local helpers ─────────────────────────────────────────────────────────────

function normalizeTimeLabel(raw: string) {
  if (!raw) return "Any time";
  const parsed = new Date(`2000-01-01T${raw}:00`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function parseTimeToMinutes(raw: string) {
  const [hh, mm] = raw.split(":").map((part) => Number(part));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 9 * 60;
  return Math.min(24 * 60 - 1, Math.max(0, hh * 60 + mm));
}

function parseMonthInput(value: string) {
  const [yearRaw, monthRaw] = value.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex)) return null;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return new Date(year, monthIndex, 1);
}

function resolveAgendaTimingState(
  dateKey: string,
  startMinute: number,
  endMinute: number,
  completed?: boolean,
): AgendaTimingState {
  if (completed) return "completed";
  const todayKey = new Date().toISOString().slice(0, 10);
  if (dateKey < todayKey) return "overdue";
  if (dateKey > todayKey) return "upcoming";
  const currentMinute = new Date().getHours() * 60 + new Date().getMinutes();
  if (currentMinute >= startMinute && currentMinute < endMinute) return "now";
  if (currentMinute < startMinute) return "next";
  return "overdue";
}

function attachmentIndicatorLabel(count: number) {
  return count === 1 ? "1 file" : `${count} files`;
}

function SenseiAvatar({
  message,
  variant,
  bandanaColor = "yellow",
  compact = false,
}: {
  message: string;
  variant: SenseiVariant;
  bandanaColor?: WhelBandanaColor;
  compact?: boolean;
}) {
  return (
    <SenseiFigure
      variant={variant}
      bandanaColor={bandanaColor}
      size={compact ? "inline" : "card"}
      message={message}
      className={compact ? styles.senseiAvatarCompact : styles.senseiAvatarPlacement}
      align={compact ? "right" : "center"}
    />
  );
}

function CompanionPulse({
  eyebrow,
  title,
  body,
  variant,
  bandanaColor = "yellow",
}: {
  eyebrow: string;
  title: string;
  body: string;
  variant: SenseiVariant;
  bandanaColor?: WhelBandanaColor;
}) {
  return (
    <article className={styles.companionPulse}>
      <div className={styles.companionPulseFigureWrap}>
        <SenseiFigure variant={variant} bandanaColor={bandanaColor} size="badge" className={styles.companionPulseFigure} />
      </div>
      <div className={styles.companionPulseSpeech}>
        <div className={styles.companionPulseCopy}>
          <p className={styles.sectionLabel}>{eyebrow}</p>
          <h3 className={styles.companionPulseTitle}>{title}</h3>
          <p className={styles.companionPulseBody}>{body}</p>
        </div>
      </div>
    </article>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export type ScheduleTabProps = {
  sectionRef?: Ref<HTMLElement>;
  calendarMonthRef?: Ref<HTMLElement>;
  calendarPlannerRef?: Ref<HTMLElement>;
  calendarHeroRef?: RefObject<HTMLDivElement | null>;
  calendarTimelineRef?: Ref<HTMLDivElement>;
  mobileDayTimelineScrollRef?: Ref<HTMLDivElement>;
  // View state
  calendarView: CalendarView;
  calendarMonthLabel: string;
  calendarMonthInput: string;
  calendarJumpDate: string;
  selectedCalendarMonthKey: string;
  mobileCalendarControlsOpen: boolean;
  calendarAuxPanel: "guide" | "agenda" | "streak";
  isMobileViewport: boolean;
  mobileStreakJumpStyle: CSSProperties | undefined;
  streak: number;
  isPro: boolean;
  // Month view
  dynamicMonthCalendar: MonthCell[];
  calendarEntriesByDate: Map<string, CalendarEntry[]>;
  selectedMonthTone: CalendarTone | null;
  calendarHoverEntryId: string | null;
  calendarPinnedEntryId: string | null;
  activeCalendarPreview: CalendarEntry | null;
  // Day view
  selectedDateKey: string;
  isSelectedDateToday: boolean;
  selectedDateSummary: { eyebrow: string; title: string; body: string; label: string };
  selectedDateFocusedMinutes: number;
  selectedDatePlans: PlannedBlock[];
  selectedDateEntries: CalendarEntry[];
  selectedDateDayTone: CalendarTone | null;
  selectedDateCanAddBlocks: boolean;
  dayPortalComposerOpen: boolean;
  bandanaColor: WhelBandanaColor;
  currentTimeMarker: { topPct: number; label: string } | null;
  dayViewTimeline: DayViewTimeline;
  mobileDayTimelineHeight: number;
  activatedCalendarEntryId: string | null;
  activeOverlapPickerItem: DayViewItem | null;
  activeDayViewPreviewItem: DayViewItem | null;
  // Plan form
  planTitle: string;
  planNoteExpanded: boolean;
  planNote: string;
  planTone: CalendarTone | null;
  planConflictWarning: { conflictIds: string[]; message: string } | null;
  planTime: string;
  planDuration: number;
  planStatus: string;
  // Planner sections
  plannerSectionsOpen: PlannerSectionsOpen;
  selectedDatePlanGroups: SelectedDatePlanGroups;
  selectedDateAgendaStateSummary: SelectedDateAgendaStateSummary;
  mobileAgendaEntriesOpen: boolean;
  mobileBlockSheetOpen: boolean;
  draggedPlanId: string | null;
  plannedBlockById: Map<string, PlannedBlock>;
  // Streak heatmap
  focusMetricsCalendar: FocusCalendarDay[];
  historicalStreaksByDay: Map<string, number>;
  // Companion
  calendarCompanionPulse: CalendarCompanionPulse;
  // Handlers — navigation
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSetCalendarView: (view: CalendarView) => void;
  onSetCalendarCursor: (date: Date) => void;
  onSetCalendarJumpDate: (value: string) => void;
  onCalendarJumpGo: () => void;
  onToggleMobileCalendarControls: () => void;
  onSetCalendarAuxPanel: (panel: "guide" | "agenda" | "streak") => void;
  onGoToStreaks: () => void;
  // Handlers — month view
  onApplyMonthTone: (monthKey: string, tone: CalendarTone | null) => void;
  onSelectCalendarDate: (dateKey: string) => void;
  onSetCalendarHoverEntryId: (id: string | null | ((current: string | null) => string | null)) => void;
  onSetCalendarPinnedEntryId: (id: string | null | ((current: string | null) => string | null)) => void;
  onOpenPlannedBlockDetail: (planId: string) => void;
  // Handlers — day view
  onApplyDayTone: (dateKey: string, tone: CalendarTone | null) => void;
  onOpenCalendarBlockComposer: () => void;
  onSetDayPortalComposerOpen: (open: boolean) => void;
  onScrollCalendarTimelineToNow: () => void;
  onShowCalendarHoverPreview: (id: string) => void;
  onScheduleCalendarHoverPreviewClear: (id: string) => void;
  onClearCalendarHoverPreviewDelay: () => void;
  onSetOverlapPickerEntryId: (id: string | null | ((current: string | null) => string | null)) => void;
  onOpenNotesTab: () => void;
  onSetSelectedNoteId: (id: string | null) => void;
  onSetActiveTabHistory: () => void;
  onCompletePlannedBlock: (plan: PlannedBlock) => Promise<void>;
  // Handlers — plan form
  onSetPlanTitle: (title: string) => void;
  onSetPlanNoteExpanded: (expanded: boolean | ((current: boolean) => boolean)) => void;
  onSetPlanNote: (note: string) => void;
  onSetPlanTone: (tone: CalendarTone | null) => void;
  onSetPlanConflictWarning: (warning: { conflictIds: string[]; message: string } | null) => void;
  onSetPlanTime: (time: string) => void;
  onSetPlanDuration: (duration: number) => void;
  onAddPlannedBlock: () => boolean;
  onUpdatePlannedBlockTime: (id: string, time: string) => void;
  onDeletePlannedBlock: (id: string) => void;
  onReorderPlannedBlocks: (dragId: string, dropId: string) => void;
  onSetDraggedPlanId: (id: string | null) => void;
  // Handlers — planner sections
  onSetPlannerSectionsOpen: (updater: (current: PlannerSectionsOpen) => PlannerSectionsOpen) => void;
  onSetMobileAgendaEntriesOpen: (open: boolean | ((current: boolean) => boolean)) => void;
  onSetMobileBlockSheetOpen: (open: boolean) => void;
  // Upgrade
  onUpgrade: () => void;
};

export default function ScheduleTab({
  sectionRef,
  calendarMonthRef,
  calendarPlannerRef,
  calendarHeroRef,
  calendarTimelineRef,
  mobileDayTimelineScrollRef,
  calendarView,
  calendarMonthLabel,
  calendarMonthInput,
  calendarJumpDate,
  selectedCalendarMonthKey,
  mobileCalendarControlsOpen,
  calendarAuxPanel,
  isMobileViewport,
  mobileStreakJumpStyle,
  streak,
  isPro,
  dynamicMonthCalendar,
  calendarEntriesByDate,
  selectedMonthTone,
  calendarHoverEntryId: _calendarHoverEntryId,
  calendarPinnedEntryId,
  activeCalendarPreview,
  selectedDateKey,
  isSelectedDateToday,
  selectedDateSummary,
  selectedDateFocusedMinutes,
  selectedDatePlans: _selectedDatePlans,
  selectedDateEntries,
  selectedDateDayTone,
  selectedDateCanAddBlocks,
  dayPortalComposerOpen,
  bandanaColor,
  currentTimeMarker,
  dayViewTimeline,
  mobileDayTimelineHeight,
  activatedCalendarEntryId,
  activeOverlapPickerItem,
  activeDayViewPreviewItem,
  planTitle,
  planNoteExpanded,
  planNote,
  planTone,
  planConflictWarning,
  planTime,
  planDuration,
  planStatus,
  plannerSectionsOpen,
  selectedDatePlanGroups,
  selectedDateAgendaStateSummary,
  mobileAgendaEntriesOpen,
  mobileBlockSheetOpen,
  draggedPlanId,
  plannedBlockById,
  focusMetricsCalendar,
  historicalStreaksByDay,
  calendarCompanionPulse,
  onPrevMonth,
  onNextMonth,
  onSetCalendarView,
  onSetCalendarCursor,
  onSetCalendarJumpDate,
  onCalendarJumpGo,
  onToggleMobileCalendarControls,
  onSetCalendarAuxPanel,
  onGoToStreaks,
  onApplyMonthTone,
  onSelectCalendarDate,
  onSetCalendarHoverEntryId,
  onSetCalendarPinnedEntryId,
  onOpenPlannedBlockDetail,
  onApplyDayTone,
  onOpenCalendarBlockComposer,
  onSetDayPortalComposerOpen,
  onScrollCalendarTimelineToNow,
  onShowCalendarHoverPreview,
  onScheduleCalendarHoverPreviewClear,
  onClearCalendarHoverPreviewDelay,
  onSetOverlapPickerEntryId,
  onOpenNotesTab,
  onSetSelectedNoteId,
  onSetActiveTabHistory,
  onCompletePlannedBlock,
  onSetPlanTitle,
  onSetPlanNoteExpanded,
  onSetPlanNote,
  onSetPlanTone,
  onSetPlanConflictWarning,
  onSetPlanTime,
  onSetPlanDuration,
  onAddPlannedBlock,
  onUpdatePlannedBlockTime,
  onDeletePlannedBlock,
  onReorderPlannedBlocks,
  onSetDraggedPlanId,
  onSetPlannerSectionsOpen,
  onSetMobileAgendaEntriesOpen,
  onSetMobileBlockSheetOpen,
  onUpgrade,
}: ScheduleTabProps) {
  const visiblePlanTone = (tone: CalendarTone | null | undefined) => (isPro ? (tone ?? null) : null);

  return (
    <AnimatedTabSection className={styles.calendarGrid} sectionRef={sectionRef}>
      <article
        className={`${styles.card} ${calendarView === "month" ? styles.calendarPrimaryExpanded : ""} ${
          calendarView === "month" && selectedMonthTone ? styles[`calendarToneSurface${selectedMonthTone}`] : ""
        } ${calendarView === "month" && selectedMonthTone ? styles.calendarToneSurfaceMonthCard : ""} ${
          calendarView === "day" && selectedDateDayTone ? styles[`calendarToneSurface${selectedDateDayTone}`] : ""
        } ${calendarView === "day" && selectedDateDayTone ? styles.calendarToneSurfaceDayCard : ""}`}
        style={
          calendarView === "month"
            ? getCalendarToneStyle(selectedMonthTone)
            : calendarView === "day"
              ? getCalendarToneStyle(selectedDateDayTone)
              : undefined
        }
        ref={calendarMonthRef}
      >
        <div className={styles.calendarPrimaryHeader}>
          <div>
            <p className={styles.sectionLabel}>Primary View</p>
            <h2 className={styles.cardTitle}>Command board</h2>
          </div>
          {isMobileViewport && (
            <button
              type="button"
              className={styles.mobileStreakJump}
              style={mobileStreakJumpStyle}
              onClick={onGoToStreaks}
            >
              <span className={styles.mobileStreakJumpLabel}>Streak</span>
              <strong>{streak}d</strong>
            </button>
          )}
        </div>
        {!isMobileViewport && (
          <p className={styles.accountMeta}>
            Start here first. Whelm stays nearby, but the calendar leads the page.
          </p>
        )}
        <div className={styles.calendarToolbar}>
          <div className={styles.calendarNav}>
            <button
              type="button"
              className={styles.secondaryPlanButton}
              onClick={onPrevMonth}
            >
              Prev
            </button>
            <strong className={styles.calendarMonthLabel}>{calendarMonthLabel}</strong>
            <button
              type="button"
              className={styles.secondaryPlanButton}
              onClick={onNextMonth}
            >
              Next
            </button>
          </div>
          <div className={styles.compactToolbarRow}>
            <div className={styles.calendarViewSwitch}>
              <button
                type="button"
                className={`${styles.calendarViewButton} ${
                  calendarView === "month" ? styles.calendarViewButtonActive : ""
                }`}
                onClick={() => onSetCalendarView("month")}
              >
                Month
              </button>
              <button
                type="button"
                className={`${styles.calendarViewButton} ${
                  calendarView === "day" ? styles.calendarViewButtonActive : ""
                }`}
                onClick={() => onSetCalendarView("day")}
              >
                Day
              </button>
            </div>
            <div className={styles.mobileInlineActions}>
              {calendarView === "day" && currentTimeMarker && (
                <button
                  type="button"
                  className={styles.calendarSectionButton}
                  onClick={onScrollCalendarTimelineToNow}
                >
                  Now
                </button>
              )}
              {isMobileViewport && calendarView !== "day" && (
                <button
                  type="button"
                  className={styles.calendarSectionButton}
                  onClick={onToggleMobileCalendarControls}
                >
                  {mobileCalendarControlsOpen ? "Hide controls" : "Jump"}
                </button>
              )}
            </div>
          </div>
          {(!isMobileViewport || mobileCalendarControlsOpen) && (
            <div className={styles.calendarJumpRow}>
              <label className={isMobileViewport ? styles.mobileControlField : styles.planLabel}>
                <span>{isMobileViewport ? "Month" : "Month / Year"}</span>
                <input
                  type="month"
                  className={styles.planControl}
                  value={calendarMonthInput}
                  onChange={(event) => {
                    const next = parseMonthInput(event.target.value);
                    if (!next) return;
                    onSetCalendarCursor(next);
                  }}
                />
              </label>
              <label className={isMobileViewport ? styles.mobileControlField : styles.planLabel}>
                <span>{isMobileViewport ? "Date" : "Jump to date"}</span>
                <input
                  type="date"
                  className={styles.planControl}
                  value={calendarJumpDate}
                  onChange={(event) => onSetCalendarJumpDate(event.target.value)}
                />
              </label>
              <button
                type="button"
                className={styles.planAddButton}
                onClick={onCalendarJumpGo}
              >
                Go
              </button>
            </div>
          )}
          {calendarView === "month" && (
            <CalendarTonePicker
              label="Month tone"
              selectedTone={selectedMonthTone}
              onSelectTone={(tone) => onApplyMonthTone(selectedCalendarMonthKey, tone)}
              isPro={isPro}
              onUpgrade={onUpgrade}
            />
          )}
          {!isMobileViewport && (
            <div className={styles.calendarSectionNav}>
              <button
                type="button"
                className={styles.calendarSectionButton}
                onClick={() => onSetCalendarAuxPanel("guide")}
              >
                Guide
              </button>
              <button
                type="button"
                className={styles.calendarSectionButton}
                onClick={() => onSetCalendarAuxPanel("streak")}
              >
                Streak
              </button>
              <button
                type="button"
                className={styles.calendarSectionButton}
                onClick={() => onSetCalendarAuxPanel("agenda")}
              >
                Agenda
              </button>
            </div>
          )}
        </div>
        {calendarView === "month" ? (
          <>
            <div id="calendar-main-view" className={styles.calendarHeader}>
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>
            <div className={styles.monthGrid}>
              {dynamicMonthCalendar.map((day) => {
                const effectiveDayTone =
                  day.dayNumber && day.key === selectedDateKey
                    ? selectedDateDayTone ?? day.tone
                    : day.tone;

                return (
                <motion.button
                  type="button"
                  key={day.key}
                  className={`${styles.monthDayCell} ${
                    effectiveDayTone ? "" : styles[`streakLevel${day.level}`]
                  } ${
                    day.dayNumber && day.key === selectedDateKey ? styles.monthDayCellSelected : ""
                  } ${effectiveDayTone ? styles[`calendarToneSurface${effectiveDayTone}`] : ""} ${
                    effectiveDayTone ? styles.calendarToneSurfaceDay : ""
                  } ${
                    day.dayNumber && day.key === selectedDateKey && effectiveDayTone
                      ? styles.monthDayCellToneSelected
                      : ""
                  }`}
                  style={getCalendarToneStyle(effectiveDayTone)}
                  disabled={!day.dayNumber}
                  title={
                    day.dayNumber
                      ? `${day.dayNumber}: ${day.minutes}m focus, ${
                          (calendarEntriesByDate.get(day.key) ?? []).length
                        } entries`
                      : "Outside current month"
                  }
                  onClick={() => {
                    if (!day.dayNumber) return;
                    onSelectCalendarDate(day.key);
                  }}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.24,
                    delay: Math.min((day.dayNumber ?? 0) * 0.006, 0.18),
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {day.dayNumber && (
                    <>
                      <div className={styles.monthDayHead}>
                        <span className={styles.monthDayNumber}>{day.dayNumber}</span>
                        <span className={styles.monthDayMinutes}>{day.minutes}m</span>
                      </div>
                      <div className={styles.monthEntries}>
                        {(calendarEntriesByDate.get(day.key) ?? []).slice(0, 2).map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            className={`${styles.monthEntryChip} ${
                              styles[`monthEntry${entry.tone}`]
                            } ${entry.isCompleted ? styles.monthEntryCompleted : ""}`}
                            onMouseEnter={() => onSetCalendarHoverEntryId(entry.id)}
                            onMouseLeave={() => onSetCalendarHoverEntryId((current) =>
                              current === entry.id ? null : current,
                            )}
                            onFocus={() => onSetCalendarHoverEntryId(entry.id)}
                            onBlur={() => onSetCalendarHoverEntryId((current) =>
                              current === entry.id ? null : current,
                            )}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onSelectCalendarDate(day.key);
                              if (entry.source === "plan" && entry.planId) {
                                onOpenPlannedBlockDetail(entry.planId);
                                return;
                              }
                              onSetCalendarPinnedEntryId((current) =>
                                current === entry.id ? null : entry.id,
                              );
                            }}
                          >
                            {entry.timeLabel} {entry.title}
                          </button>
                        ))}
                        {(calendarEntriesByDate.get(day.key) ?? []).length > 2 && (
                          <span className={styles.monthMoreChip}>
                            +{(calendarEntriesByDate.get(day.key) ?? []).length - 2} more
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </motion.button>
                );
              })}
            </div>
          </>
        ) : (
            <div className={styles.dayViewShell}>
            <div id="calendar-day-chamber" className={styles.dayPortalCard}>
              <div
                className={`${styles.dayPortalBody} ${
                  selectedDateDayTone ? styles[`calendarToneSurface${selectedDateDayTone}`] : ""
                } ${selectedDateDayTone ? styles.calendarToneSurfaceDayPortal : ""}`}
                style={getCalendarToneStyle(selectedDateDayTone)}
              >
                <div className={styles.dayPortalCopy}>
                  <div className={styles.dayPortalHeader}>
                    <div>
                      <p className={styles.sectionLabel}>
                        {isSelectedDateToday ? "Today Chamber" : selectedDateSummary.eyebrow}
                      </p>
                      <h3 className={styles.dayPortalTitle}>{selectedDateSummary.title}</h3>
                    </div>
                    <div className={styles.dayPortalActions}>
                      <button
                        type="button"
                        className={`${styles.planAddButton} ${styles.dayPortalBlockButton}`}
                        onClick={onOpenCalendarBlockComposer}
                      >
                        + Block
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryPlanButton}
                        onClick={() => onSetCalendarView("month")}
                      >
                        Back to month
                      </button>
                      {isMobileViewport && (
                        <button
                          type="button"
                          className={styles.calendarSectionButton}
                          onClick={onToggleMobileCalendarControls}
                        >
                          Jump
                        </button>
                      )}
                    </div>
                  </div>
                  {!isMobileViewport && (
                    <p className={styles.dayPortalMeta}>{selectedDateSummary.body}</p>
                  )}
                  {!isMobileViewport && (
                    <div className={styles.dayPortalStats}>
                      <span className={styles.dayPortalPill}>
                        Focus: {selectedDateFocusedMinutes}m
                      </span>
                      <span className={styles.dayPortalPill}>
                        Plans: {selectedDatePlanGroups.visible.length}
                      </span>
                      <span className={styles.dayPortalPill}>
                        Entries: {selectedDateEntries.length}
                      </span>
                    </div>
                  )}
                  <CalendarTonePicker
                    label="Day tone"
                    selectedTone={selectedDateDayTone}
                    onSelectTone={(tone) => onApplyDayTone(selectedDateKey, tone)}
                    isPro={isPro}
                    onUpgrade={onUpgrade}
                  />
                  {!isMobileViewport && dayPortalComposerOpen && (
                    <div id="calendar-planner" className={styles.dayPortalComposer}>
                      <div className={styles.dayPortalComposerHeader}>
                        <div>
                          <p className={styles.sectionLabel}>Add Block</p>
                          <p className={styles.accountMeta}>
                            Place the next block without leaving the day view.
                          </p>
                        </div>
                        <button
                          type="button"
                          className={styles.secondaryPlanButton}
                          onClick={() => onSetDayPortalComposerOpen(false)}
                        >
                          Close
                        </button>
                      </div>
                      <input
                        value={planTitle}
                        onChange={(event) => onSetPlanTitle(event.target.value)}
                        placeholder="Task title (e.g. Deep work sprint)"
                        className={styles.planInput}
                        disabled={!selectedDateCanAddBlocks}
                      />
                      <div className={styles.planNoteRow}>
                        <button
                          type="button"
                          className={styles.planNoteToggle}
                          onClick={() => onSetPlanNoteExpanded((current) => !current)}
                        >
                          {planNoteExpanded || planNote ? "Hide note" : "+ Note"}
                        </button>
                      </div>
                      {planNoteExpanded && (
                        <textarea
                          value={planNote}
                          onChange={(event) => onSetPlanNote(event.target.value.slice(0, 280))}
                          placeholder="Optional note, intention, or instruction for this block"
                          className={styles.planNoteInput}
                          disabled={!selectedDateCanAddBlocks}
                        />
                      )}
                      <CalendarTonePicker
                        label="Block tone"
                        selectedTone={planTone}
                        onSelectTone={onSetPlanTone}
                        isPro={isPro}
                        onUpgrade={onUpgrade}
                      />
                      {planConflictWarning && (
                        <div className={styles.planConflictBanner}>
                          <p className={styles.planConflictText}>{planConflictWarning.message}</p>
                          <div className={styles.planConflictActions}>
                            <button
                              type="button"
                              className={styles.secondaryPlanButton}
                              onClick={() => onSetPlanConflictWarning(null)}
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      )}
                      <div className={styles.planFormRow}>
                        <label className={styles.planLabel}>
                          Time
                          <input
                            type="time"
                            value={planTime}
                            onChange={(event) => onSetPlanTime(event.target.value)}
                            className={styles.planControl}
                            disabled={!selectedDateCanAddBlocks}
                          />
                        </label>
                        <label className={styles.planLabel}>
                          Minutes
                          <input
                            type="number"
                            min={MIN_PLANNED_BLOCK_MINUTES}
                            max={MAX_PLANNED_BLOCK_MINUTES}
                            value={planDuration}
                            onChange={(event) => {
                              const next = Number(event.target.value);
                              if (Number.isFinite(next)) {
                                onSetPlanDuration(next);
                              }
                            }}
                            className={styles.planControl}
                            disabled={!selectedDateCanAddBlocks}
                          />
                        </label>
                        <button
                          type="button"
                          className={`${styles.planAddButton} ${styles.blockActionButton}`}
                          disabled={!selectedDateCanAddBlocks}
                          onClick={() => {
                            const added = onAddPlannedBlock();
                            if (added) {
                              onSetDayPortalComposerOpen(false);
                            }
                          }}
                        >
                          Add Block
                        </button>
                      </div>
                      {!selectedDateCanAddBlocks ? (
                        <p className={styles.accountMeta}>
                          Past days stay read-only. Blocks can only be added to today or a future day.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
                {!isMobileViewport && (
                  <SenseiAvatar
                    message={
                      selectedDateEntries.length === 0
                        ? "Quiet room. Set the tone."
                        : "You entered the day. Now shape it."
                    }
                    variant={
                      selectedDateEntries.length === 0
                        ? "meditate"
                        : selectedDateFocusedMinutes >= 60
                          ? "victory"
                          : selectedDateEntries.some((entry) => entry.source === "reminder")
                            ? "scholar"
                            : "neutral"
                    }
                    bandanaColor={bandanaColor}
                    compact
                  />
                )}
              </div>
            </div>
            <div
              id="calendar-timeline"
              className={isMobileViewport ? styles.dayViewScrollShell : undefined}
              ref={isMobileViewport ? mobileDayTimelineScrollRef : undefined}
            >
              <div className={styles.dayViewGrid} ref={calendarTimelineRef}>
                <div
                  className={styles.dayViewTicks}
                  style={isMobileViewport ? { height: `${mobileDayTimelineHeight}px` } : undefined}
                >
                  {dayViewTimeline.hourTicks.map((tick) => (
                    <span key={tick.minute}>{tick.label}</span>
                  ))}
                  {currentTimeMarker && (
                    <span
                      className={styles.dayViewNowLabel}
                      style={{ top: `${currentTimeMarker.topPct}%` }}
                    >
                      {currentTimeMarker.label}
                    </span>
                  )}
                </div>
                <div
                  className={styles.dayViewTrack}
                  style={isMobileViewport ? { height: `${mobileDayTimelineHeight}px` } : undefined}
                  onClick={() => {
                    onSetCalendarPinnedEntryId(null);
                    onSetOverlapPickerEntryId(null);
                  }}
                >
                  {dayViewTimeline.hourTicks.map((tick) => (
                    <div
                      key={tick.minute}
                      className={styles.dayViewRow}
                      style={{
                        top: `${((tick.minute - dayViewTimeline.startMinute) / dayViewTimeline.totalMinutes) * 100}%`,
                      }}
                    />
                  ))}
                  {currentTimeMarker && (
                    <div
                      className={styles.dayViewNowLine}
                      style={{ top: `${currentTimeMarker.topPct}%` }}
                    >
                      <span className={styles.dayViewNowDot} />
                    </div>
                  )}
                  {dayViewTimeline.items.map((entry) => (
                    <motion.button
                      type="button"
                      key={`timeline-${entry.id}`}
                      data-calendar-entry-id={entry.id}
                      className={`${styles.dayViewEvent} ${styles[`dayViewEvent${entry.tone}`]} ${
                        isMobileViewport ? styles.dayViewEventMobile : ""
                      } ${entry.durationMinutes < 40 ? styles.dayViewEventCompact : ""} ${
                        activatedCalendarEntryId === entry.id ? styles.dayViewEventActivated : ""
                      } ${entry.isCompleted ? styles.dayViewEventCompleted : ""} ${
                        entry.isCompleted ? styles.dayViewEventResolved : ""
                      } ${entry.source === "plan" && getCalendarToneMeta(entry.tone as CalendarTone)
                        ? styles.calendarToneSurfaceBlock
                        : ""}`}
                      style={{
                        top: `${entry.topPct}%`,
                        height: `${entry.heightPct}%`,
                        left: entry.totalCols > 1 ? `calc(${(entry.col / entry.totalCols) * 100}% + ${entry.col > 0 ? "2px" : "0px"})` : undefined,
                        width: entry.totalCols > 1 ? `calc(${(1 / entry.totalCols) * 100}% - ${entry.col > 0 ? "2px" : "0px"})` : undefined,
                        zIndex: entry.totalCols > 1 ? 10 + entry.col : undefined,
                        ...getCalendarToneStyle(
                          entry.source === "plan" ? (entry.tone as CalendarTone) : null,
                        ),
                      }}
                      onMouseEnter={() => onShowCalendarHoverPreview(entry.id)}
                      onMouseLeave={() => onScheduleCalendarHoverPreviewClear(entry.id)}
                      onFocus={() => onShowCalendarHoverPreview(entry.id)}
                      onBlur={() => onScheduleCalendarHoverPreviewClear(entry.id)}
                      onClick={(event) => {
                        event.stopPropagation();
                        onClearCalendarHoverPreviewDelay();
                        if (entry.source === "plan" && entry.planId) {
                          onOpenPlannedBlockDetail(entry.planId);
                          return;
                        }
                        onSetCalendarPinnedEntryId((current) => (current === entry.id ? null : entry.id))
                      }}
                      initial={{ opacity: 0, x: -8, scale: 0.98 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <span className={styles.dayViewEventTime}>{entry.timeLabel}</span>
                      <strong>{entry.title}</strong>
                      {entry.overlapIds.length > 0 && entry.durationMinutes >= 25 && (
                        <span className={styles.dayViewOverlapWarning}>
                          {"⚠ Overlaps with "}
                          {(() => {
                            const names = entry.overlapIds.slice(0, 2).map((id) => {
                              const ov = dayViewTimeline.items.find((it) => it.id === id);
                              return ov ? ov.title : null;
                            }).filter(Boolean);
                            return names.join(", ");
                          })()}
                        </span>
                      )}
                      {entry.overlapIds.length > 0 && (
                        <span
                          className={styles.dayViewOverlapHandle}
                          onClick={(event) => {
                            event.stopPropagation();
                            onClearCalendarHoverPreviewDelay();
                            onSetCalendarHoverEntryId(null);
                            onSetCalendarPinnedEntryId(null);
                            onSetOverlapPickerEntryId((current) =>
                              current === entry.id ? null : entry.id,
                            );
                          }}
                        >
                          {entry.overlapIds.slice(0, 3).map((overlapId, index) => {
                            const overlapEntry = dayViewTimeline.items.find((item) => item.id === overlapId);
                            if (!overlapEntry) return null;
                            return (
                              <span
                                key={overlapId}
                                className={`${styles.dayViewOverlapSlice} ${
                                  styles[`dayViewOverlapSlice${overlapEntry.tone}`]
                                }`}
                                style={{ right: `${index * 8}px` }}
                              />
                            );
                          })}
                        </span>
                      )}
                    </motion.button>
                  ))}
                </div>
                {activeOverlapPickerItem && activeOverlapPickerItem.overlapIds.length > 0 && (
                  <div
                    className={`${styles.overlapPicker} ${
                      activeOverlapPickerItem.topPct + activeOverlapPickerItem.heightPct / 2 > 55
                        ? styles.overlapPickerAbove
                        : styles.overlapPickerBelow
                    }`}
                    style={
                      activeOverlapPickerItem.topPct + activeOverlapPickerItem.heightPct / 2 > 55
                        ? {
                            bottom: `calc(${100 - activeOverlapPickerItem.topPct + 2}%)`,
                          }
                        : {
                            top: `calc(${
                              Math.min(
                                92,
                                activeOverlapPickerItem.topPct + activeOverlapPickerItem.heightPct + 2,
                              )
                            }%)`,
                          }
                    }
                    onClick={(event) => event.stopPropagation()}
                  >
                    <p className={styles.overlapPickerLabel}>Overlapping blocks</p>
                    <div className={styles.overlapPickerList}>
                      {[activeOverlapPickerItem.id, ...activeOverlapPickerItem.overlapIds].map((optionId) => {
                        const option = dayViewTimeline.items.find((item) => item.id === optionId);
                        if (!option) return null;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={styles.overlapPickerItem}
                            onClick={() => {
                              onSetOverlapPickerEntryId(null);
                              onSetCalendarPinnedEntryId(option.id);
                              onShowCalendarHoverPreview(option.id);
                            }}
                          >
                            <span
                              className={`${styles.overlapPickerSwatch} ${
                                styles[`dayViewOverlapSlice${option.tone}`]
                              }`}
                            />
                            <span>{option.timeLabel}</span>
                            <strong>{option.title}</strong>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {!isMobileViewport && activeCalendarPreview && activeDayViewPreviewItem && (
                  <div
                    className={`${styles.calendarEntryPopover} ${
                      calendarPinnedEntryId ? styles.calendarEntryPopoverPinned : ""
                    } ${
                      activeDayViewPreviewItem.topPct + activeDayViewPreviewItem.heightPct / 2 > 55
                        ? styles.calendarEntryPopoverAbove
                        : styles.calendarEntryPopoverBelow
                    }`}
                    style={
                      activeDayViewPreviewItem.topPct + activeDayViewPreviewItem.heightPct / 2 > 55
                        ? {
                            bottom: `calc(${100 - activeDayViewPreviewItem.topPct + 2}%)`,
                          }
                        : {
                            top: `calc(${
                              Math.min(
                                92,
                                activeDayViewPreviewItem.topPct + activeDayViewPreviewItem.heightPct + 2,
                              )
                            }%)`,
                          }
                    }
                    onMouseEnter={() => {
                      if (!calendarPinnedEntryId) {
                        onShowCalendarHoverPreview(activeCalendarPreview.id);
                      }
                    }}
                    onMouseLeave={() => {
                      if (!calendarPinnedEntryId) {
                        onScheduleCalendarHoverPreviewClear(activeCalendarPreview.id);
                      }
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div>
                      <p className={styles.calendarEntryPreviewLabel}>
                        {new Date(`${activeCalendarPreview.dateKey}T00:00:00`).toLocaleDateString(
                          undefined,
                          { weekday: "short", month: "short", day: "numeric" },
                        )}{" "}
                        • {activeCalendarPreview.timeLabel}
                      </p>
                      <h3 className={styles.calendarEntryPreviewTitle}>
                        {activeCalendarPreview.title}
                      </h3>
                      <p className={styles.calendarEntryPreviewBody}>
                        {activeCalendarPreview.preview}
                      </p>
                    </div>
                    <div className={styles.calendarEntryPreviewActions}>
                      {activeCalendarPreview.source === "reminder" && activeCalendarPreview.noteId && (
                        <button
                          type="button"
                          className={styles.secondaryPlanButton}
                          onClick={() => {
                            onSetSelectedNoteId(activeCalendarPreview.noteId ?? null);
                            onOpenNotesTab();
                          }}
                        >
                          Open note
                        </button>
                      )}
                      {activeCalendarPreview.source === "plan" && activeCalendarPreview.planId && (
                        <button
                          type="button"
                          className={styles.secondaryPlanButton}
                          onClick={() => onOpenPlannedBlockDetail(activeCalendarPreview.planId ?? "")}
                        >
                          Open block
                        </button>
                      )}
                      {activeCalendarPreview.source === "plan" && activeCalendarPreview.planId && (
                        <button
                          type="button"
                          className={styles.planCompleteButton}
                          onClick={() => {
                            const plan = plannedBlockById.get(activeCalendarPreview.planId ?? "");
                            if (!plan) return;
                            void onCompletePlannedBlock(plan);
                          }}
                        >
                          Complete
                        </button>
                      )}
                      {activeCalendarPreview.source === "session" && (
                        <button
                          type="button"
                          className={styles.secondaryPlanButton}
                          onClick={onSetActiveTabHistory}
                        >
                          View history
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.secondaryPlanButton}
                        onClick={() => onSetCalendarPinnedEntryId(null)}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {isMobileViewport && activeCalendarPreview && (
              <div className={styles.calendarEntryPreview}>
                <div>
                  <p className={styles.calendarEntryPreviewLabel}>
                    {new Date(`${activeCalendarPreview.dateKey}T00:00:00`).toLocaleDateString(
                      undefined,
                      { weekday: "short", month: "short", day: "numeric" },
                    )}{" "}
                    • {activeCalendarPreview.timeLabel}
                  </p>
                  <h3 className={styles.calendarEntryPreviewTitle}>
                    {activeCalendarPreview.title}
                  </h3>
                  <p className={styles.calendarEntryPreviewBody}>
                    {activeCalendarPreview.preview}
                  </p>
                </div>
                <div className={styles.calendarEntryPreviewActions}>
                  {activeCalendarPreview.source === "reminder" && activeCalendarPreview.noteId && (
                    <button
                      type="button"
                      className={styles.secondaryPlanButton}
                      onClick={() => {
                        onSetSelectedNoteId(activeCalendarPreview.noteId ?? null);
                        onOpenNotesTab();
                      }}
                    >
                      Open note
                    </button>
                  )}
                  {activeCalendarPreview.source === "plan" && activeCalendarPreview.planId && (
                    <button
                      type="button"
                      className={styles.secondaryPlanButton}
                      onClick={() => onOpenPlannedBlockDetail(activeCalendarPreview.planId ?? "")}
                    >
                      Open block
                    </button>
                  )}
                  {activeCalendarPreview.source === "plan" && activeCalendarPreview.planId && (
                    <button
                      type="button"
                      className={styles.planCompleteButton}
                      onClick={() => {
                        const plan = plannedBlockById.get(activeCalendarPreview.planId ?? "");
                        if (!plan) return;
                        void onCompletePlannedBlock(plan);
                      }}
                    >
                      Complete
                    </button>
                  )}
                  {activeCalendarPreview.source === "session" && (
                    <button
                      type="button"
                      className={styles.secondaryPlanButton}
                      onClick={onSetActiveTabHistory}
                    >
                      View history
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.secondaryPlanButton}
                    onClick={() => onSetCalendarPinnedEntryId(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {calendarView !== "day" && activeCalendarPreview && (
          <div className={styles.calendarEntryPreview}>
            <div>
              <p className={styles.calendarEntryPreviewLabel}>
                {new Date(`${activeCalendarPreview.dateKey}T00:00:00`).toLocaleDateString(
                  undefined,
                  { weekday: "short", month: "short", day: "numeric" },
                )}{" "}
                • {activeCalendarPreview.timeLabel}
              </p>
              <h3 className={styles.calendarEntryPreviewTitle}>
                {activeCalendarPreview.title}
              </h3>
              <p className={styles.calendarEntryPreviewBody}>
                {activeCalendarPreview.preview}
              </p>
            </div>
            <div className={styles.calendarEntryPreviewActions}>
              {activeCalendarPreview.source === "reminder" && activeCalendarPreview.noteId && (
                <button
                  type="button"
                  className={styles.secondaryPlanButton}
                  onClick={() => {
                    onSetSelectedNoteId(activeCalendarPreview.noteId ?? null);
                    onOpenNotesTab();
                  }}
                >
                  Open note
                </button>
              )}
              {activeCalendarPreview.source === "plan" && activeCalendarPreview.planId && (
                <button
                  type="button"
                  className={styles.secondaryPlanButton}
                  onClick={() => onOpenPlannedBlockDetail(activeCalendarPreview.planId ?? "")}
                >
                  Open block
                </button>
              )}
              {activeCalendarPreview.source === "plan" && activeCalendarPreview.planId && (
                <button
                  type="button"
                  className={styles.planCompleteButton}
                  onClick={() => {
                    const plan = plannedBlockById.get(activeCalendarPreview.planId ?? "");
                    if (!plan) return;
                    void onCompletePlannedBlock(plan);
                  }}
                >
                  Complete
                </button>
              )}
              {activeCalendarPreview.source === "session" && (
                <button
                  type="button"
                  className={styles.secondaryPlanButton}
                  onClick={onSetActiveTabHistory}
                >
                  View history
                </button>
              )}
              <button
                type="button"
                className={styles.secondaryPlanButton}
                onClick={() => onSetCalendarPinnedEntryId(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </article>

      {!isMobileViewport && (
      <article
        className={`${styles.card} ${styles.calendarAuxCard} ${
          calendarView === "day" && selectedDateDayTone ? styles[`calendarToneSurface${selectedDateDayTone}`] : ""
        } ${calendarView === "day" && selectedDateDayTone ? styles.calendarToneSurfaceDayCard : ""}`}
        style={calendarView === "day" ? getCalendarToneStyle(selectedDateDayTone) : undefined}
        ref={calendarPlannerRef}
      >
        <div className={styles.calendarAuxTabs}>
          <button
            type="button"
            className={`${styles.calendarAuxTab} ${
              calendarAuxPanel === "agenda" ? styles.calendarAuxTabActive : ""
            }`}
            onClick={() => onSetCalendarAuxPanel("agenda")}
          >
            Agenda
          </button>
          <button
            type="button"
            className={`${styles.calendarAuxTab} ${
              calendarAuxPanel === "streak" ? styles.calendarAuxTabActive : ""
            }`}
            onClick={() => onSetCalendarAuxPanel("streak")}
          >
            Streak
          </button>
          <button
            type="button"
            className={`${styles.calendarAuxTab} ${
              calendarAuxPanel === "guide" ? styles.calendarAuxTabActive : ""
            }`}
            onClick={() => onSetCalendarAuxPanel("guide")}
          >
            Guide
          </button>
        </div>

        {calendarAuxPanel === "guide" && (
          <div ref={calendarHeroRef}>
            <CompanionPulse {...calendarCompanionPulse} bandanaColor={bandanaColor} />
          </div>
        )}

        {calendarAuxPanel === "streak" && (
          <>
            <p className={styles.sectionLabel}>Last 4 Weeks</p>
            <h2 className={styles.cardTitle}>Streak heatmap</h2>
            <div className={styles.streakGrid}>
              {focusMetricsCalendar.map((day, index, days) => {
                const previous = days[index - 1];
                const next = days[index + 1];
                const historicalStreakLength = historicalStreaksByDay.get(day.dateKey) ?? 0;
                const streakDay = historicalStreakLength > 0;
                const leftConnected =
                  streakDay &&
                  index % 14 !== 0 &&
                  (historicalStreaksByDay.get(previous?.dateKey ?? "") ?? 0) > 0;
                const rightConnected =
                  streakDay &&
                  index % 14 !== 13 &&
                  (historicalStreaksByDay.get(next?.dateKey ?? "") ?? 0) > 0;

                return (
                  <div
                    key={day.dateKey}
                    className={[
                      styles.streakCell,
                      styles[`streakLevel${day.level}`],
                      streakDay ? styles.streakCellRun : "",
                      leftConnected ? styles.streakCellConnectLeft : "",
                      rightConnected ? styles.streakCellConnectRight : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    title={`${day.label}: ${day.minutes}m`}
                  >
                    {streakDay ? <StreakBandana streakDays={historicalStreakLength} /> : null}
                  </div>
                );
              })}
            </div>
            <div className={styles.streakLegend}>
              <span>No focus</span>
              <span>Light</span>
              <span>Strong</span>
              <span>Deep</span>
            </div>
            <p className={styles.streakLegendNote}>Moving bandana = streak day</p>
          </>
        )}

        {calendarAuxPanel === "agenda" && (
          <>
            <p className={styles.sectionLabel}>Scheduler</p>
            <h2 className={styles.cardTitle}>
              {isMobileViewport ? "Day overview for " : "Day agenda for "}
              {new Date(`${selectedDateKey}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </h2>
            <p className={styles.accountMeta}>
              {selectedDateEntries.length} entries: {selectedDatePlanGroups.visible.length} planned,{" "}
              {selectedDateEntries.filter((entry) => entry.source === "reminder").length} reminders,{" "}
              {selectedDateEntries.filter((entry) => entry.source === "session").length} completed sessions
            </p>
            <div className={styles.agendaCommandGrid}>
              <article className={styles.agendaCommandCard}>
                <span>Now</span>
                <strong>{selectedDateAgendaStateSummary.activeNow?.title ?? "No active block"}</strong>
                <small>
                  {selectedDateAgendaStateSummary.activeNow
                    ? selectedDateAgendaStateSummary.activeNow.timeLabel
                    : "The room is open for the next deliberate block."}
                </small>
              </article>
              <article className={styles.agendaCommandCard}>
                <span>Next</span>
                <strong>{selectedDateAgendaStateSummary.nextUp?.title ?? "No queued block"}</strong>
                <small>
                  {selectedDateAgendaStateSummary.nextUp
                    ? `${selectedDateAgendaStateSummary.nextUp.timeLabel} · set the next move early`
                    : "Queue the next thing before drift decides it."}
                </small>
              </article>
              <article className={styles.agendaCommandCard}>
                <span>Pressure</span>
                <strong>
                  {selectedDateAgendaStateSummary.overdueCount > 0
                    ? `${selectedDateAgendaStateSummary.overdueCount} overdue`
                    : "Board clear"}
                </strong>
                <small>
                  {selectedDateAgendaStateSummary.focusMinutes}m focus · {selectedDateAgendaStateSummary.reminderCount} reminders
                </small>
              </article>
            </div>

            {isMobileViewport ? (
              <>
                <div className={styles.mobileAgendaSummary}>
                  <div className={styles.mobileAgendaStat}>
                    <span>Blocks</span>
                    <strong>{selectedDatePlanGroups.visible.length}</strong>
                  </div>
                  <div className={styles.mobileAgendaStat}>
                    <span>Reminders</span>
                    <strong>
                      {selectedDateEntries.filter((entry) => entry.source === "reminder").length}
                    </strong>
                  </div>
                  <div className={styles.mobileAgendaStat}>
                    <span>Focus</span>
                    <strong>{selectedDateFocusedMinutes}m</strong>
                  </div>
                </div>

                <section className={styles.planSection}>
                  <button
                    type="button"
                    className={styles.planSectionHeader}
                    onClick={() => onSetMobileAgendaEntriesOpen((open) => !open)}
                  >
                    <span>Entries</span>
                    <span>{mobileAgendaEntriesOpen ? "Hide" : selectedDateEntries.length}</span>
                  </button>
                  {mobileAgendaEntriesOpen && (
                    <div className={styles.dayAgendaList}>
                      {selectedDateEntries.length === 0 ? (
                        <p className={styles.emptyText}>No events for this date yet.</p>
                      ) : (
                        selectedDateEntries.slice(0, 6).map((entry) => {
                          const agendaState =
                            entry.source === "session"
                              ? ("logged" as const)
                              : resolveAgendaTimingState(
                                  selectedDateKey,
                                  entry.startMinute,
                                  entry.endMinute,
                                  entry.isCompleted,
                                );
                          return (
                          <div
                            key={entry.id}
                            className={`${styles.dayAgendaItem} ${
                              entry.source === "plan" ? styles.dayAgendaItemTinted : ""
                            } ${
                              entry.source === "plan" ? styles[`dayViewEvent${entry.tone}`] : ""
                            } ${
                              entry.source === "plan" && getCalendarToneMeta(entry.tone as CalendarTone)
                                ? styles.calendarToneSurfaceBlock
                                : ""
                            } ${entry.isCompleted ? styles.dayAgendaItemCompleted : ""}`}
                            style={
                              entry.source === "plan"
                                ? getCalendarToneStyle(entry.tone as CalendarTone)
                                : undefined
                            }
                          >
                            <div>
                              <div className={styles.dayAgendaHeadline}>
                                <p className={styles.dayAgendaTime}>{entry.timeLabel}</p>
                                <span className={`${styles.agendaStatePill} ${styles[`agendaStatePill${agendaState.charAt(0).toUpperCase()}${agendaState.slice(1)}`]}`}>
                                  {agendaState === "logged" ? "Logged" : agendaState}
                                </span>
                              </div>
                              <strong className={styles.dayAgendaTitle}>{entry.title}</strong>
                              <p className={styles.dayAgendaMeta}>{entry.subtitle}</p>
                            </div>
                            <div className={styles.dayAgendaActions}>
                              {entry.source === "reminder" && entry.noteId && (
                                <button
                                  type="button"
                                  className={styles.secondaryPlanButton}
                                  onClick={() => {
                                    onSetSelectedNoteId(entry.noteId ?? null);
                                    onOpenNotesTab();
                                  }}
                                >
                                  Open note
                                </button>
                              )}
                              {entry.source === "plan" && entry.planId && plannedBlockById.get(entry.planId) && (
                                <button
                                  type="button"
                                  className={styles.secondaryPlanButton}
                                  onClick={() => onOpenPlannedBlockDetail(entry.planId ?? "")}
                                >
                                  Open block
                                </button>
                              )}
                              {entry.source === "plan" &&
                                entry.planId &&
                                plannedBlockById.get(entry.planId) &&
                                !entry.isCompleted && (
                                <button
                                  type="button"
                                  className={styles.planCompleteButton}
                                  onClick={() => {
                                    const plan = plannedBlockById.get(entry.planId ?? "");
                                    if (!plan) return;
                                    void onCompletePlannedBlock(plan);
                                  }}
                                >
                                  Complete
                                </button>
                              )}
                              {entry.source === "session" && (
                                <button
                                  type="button"
                                  className={styles.secondaryPlanButton}
                                  onClick={onSetActiveTabHistory}
                                >
                                  View history
                                </button>
                              )}
                            </div>
                          </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </section>
              </>
            ) : (
              <div className={styles.dayAgendaList}>
                {selectedDateEntries.length === 0 ? (
                  <p className={styles.emptyText}>No events for this date yet.</p>
                ) : (
                  selectedDateEntries.slice(0, 8).map((entry) => {
                    const agendaState =
                      entry.source === "session"
                        ? ("logged" as const)
                        : resolveAgendaTimingState(
                            selectedDateKey,
                            entry.startMinute,
                            entry.endMinute,
                            entry.isCompleted,
                          );
                    return (
                    <div
                      key={entry.id}
                      className={`${styles.dayAgendaItem} ${
                        entry.source === "plan" ? styles.dayAgendaItemTinted : ""
                      } ${
                        entry.source === "plan" ? styles[`dayViewEvent${entry.tone}`] : ""
                      } ${
                        entry.source === "plan" && getCalendarToneMeta(entry.tone as CalendarTone)
                          ? styles.calendarToneSurfaceBlock
                          : ""
                      } ${entry.isCompleted ? styles.dayAgendaItemCompleted : ""}`}
                      style={
                        entry.source === "plan"
                          ? getCalendarToneStyle(entry.tone as CalendarTone)
                          : undefined
                      }
                    >
                      <div>
                        <div className={styles.dayAgendaHeadline}>
                          <p className={styles.dayAgendaTime}>{entry.timeLabel}</p>
                          <span className={`${styles.agendaStatePill} ${styles[`agendaStatePill${agendaState.charAt(0).toUpperCase()}${agendaState.slice(1)}`]}`}>
                            {agendaState === "logged" ? "Logged" : agendaState}
                          </span>
                        </div>
                        <strong className={styles.dayAgendaTitle}>{entry.title}</strong>
                        <p className={styles.dayAgendaMeta}>{entry.subtitle}</p>
                      </div>
                      <div className={styles.dayAgendaActions}>
                        {entry.source === "reminder" && entry.noteId && (
                          <button
                            type="button"
                            className={styles.secondaryPlanButton}
                            onClick={() => {
                              onSetSelectedNoteId(entry.noteId ?? null);
                              onOpenNotesTab();
                            }}
                          >
                            Open note
                          </button>
                        )}
                        {entry.source === "plan" && entry.planId && plannedBlockById.get(entry.planId) && (
                          <button
                            type="button"
                            className={styles.secondaryPlanButton}
                            onClick={() => onOpenPlannedBlockDetail(entry.planId ?? "")}
                          >
                            Open block
                          </button>
                        )}
                        {entry.source === "plan" &&
                          entry.planId &&
                          plannedBlockById.get(entry.planId) &&
                          !entry.isCompleted && (
                          <button
                            type="button"
                            className={styles.planCompleteButton}
                            onClick={() => {
                              const plan = plannedBlockById.get(entry.planId ?? "");
                              if (!plan) return;
                              void onCompletePlannedBlock(plan);
                            }}
                          >
                            Complete
                          </button>
                        )}
                        {entry.source === "session" && (
                          <button
                            type="button"
                            className={styles.secondaryPlanButton}
                            onClick={onSetActiveTabHistory}
                          >
                            View history
                          </button>
                        )}
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            )}

            <div className={styles.planSectionStack}>
          <section className={styles.planSection}>
            <button
              type="button"
              className={styles.planSectionHeader}
              onClick={() =>
                onSetPlannerSectionsOpen((current) => ({ ...current, active: !current.active }))
              }
            >
              <span>Planned Blocks</span>
              <span>{selectedDatePlanGroups.visible.length}</span>
            </button>
            {plannerSectionsOpen.active && (
              <div className={styles.planList}>
                {selectedDatePlanGroups.visible.length === 0 ? (
                  <p className={styles.emptyText}>No planned blocks for this day.</p>
                ) : (
                  selectedDatePlanGroups.visible.map((item) => {
                    const completed = item.status === "completed";
                    const planState = completed
                      ? ("completed" as const)
                      : resolveAgendaTimingState(
                          item.dateKey,
                          parseTimeToMinutes(item.timeOfDay),
                          parseTimeToMinutes(item.timeOfDay) + item.durationMinutes,
                        );
                    return (
                      <div
                        key={item.id}
                        className={`${completed ? styles.planItemStatic : styles.planItem} ${
                          completed ? styles.planItemCompleted : ""
                        } ${visiblePlanTone(item.tone) ? styles[`calendarToneSurface${visiblePlanTone(item.tone)}`] : ""} ${
                          visiblePlanTone(item.tone) ? styles.calendarToneSurfaceBlock : ""
                        }`}
                        style={getCalendarToneStyle(visiblePlanTone(item.tone))}
                        onClick={() => onOpenPlannedBlockDetail(item.id)}
                        draggable={!completed}
                        onDragStart={() => {
                          if (completed) return;
                          onSetDraggedPlanId(item.id);
                        }}
                        onDragEnd={() => onSetDraggedPlanId(null)}
                        onDragOver={(event) => {
                          if (completed) return;
                          event.preventDefault();
                        }}
                        onDrop={() => {
                          if (completed || !draggedPlanId) return;
                          onReorderPlannedBlocks(draggedPlanId, item.id);
                          onSetDraggedPlanId(null);
                        }}
                      >
                      <div>
                        <div className={styles.planItemHeadline}>
                          <strong>{item.title}</strong>
                          {item.attachmentCount ? (
                            <span className={styles.attachmentIndicatorChip}>
                              {attachmentIndicatorLabel(item.attachmentCount)}
                            </span>
                          ) : null}
                          <span className={`${styles.agendaStatePill} ${styles[`agendaStatePill${planState.charAt(0).toUpperCase()}${planState.slice(1)}`]}`}>
                            {planState}
                          </span>
                        </div>
                        <div className={styles.planMetaRow}>
                          {completed ? (
                            <span>{normalizeTimeLabel(item.timeOfDay)}</span>
                          ) : (
                            <input
                              type="time"
                              value={item.timeOfDay}
                              className={styles.planItemTime}
                              onChange={(event) =>
                                onUpdatePlannedBlockTime(item.id, event.target.value)
                              }
                            />
                          )}
                          <span>{item.durationMinutes}m</span>
                        </div>
                        {item.note.trim() && <p className={styles.planItemNote}>{item.note}</p>}
                      </div>
                      <div className={styles.planActions}>
                        {completed ? (
                          <div className={styles.planStatusPill}>Completed</div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.planCompleteButton}
                              onClick={(event) => {
                                event.stopPropagation();
                                void onCompletePlannedBlock(item);
                              }}
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              className={styles.planDeleteButton}
                              onClick={(event) => {
                                event.stopPropagation();
                                onDeletePlannedBlock(item.id);
                              }}
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </section>

          <section className={styles.planSection}>
            <button
              type="button"
              className={styles.planSectionHeader}
              onClick={() =>
                onSetPlannerSectionsOpen((current) => ({ ...current, incomplete: !current.incomplete }))
              }
            >
              <span>Incomplete Blocks</span>
              <span>{selectedDatePlanGroups.incomplete.length}</span>
            </button>
            {plannerSectionsOpen.incomplete && (
              <div className={styles.planList}>
                {selectedDatePlanGroups.incomplete.length === 0 ? (
                  <p className={styles.emptyText}>No incomplete blocks for this day.</p>
                ) : (
                  selectedDatePlanGroups.incomplete.map((item) => {
                    const planState = resolveAgendaTimingState(
                      item.dateKey,
                      parseTimeToMinutes(item.timeOfDay),
                      parseTimeToMinutes(item.timeOfDay) + item.durationMinutes,
                    );
                    return (
                    <div
                      key={item.id}
                      className={`${styles.planItemStatic} ${
                        visiblePlanTone(item.tone) ? styles[`calendarToneSurface${visiblePlanTone(item.tone)}`] : ""
                      } ${visiblePlanTone(item.tone) ? styles.calendarToneSurfaceBlock : ""
                      }`}
                      style={getCalendarToneStyle(visiblePlanTone(item.tone))}
                      onClick={() => onOpenPlannedBlockDetail(item.id)}
                    >
                      <div>
                        <div className={styles.planItemHeadline}>
                          <strong>{item.title}</strong>
                          {item.attachmentCount ? (
                            <span className={styles.attachmentIndicatorChip}>
                              {attachmentIndicatorLabel(item.attachmentCount)}
                            </span>
                          ) : null}
                          <span className={`${styles.agendaStatePill} ${styles[`agendaStatePill${planState.charAt(0).toUpperCase()}${planState.slice(1)}`]}`}>
                            {planState}
                          </span>
                        </div>
                        <div className={styles.planMetaRow}>
                          <span>{normalizeTimeLabel(item.timeOfDay)}</span>
                          <span>{item.durationMinutes}m</span>
                        </div>
                        {item.note.trim() && <p className={styles.planItemNote}>{item.note}</p>}
                      </div>
                      <div className={styles.planStatusPillMuted}>Incomplete</div>
                    </div>
                    );
                  })
                )}
              </div>
            )}
          </section>
            </div>
          </>
        )}
      </article>
      )}

      {isMobileViewport && mobileBlockSheetOpen && (
        <div
          className={styles.feedbackOverlay}
          onClick={() => onSetMobileBlockSheetOpen(false)}
        >
          <div
            className={styles.mobileBlockModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.feedbackHeader}>
              <div>
                <p className={styles.sectionLabel}>Time Block</p>
                <h2 className={styles.feedbackTitle}>
                  Block out{" "}
                  {new Date(`${selectedDateKey}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </h2>
              </div>
              <button
                type="button"
                className={styles.feedbackClose}
                onClick={() => onSetMobileBlockSheetOpen(false)}
              >
                Close
              </button>
            </div>
            <p className={styles.paywallCopy}>
              Time blocks are central in Whelm. Add one fast, then return to the calendar.
            </p>
            <div className={styles.planForm}>
              <input
                value={planTitle}
                onChange={(event) => onSetPlanTitle(event.target.value)}
                placeholder="Task title"
                className={styles.planInput}
                disabled={!selectedDateCanAddBlocks}
              />
              <div className={styles.planNoteRow}>
                <button
                  type="button"
                  className={styles.planNoteToggle}
                  onClick={() => onSetPlanNoteExpanded((current) => !current)}
                >
                  {planNoteExpanded || planNote ? "Hide note" : "+ Note"}
                </button>
              </div>
              {planNoteExpanded && (
                <textarea
                  value={planNote}
                  onChange={(event) => onSetPlanNote(event.target.value.slice(0, 280))}
                  placeholder="Optional note, intention, or instruction for this block"
                  className={styles.planNoteInput}
                  disabled={!selectedDateCanAddBlocks}
                />
              )}
              <CalendarTonePicker
                label="Block tone"
                selectedTone={planTone}
                onSelectTone={onSetPlanTone}
                isPro={isPro}
                onUpgrade={onUpgrade}
              />
              {planConflictWarning && (
                <div className={styles.planConflictBanner}>
                  <p className={styles.planConflictText}>{planConflictWarning.message}</p>
                  <div className={styles.planConflictActions}>
                    <button
                      type="button"
                      className={styles.secondaryPlanButton}
                      onClick={() => onSetPlanConflictWarning(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
              <div className={styles.planFormRow}>
                <label className={styles.planLabel}>
                  Time
                  <input
                    type="time"
                    value={planTime}
                    onChange={(event) => onSetPlanTime(event.target.value)}
                    className={styles.planControl}
                    disabled={!selectedDateCanAddBlocks}
                  />
                </label>
                <label className={styles.planLabel}>
                  Minutes
                  <input
                    type="number"
                    min={MIN_PLANNED_BLOCK_MINUTES}
                    max={MAX_PLANNED_BLOCK_MINUTES}
                    value={planDuration}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isFinite(next)) {
                        onSetPlanDuration(next);
                      }
                    }}
                    className={styles.planControl}
                    disabled={!selectedDateCanAddBlocks}
                  />
                </label>
                <button
                  type="button"
                  className={`${styles.planAddButton} ${styles.blockActionButton}`}
                  disabled={!selectedDateCanAddBlocks}
                  onClick={() => {
                    const added = onAddPlannedBlock();
                    if (added) {
                      onSetMobileBlockSheetOpen(false);
                    }
                  }}
                >
                  Add block
                </button>
              </div>
              {!selectedDateCanAddBlocks ? (
                <p className={styles.accountMeta}>
                  Past days stay read-only. Blocks can only be added to today or a future day.
                </p>
              ) : null}
              {planStatus && <p className={styles.accountMeta}>{planStatus}</p>}
            </div>
            <div className={styles.mobileBlockList}>
              {selectedDatePlanGroups.visible.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className={`${styles.mobileBlockItem} ${
                    item.status === "completed" ? styles.mobileBlockItemCompleted : ""
                  }`}
                >
                  <strong>
                    {item.title}
                    {item.attachmentCount ? (
                      <span className={styles.attachmentIndicatorChip}>
                        {attachmentIndicatorLabel(item.attachmentCount)}
                      </span>
                    ) : null}
                  </strong>
                  <span>
                    {item.timeOfDay} • {item.durationMinutes}m
                    {item.status === "completed" ? " • completed" : ""}
                  </span>
                </div>
              ))}
              {selectedDatePlanGroups.visible.length === 0 && (
                <p className={styles.emptyText}>No blocks yet for this day.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </AnimatedTabSection>
  );
}
