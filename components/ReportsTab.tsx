"use client";

import { useMemo, type Ref } from "react";
import { motion } from "motion/react";

import styles from "@/app/page.module.css";
import AnimatedTabSection from "@/components/AnimatedTabSection";
import CompanionPulse from "@/components/CompanionPulse";
import ProUnlockCard from "@/components/ProUnlockCard";
import WhelmEmote from "@/components/WhelmEmote";
import type { SenseiVariant } from "@/components/SenseiFigure";
import type { WhelBandanaColor } from "@/lib/whelm-mascot";
import type { PerformanceNotificationPlan } from "@/lib/performance-notifications";
import { WHELM_PRO_NAME, WHELM_STANDARD_NAME } from "@/lib/whelm-plans";

const WHELM_PRO_POSITIONING =
  "Whelm Pro adds advanced reports, longer memory, and the deeper version of the Whelm command system.";

// ── Types ────────────────────────────────────────────────────────────────────

type CompanionPulseData = {
  eyebrow: string;
  title: string;
  body: string;
  variant: SenseiVariant;
};

type FocusMetrics = {
  todayMinutes: number;
  todaySessions: number;
  weekMinutes: number;
  monthMinutes: number;
  activeDaysInMonth: number;
};

type AnalyticsWeeklySummary = {
  daysCaptured: number;
  activeDays: number;
  totals: {
    focusMinutes: number;
    sessionsStarted: number;
    sessionsCompleted: number;
    sessionsAbandoned: number;
    tasksCompleted: number;
  };
  averages: {
    dailyPerformanceScore: number;
    completionRate: number;
    completedSessionLength: number;
    sessionQualityScore: number | null;
  };
  performanceBands: {
    high: number;
    steady: number;
    recovery: number;
  };
};

type AnalyticsInsight = {
  type: string;
  tone: "positive" | "neutral" | "warning";
  title: string;
  body: string;
};

type BestFocusHour = {
  hour: number;
  focusMinutes: number;
  completedSessions: number;
  sharePercent: number;
  averageSessionLength: number;
};

type BestFocusWindow = {
  startHour: number;
  endHour: number;
  label: string;
  focusMinutes: number;
  sharePercent: number;
} | null;

type TopSubject = {
  key: string;
  label: string;
  focusMinutes: number;
  sessionsCompleted: number;
  tasksCompleted: number;
};

type ScoreHistoryEntry = {
  date: string;
  score: number;
};

type ReportsSectionsOpen = {
  score: boolean;
  insights: boolean;
  timing: boolean;
  subjects: boolean;
  notifications: boolean;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatAnalyticsWindowLabel(startHour: number, endHour: number) {
  const fmt = (h: number) => {
    const suffix = h < 12 ? "am" : "pm";
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}${suffix}`;
  };
  return `${fmt(startHour)}–${fmt(endHour)}`;
}

function formatHourLabel(hour: number) {
  if (hour === 0) return "12am";
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return "12pm";
  return `${hour - 12}pm`;
}

function ReportsRow({
  title,
  summary,
  active,
  onClick,
}: {
  title: string;
  summary: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.reportIndexRow} ${active ? styles.reportIndexRowActive : ""}`}
      onClick={onClick}
    >
      <div className={styles.reportIndexCopy}>
        <strong>{title}</strong>
        <span>{summary}</span>
      </div>
      <span className={styles.reportIndexChevron}>{active ? "−" : "›"}</span>
    </button>
  );
}

function ReportsDetailHeader({
  sectionLabel,
  title,
  body,
  onBack,
}: {
  sectionLabel: string;
  title: string;
  body?: string;
  onBack: () => void;
}) {
  return (
    <div className={styles.reportDetailTopbar}>
      <button type="button" className={styles.reportBackButton} onClick={onBack}>
        ‹
      </button>
      <div className={styles.reportDetailHeaderCopy}>
        <p className={styles.sectionLabel}>{sectionLabel}</p>
        <strong>{title}</strong>
        <span>{body || sectionLabel}</span>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export type ReportsTabProps = {
  sectionRef?: Ref<HTMLElement>;
  primaryRef?: Ref<HTMLElement>;
  companionPulse: CompanionPulseData;
  bandanaColor: WhelBandanaColor;
  // Pro gate
  isPro: boolean;
  proPanelReportsOpen: boolean;
  onToggleProReportsPanel: () => void;
  onStartProPreview: () => void;
  // Free tier metrics
  focusMetrics: FocusMetrics;
  // Pro analytics
  insightRange: 7 | 30 | 90;
  onSetInsightRange: (range: 7 | 30 | 90) => void;
  analyticsDateRange: { startDate: string; endDate: string };
  analyticsError: string;
  analyticsLoading: boolean;
  analyticsWeeklySummary: AnalyticsWeeklySummary | null;
  analyticsLeadInsight: AnalyticsInsight | null;
  analyticsBestWindow: BestFocusWindow;
  analyticsLeadSubject: TopSubject | null;
  analyticsLeadNotification: { title: string; body: string; deliverAtLocalTime: string } | null;
  // Sections
  reportsSectionsOpen: ReportsSectionsOpen;
  onToggleReportsSection: (key: keyof ReportsSectionsOpen) => void;
  // Score history
  analyticsScoreHistory: ScoreHistoryEntry[];
  analyticsScorePath: string;
  // Insights
  analyticsInsights: AnalyticsInsight[];
  // Timing
  analyticsTopHours: BestFocusHour[];
  // Subjects
  analyticsTopSubjects: TopSubject[];
  analyticsTopSubjectMinutes: number;
  // Notifications
  analyticsNotificationPlan: PerformanceNotificationPlan | null;
};

export default function ReportsTab({
  sectionRef,
  primaryRef,
  companionPulse,
  bandanaColor,
  isPro,
  proPanelReportsOpen,
  onToggleProReportsPanel,
  onStartProPreview,
  focusMetrics,
  insightRange,
  onSetInsightRange,
  analyticsDateRange,
  analyticsError,
  analyticsLoading,
  analyticsWeeklySummary,
  analyticsLeadInsight,
  analyticsBestWindow,
  analyticsLeadSubject,
  analyticsLeadNotification,
  reportsSectionsOpen,
  onToggleReportsSection,
  analyticsScoreHistory,
  analyticsScorePath,
  analyticsInsights,
  analyticsTopHours,
  analyticsTopSubjects,
  analyticsTopSubjectMinutes,
  analyticsNotificationPlan,
}: ReportsTabProps) {
  const activeSection = useMemo<keyof ReportsSectionsOpen | null>(() => {
    const ordered: Array<keyof ReportsSectionsOpen> = [
      "score",
      "insights",
      "timing",
      "subjects",
      "notifications",
    ];
    return ordered.find((key) => reportsSectionsOpen[key]) ?? null;
  }, [reportsSectionsOpen]);

  const closeActiveSection = () => {
    if (activeSection) {
      onToggleReportsSection(activeSection);
    }
  };

  return (
    <AnimatedTabSection
      className={`${styles.reportsGrid} ${activeSection ? styles.reportsGridDetailOpen : ""}`}
      sectionRef={sectionRef}
    >
      <CompanionPulse {...companionPulse} bandanaColor={bandanaColor} />
      {!isPro ? (
        <>
          <article className={`${styles.card} ${styles.analyticsHeroCard}`} ref={primaryRef}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.sectionLabel}>Focus Readout</p>
                <h2 className={styles.cardTitle}>Core focus picture</h2>
                <p className={styles.accountMeta}>
                  {WHELM_STANDARD_NAME} keeps this simple. {WHELM_PRO_NAME} opens the deeper command readout.
                </p>
              </div>
            </div>
            <div className={styles.analyticsHeroGrid}>
              <motion.div className={styles.analyticsHeroMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
                <span>Today</span>
                <strong>{focusMetrics.todayMinutes}m</strong>
                <small>{focusMetrics.todaySessions} saved session{focusMetrics.todaySessions === 1 ? "" : "s"}</small>
              </motion.div>
              <motion.div className={styles.analyticsHeroMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.04 }}>
                <span>7 days</span>
                <strong>{focusMetrics.weekMinutes}m</strong>
                <small>last week of focus</small>
              </motion.div>
              <motion.div className={styles.analyticsHeroMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.08 }}>
                <span>30 days</span>
                <strong>{focusMetrics.monthMinutes}m</strong>
                <small>recent monthly total</small>
              </motion.div>
              <motion.div className={styles.analyticsHeroMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.12 }}>
                <span>Active days</span>
                <strong>{focusMetrics.activeDaysInMonth}</strong>
                <small>days with saved minutes</small>
              </motion.div>
            </div>
          </article>
          <article className={styles.card}>
            <p className={styles.sectionLabel}>{WHELM_PRO_NAME}</p>
            <h2 className={styles.cardTitle}>Advanced reports belong to {WHELM_PRO_NAME}</h2>
            <ProUnlockCard
              title="Unlock score history, insight feed, best hours, and subject analysis"
              body={`${WHELM_PRO_POSITIONING} ${WHELM_STANDARD_NAME} keeps the core readout simple. ${WHELM_PRO_NAME} opens score history, quality and completion analytics, best hours, and deeper breakdowns.`}
              open={proPanelReportsOpen}
              onToggle={onToggleProReportsPanel}
              onPreview={onStartProPreview}
            />
          </article>
        </>
      ) : (
        <>
          <article className={`${styles.card} ${styles.analyticsHeroCard}`} ref={primaryRef}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.sectionLabel}>Advanced Reports</p>
                <h2 className={styles.cardTitle}>Performance command center</h2>
                <p className={styles.accountMeta}>
                  Rich analytics from your tracked sessions, completion behavior, quality score, and timing patterns.
                </p>
              </div>
              <WhelmEmote emoteId="whelm.score" size="inline" className={styles.analyticsHeroEmote} />
            </div>

            <div className={styles.analyticsToolbar}>
              <div className={styles.rangeTabs}>
                <button
                  type="button"
                  className={`${styles.rangeTab} ${insightRange === 7 ? styles.rangeTabActive : ""}`}
                  onClick={() => onSetInsightRange(7)}
                >
                  7d
                </button>
                <button
                  type="button"
                  className={`${styles.rangeTab} ${insightRange === 30 ? styles.rangeTabActive : ""}`}
                  onClick={() => onSetInsightRange(30)}
                >
                  30d
                </button>
                <button
                  type="button"
                  className={`${styles.rangeTab} ${insightRange === 90 ? styles.rangeTabActive : ""}`}
                  onClick={() => onSetInsightRange(90)}
                >
                  90d
                </button>
              </div>
              <p className={styles.accountMeta}>
                Window: {analyticsDateRange.startDate} to {analyticsDateRange.endDate}
              </p>
            </div>

            {analyticsError ? (
              <p className={styles.analyticsEmptyState}>{analyticsError}</p>
            ) : analyticsLoading && !analyticsWeeklySummary ? (
              <p className={styles.analyticsEmptyState}>Loading advanced reports...</p>
            ) : analyticsWeeklySummary ? (
              <div className={styles.analyticsHeroGrid}>
                <motion.div className={styles.analyticsHeroMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
                  <span>Avg Performance</span>
                  <strong>{analyticsWeeklySummary.averages.dailyPerformanceScore}</strong>
                  <small>score this week</small>
                </motion.div>
                <motion.div className={styles.analyticsHeroMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.04 }}>
                  <span>Completion Rate</span>
                  <strong>{analyticsWeeklySummary.averages.completionRate}%</strong>
                  <small>{analyticsWeeklySummary.totals.sessionsCompleted} sessions finished</small>
                </motion.div>
                <motion.div className={styles.analyticsHeroMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.08 }}>
                  <span>Session Quality</span>
                  <strong>
                    {analyticsWeeklySummary.averages.sessionQualityScore === null
                      ? "N/A"
                      : analyticsWeeklySummary.averages.sessionQualityScore}
                  </strong>
                  <small>quality average</small>
                </motion.div>
                <motion.div className={styles.analyticsHeroMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, delay: 0.12 }}>
                  <span>Active Days</span>
                  <strong>{analyticsWeeklySummary.activeDays}</strong>
                  <small>captured this week</small>
                </motion.div>
              </div>
            ) : (
              <p className={styles.analyticsEmptyState}>Finish a few tracked sessions to unlock richer reports.</p>
            )}
          </article>

          <article className={`${styles.card} ${styles.analyticsCommandCard}`}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.sectionLabel}>Readout</p>
                <h2 className={styles.cardTitle}>Explore reports</h2>
              </div>
              <span className={styles.leaderboardCountPill}>Focused view</span>
            </div>
            <div className={styles.reportIndexList}>
              <ReportsRow
                title="Performance"
                summary={
                  analyticsWeeklySummary
                    ? `${analyticsWeeklySummary.averages.dailyPerformanceScore} average score`
                    : "Score history and weekly trend"
                }
                active={activeSection === "score"}
                onClick={() => onToggleReportsSection("score")}
              />
              <ReportsRow
                title="Whelm guidance"
                summary={analyticsLeadInsight?.title ?? "The strongest pattern right now"}
                active={activeSection === "insights"}
                onClick={() => onToggleReportsSection("insights")}
              />
              <ReportsRow
                title="Focus timing"
                summary={
                  analyticsBestWindow
                    ? formatAnalyticsWindowLabel(
                        analyticsBestWindow.startHour,
                        analyticsBestWindow.endHour,
                      )
                    : "Best hours and timing distribution"
                }
                active={activeSection === "timing"}
                onClick={() => onToggleReportsSection("timing")}
              />
              <ReportsRow
                title="Subjects"
                summary={analyticsLeadSubject?.label ?? "Where your effort is landing"}
                active={activeSection === "subjects"}
                onClick={() => onToggleReportsSection("subjects")}
              />
              <ReportsRow
                title="Nudges"
                summary={analyticsLeadNotification?.title ?? "Suggested reminders and prompts"}
                active={activeSection === "notifications"}
                onClick={() => onToggleReportsSection("notifications")}
              />
            </div>
          </article>

          {activeSection === "score" ? (
            <article className={`${styles.card} ${styles.analyticsDetailCard}`}>
              <ReportsDetailHeader
                sectionLabel="Performance"
                title="Performance score trend"
                body="Your score history and consistency pattern."
                onBack={closeActiveSection}
              />
            {analyticsScoreHistory.length > 0 ? (
              <>
                <div className={styles.analyticsSectionLead}>
                  <strong>
                    {analyticsWeeklySummary?.averages.dailyPerformanceScore ?? "--"} average score
                  </strong>
                  <span>
                    {analyticsWeeklySummary
                      ? `${analyticsWeeklySummary.performanceBands.high} high days, ${analyticsWeeklySummary.performanceBands.recovery} recovery days`
                      : "Watch the line to see whether performance is stabilizing or breaking."}
                  </span>
                </div>
                <div className={styles.analyticsChartFrame}>
                  <svg viewBox="0 0 100 100" className={styles.trendChart} preserveAspectRatio="none">
                    <polyline points={analyticsScorePath} className={styles.analyticsTrendLine} />
                  </svg>
                </div>
                <div className={styles.analyticsChartLabels}>
                  {analyticsScoreHistory
                    .map((entry, index) => (
                      <span key={`${entry.date}-${index}`}>
                        {new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    ))
                    .filter((_, index) =>
                      insightRange === 7
                        ? true
                        : insightRange === 30
                          ? index % 5 === 0 || index === analyticsScoreHistory.length - 1
                          : index % 15 === 0 || index === analyticsScoreHistory.length - 1,
                    )}
                </div>
                <div className={styles.analyticsBandSummary}>
                  <span>High: {analyticsWeeklySummary?.performanceBands.high ?? 0}</span>
                  <span>Steady: {analyticsWeeklySummary?.performanceBands.steady ?? 0}</span>
                  <span>Recovery: {analyticsWeeklySummary?.performanceBands.recovery ?? 0}</span>
                </div>
              </>
            ) : (
              <p className={styles.analyticsEmptyState}>Performance score history will appear once analytics days are aggregated.</p>
            )}
            </article>
          ) : null}

          {activeSection === "insights" ? (
            <article className={`${styles.card} ${styles.analyticsDetailCard}`}>
              <ReportsDetailHeader
                sectionLabel="Whelm guidance"
                title="What the system is seeing"
                body="The strongest patterns in your recent work."
                onBack={closeActiveSection}
              />
            {analyticsInsights.length > 0 ? (
              <div className={styles.analyticsInsightList}>
                {analyticsInsights.map((insight, index) => (
                  <article
                    key={insight.type}
                    className={`${styles.analyticsInsightCard} ${
                      insight.tone === "warning"
                        ? styles.analyticsInsightWarning
                        : insight.tone === "positive"
                          ? styles.analyticsInsightPositive
                          : styles.analyticsInsightNeutral
                    }`}
                    data-lead-insight={index === 0 ? "true" : "false"}
                  >
                    <span className={styles.analyticsInsightKicker}>
                      {index === 0 ? "Lead signal" : "Pattern"}
                    </span>
                    <p className={styles.analyticsInsightTitle}>{insight.title}</p>
                    <p className={styles.accountMeta}>{insight.body}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.analyticsEmptyState}>No standout insights yet. More tracked sessions will make this feed sharper.</p>
            )}
            </article>
          ) : null}

          {activeSection === "timing" ? (
            <article className={`${styles.card} ${styles.analyticsDetailCard}`}>
              <ReportsDetailHeader
                sectionLabel="Focus timing"
                title="Best focus window"
                body="Where your strongest hours are showing up."
                onBack={closeActiveSection}
              />
            {analyticsBestWindow ? (
              <>
                <div className={styles.analyticsFocusWindow}>
                  <strong>
                    {formatAnalyticsWindowLabel(
                      analyticsBestWindow.startHour,
                      analyticsBestWindow.endHour,
                    )}
                  </strong>
                  <span>{analyticsBestWindow.focusMinutes} focus minutes captured in this window.</span>
                  <small>{analyticsBestWindow.sharePercent}% of your tracked completed-session focus lives here.</small>
                </div>
                <div className={styles.analyticsHourList}>
                  {analyticsTopHours.map((hour, index) => (
                    <div key={hour.hour} className={styles.analyticsHourRow}>
                      <div>
                        <strong>{formatHourLabel(hour.hour)}</strong>
                        <p className={styles.accountMeta}>
                          {index === 0 ? "Strongest hour" : `${hour.completedSessions} sessions`}
                        </p>
                      </div>
                      <div className={styles.analyticsBarTrack}>
                        <motion.div
                          className={styles.analyticsBarFill}
                          initial={{ width: "8%" }}
                          animate={{ width: `${Math.max(8, hour.sharePercent)}%` }}
                          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                      <span>{hour.focusMinutes}m</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className={styles.analyticsEmptyState}>Best focus hours appear after enough completed sessions are tracked.</p>
            )}
            </article>
          ) : null}

          {activeSection === "subjects" ? (
            <article className={`${styles.card} ${styles.analyticsDetailCard}`}>
              <ReportsDetailHeader
                sectionLabel="Subjects"
                title="Where the work is landing"
                body="The lanes taking most of your focus."
                onBack={closeActiveSection}
              />
            {analyticsTopSubjects.some((subject) => subject.focusMinutes > 0) ? (
              <div className={styles.analyticsSubjectList}>
                {analyticsTopSubjects.map((subject, index) => (
                  <div key={subject.key} className={styles.analyticsSubjectRow}>
                    <div className={styles.analyticsSubjectHeader}>
                      <strong>{subject.label}</strong>
                      <span>{subject.focusMinutes}m</span>
                    </div>
                    {index === 0 ? (
                      <p className={styles.analyticsSectionCallout}>This is where most of your tracked effort is landing.</p>
                    ) : null}
                    <div className={styles.analyticsBarTrack}>
                      <motion.div
                        className={styles.analyticsBarFill}
                        initial={{ width: "8%" }}
                        animate={{ width: `${(subject.focusMinutes / analyticsTopSubjectMinutes) * 100}%` }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <p className={styles.accountMeta}>
                      {subject.sessionsCompleted} completed sessions, {subject.tasksCompleted} tasks finished
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.analyticsEmptyState}>Subject-level analytics will fill in as tracked sessions accumulate.</p>
            )}
            </article>
          ) : null}

          {activeSection === "notifications" ? (
            <article className={`${styles.card} ${styles.analyticsDetailCard}`}>
              <ReportsDetailHeader
                sectionLabel="Nudges"
                title="Recommended prompts"
                body="The latest reminders Whelm wants to send."
                onBack={closeActiveSection}
              />
            {analyticsNotificationPlan ? (
              <div className={styles.analyticsNotificationList}>
                {analyticsNotificationPlan.notifications.map((notification) => (
                  <article key={notification.kind} className={styles.analyticsNotificationCard}>
                    <div className={styles.analyticsNotificationHeader}>
                      <strong>{notification.title}</strong>
                      <span>{notification.deliverAtLocalTime}</span>
                    </div>
                    <p className={styles.accountMeta}>{notification.body}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.analyticsEmptyState}>Once today has analytics data, Whelm can propose targeted nudges here.</p>
            )}
            </article>
          ) : null}
        </>
      )}
    </AnimatedTabSection>
  );
}
