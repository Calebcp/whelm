"use client";

import { type Ref } from "react";

import styles from "@/app/page.module.css";
import AnimatedTabSection from "@/components/AnimatedTabSection";
import CompanionPulse from "@/components/CompanionPulse";
import ProUnlockCard from "@/components/ProUnlockCard";
import SenseiFigure from "@/components/SenseiFigure";
import type { SenseiVariant } from "@/components/SenseiFigure";
import type { WhelBandanaColor } from "@/lib/whelm-mascot";
import type { SessionDoc } from "@/lib/streak";

const WHELM_PRO_POSITIONING =
  "Whelm Pro is the full version of the system: deeper reports, longer memory, stronger personalization, a cleaner command center, and of course more animated PRO WHELMS!";

type CompanionPulseData = {
  eyebrow: string;
  title: string;
  body: string;
  variant: SenseiVariant;
};

type SessionHistoryDayGroup = {
  key: string;
  label: string;
  totalMinutes: number;
  items: SessionDoc[];
};

type SessionHistoryWeekGroup = {
  key: string;
  label: string;
  totalMinutes: number;
  days: SessionHistoryDayGroup[];
};

type SessionHistoryMonthGroup = {
  key: string;
  label: string;
  totalMinutes: number;
  weeks: SessionHistoryWeekGroup[];
};

type PlannedBlockHistoryItem = {
  id: string;
  dateKey: string;
  title: string;
  note: string;
  durationMinutes: number;
  timeOfDay: string;
};

type PlannedBlockHistory = {
  completed: PlannedBlockHistoryItem[];
  incomplete: PlannedBlockHistoryItem[];
};

type HistorySectionsOpen = {
  completed: boolean;
  incomplete: boolean;
};

export type HistoryTabProps = {
  // Sensei companion
  companionPulse: CompanionPulseData;
  bandanaColor: WhelBandanaColor;
  sectionRef?: Ref<HTMLElement>;
  primaryRef?: Ref<HTMLElement>;
  // Block history
  plannedBlockHistory: PlannedBlockHistory;
  historySectionsOpen: HistorySectionsOpen;
  onToggleHistorySection: (key: keyof HistorySectionsOpen) => void;
  isPro: boolean;
  hasLockedBlockHistory: boolean;
  proPanelCalendarOpen: boolean;
  onToggleProCalendarPanel: () => void;
  onStartProPreview: () => void;
  // Session history
  sessionHistoryGroups: SessionHistoryMonthGroup[];
  historyGroupsOpen: Record<string, boolean>;
  onToggleHistoryGroup: (key: string) => void;
  hasLockedHistoryDays: boolean;
  proPanelHistoryOpen: boolean;
  onToggleProHistoryPanel: () => void;
  // Helpers
  normalizeTimeLabel: (raw: string) => string;
  stripCompletedBlockPrefix: (value: string) => string;
};

export default function HistoryTab({
  companionPulse,
  bandanaColor,
  sectionRef,
  primaryRef,
  plannedBlockHistory,
  historySectionsOpen,
  onToggleHistorySection,
  isPro,
  hasLockedBlockHistory,
  proPanelCalendarOpen,
  onToggleProCalendarPanel,
  onStartProPreview,
  sessionHistoryGroups,
  historyGroupsOpen,
  onToggleHistoryGroup,
  hasLockedHistoryDays,
  proPanelHistoryOpen,
  onToggleProHistoryPanel,
  normalizeTimeLabel,
  stripCompletedBlockPrefix,
}: HistoryTabProps) {
  return (
    <AnimatedTabSection className={styles.historyShell} sectionRef={sectionRef}>
      <CompanionPulse {...companionPulse} bandanaColor={bandanaColor} />
      <article className={styles.card} ref={primaryRef}>
        <p className={styles.sectionLabel}>Block History</p>
        <h2 className={styles.cardTitle}>Completed and incomplete blocks</h2>
        <div className={styles.planSectionStack}>
          <section className={styles.planSection}>
            <button
              type="button"
              className={styles.planSectionHeader}
              onClick={() => onToggleHistorySection("completed")}
            >
              <span>Completed</span>
              <span>{plannedBlockHistory.completed.length}</span>
            </button>
            {historySectionsOpen.completed && (
              <div className={styles.planList}>
                {plannedBlockHistory.completed.length === 0 ? (
                  <p className={styles.emptyText}>No completed blocks yet.</p>
                ) : (
                  plannedBlockHistory.completed.map((item) => (
                    <div key={item.id} className={styles.planItemStatic}>
                      <div>
                        <strong>{item.title}</strong>
                        <div className={styles.planMetaRow}>
                          <span>
                            {new Date(`${item.dateKey}T00:00:00`).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span>{normalizeTimeLabel(item.timeOfDay)}</span>
                          <span>{item.durationMinutes}m</span>
                        </div>
                        {item.note.trim() && <p className={styles.planItemNote}>{item.note}</p>}
                      </div>
                      <div className={styles.planStatusPill}>Completed</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

          <section className={styles.planSection}>
            <button
              type="button"
              className={styles.planSectionHeader}
              onClick={() => onToggleHistorySection("incomplete")}
            >
              <span>Incomplete</span>
              <span>{plannedBlockHistory.incomplete.length}</span>
            </button>
            {historySectionsOpen.incomplete && (
              <div className={styles.planList}>
                {plannedBlockHistory.incomplete.length === 0 ? (
                  <p className={styles.emptyText}>No incomplete blocks yet.</p>
                ) : (
                  plannedBlockHistory.incomplete.map((item) => (
                    <div key={item.id} className={styles.planItemStatic}>
                      <div>
                        <strong>{item.title}</strong>
                        <div className={styles.planMetaRow}>
                          <span>
                            {new Date(`${item.dateKey}T00:00:00`).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span>{normalizeTimeLabel(item.timeOfDay)}</span>
                          <span>{item.durationMinutes}m</span>
                        </div>
                        {item.note.trim() && <p className={styles.planItemNote}>{item.note}</p>}
                      </div>
                      <div className={styles.planStatusPillMuted}>Incomplete</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </div>
        {!isPro && hasLockedBlockHistory ? (
          <ProUnlockCard
            title="Older block history"
            body={`${WHELM_PRO_POSITIONING} Whelm Free keeps the last 14 days of block history visible. Whelm Pro keeps the older archive ready whenever you want it back.`}
            open={proPanelCalendarOpen}
            onToggle={onToggleProCalendarPanel}
            onPreview={onStartProPreview}
          />
        ) : null}
      </article>
      <article className={styles.card}>
        <p className={styles.sectionLabel}>History</p>
        <h2 className={styles.cardTitle}>Session log</h2>
        {sessionHistoryGroups.length === 0 ? (
          <div className={styles.historyEmptyState}>
            <SenseiFigure
              variant="wave"
              bandanaColor={bandanaColor}
              size="inline"
              message="Your first session will start the record."
              className={styles.historyEmptySensei}
            />
            <p className={styles.emptyText}>
              No sessions yet. Start your timer and save your first block.
            </p>
          </div>
        ) : (
          <div className={styles.groupList}>
            {sessionHistoryGroups.map((monthGroup) => (
              <section key={monthGroup.key} className={`${styles.sessionGroup} ${styles.historyMonthGroup}`}>
                <button
                  type="button"
                  className={styles.groupHeader}
                  onClick={() => onToggleHistoryGroup(monthGroup.key)}
                >
                  <div className={styles.historyGroupCopy}>
                    <p className={styles.historyGroupLabel}>Month</p>
                    <h3>{monthGroup.label}</h3>
                  </div>
                  <div className={styles.historyGroupMeta}>
                    <span>{monthGroup.weeks.length} week{monthGroup.weeks.length === 1 ? "" : "s"}</span>
                    <strong>{monthGroup.totalMinutes}m</strong>
                    <span className={styles.historyDisclosure}>
                      {historyGroupsOpen[monthGroup.key] ? "-" : "+"}
                    </span>
                  </div>
                </button>
                {historyGroupsOpen[monthGroup.key] && (
                  <div className={styles.historyWeekList}>
                    {monthGroup.weeks.map((weekGroup) => (
                      <section
                        key={weekGroup.key}
                        className={`${styles.sessionGroup} ${styles.historyWeekGroup}`}
                      >
                        <button
                          type="button"
                          className={styles.groupHeader}
                          onClick={() => onToggleHistoryGroup(weekGroup.key)}
                        >
                          <div className={styles.historyGroupCopy}>
                            <p className={styles.historyGroupLabel}>Week</p>
                            <h3>{weekGroup.label}</h3>
                          </div>
                          <div className={styles.historyGroupMeta}>
                            <span>{weekGroup.days.length} day{weekGroup.days.length === 1 ? "" : "s"}</span>
                            <strong>{weekGroup.totalMinutes}m</strong>
                            <span className={styles.historyDisclosure}>
                              {historyGroupsOpen[weekGroup.key] ? "-" : "+"}
                            </span>
                          </div>
                        </button>
                        {historyGroupsOpen[weekGroup.key] && (
                          <div className={styles.historyDayList}>
                            {weekGroup.days.map((dayGroup) => (
                              <section
                                key={dayGroup.key}
                                className={`${styles.sessionGroup} ${styles.historyDayGroup}`}
                              >
                                <button
                                  type="button"
                                  className={styles.groupHeader}
                                  onClick={() => onToggleHistoryGroup(dayGroup.key)}
                                >
                                  <div className={styles.historyGroupCopy}>
                                    <p className={styles.historyGroupLabel}>Day</p>
                                    <h3>{dayGroup.label}</h3>
                                  </div>
                                  <div className={styles.historyGroupMeta}>
                                    <span>{dayGroup.items.length} session{dayGroup.items.length === 1 ? "" : "s"}</span>
                                    <strong>{dayGroup.totalMinutes}m</strong>
                                    <span className={styles.historyDisclosure}>
                                      {historyGroupsOpen[dayGroup.key] ? "-" : "+"}
                                    </span>
                                  </div>
                                </button>
                                {historyGroupsOpen[dayGroup.key] && (
                                  <div className={styles.sessionList}>
                                    {dayGroup.items.map((session, index) => (
                                      <div key={`${session.completedAtISO}-${index}`} className={styles.sessionItem}>
                                        <div>
                                          <div className={styles.sessionPrimary}>
                                            {new Date(session.completedAtISO).toLocaleTimeString([], {
                                              hour: "numeric",
                                              minute: "2-digit",
                                            })}{" "}
                                            {session.note?.trim()
                                              ? stripCompletedBlockPrefix(session.note.trim())
                                              : "Session"}
                                          </div>
                                        </div>
                                        <div className={styles.sessionMinutes}>{session.minutes}m</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </section>
                            ))}
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
        {!isPro && hasLockedHistoryDays ? (
          <ProUnlockCard
            title="Older history"
            body={`${WHELM_PRO_POSITIONING} Whelm Free keeps the last 14 days visible. Whelm Pro keeps the older month, week, and day archive ready whenever you want it back.`}
            open={proPanelHistoryOpen}
            onToggle={onToggleProHistoryPanel}
            onPreview={onStartProPreview}
          />
        ) : null}
      </article>
    </AnimatedTabSection>
  );
}
