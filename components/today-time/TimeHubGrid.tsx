"use client";

import styles from "@/app/page.module.css";

type TimeHubGridProps = {
  timerLabel: string;
  nextBlockLabel: string;
  nextBlockMeta: string;
  alarmLabel: string;
  alarmMeta: string;
  alarmAction?: string;
  onOpenTimer: () => void;
  onOpenBlock: () => void;
  onOpenAlarm: () => void;
};

type ToolCardProps = {
  eyebrow: string;
  title: string;
  meta: string;
  action: string;
  onClick: () => void;
};

function ToolCard({ eyebrow, title, meta, action, onClick }: ToolCardProps) {
  return (
    <button type="button" className={styles.timeToolCard} onClick={onClick}>
      <span className={styles.timeToolEyebrow}>{eyebrow}</span>
      <strong className={styles.timeToolTitle}>{title}</strong>
      <span className={styles.timeToolMeta}>{meta}</span>
      <span className={styles.timeToolAction}>{action}</span>
    </button>
  );
}

export default function TimeHubGrid({
  timerLabel,
  nextBlockLabel,
  nextBlockMeta,
  alarmLabel,
  alarmMeta,
  alarmAction = "Open",
  onOpenTimer,
  onOpenBlock,
  onOpenAlarm,
}: TimeHubGridProps) {
  return (
    <section className={styles.timeHubSection}>
      <div className={styles.timeHubHeader}>
        <div>
          <p className={styles.sectionLabel}>Today</p>
          <h2 className={styles.cardTitle}>Time hub</h2>
        </div>
        <p className={styles.accountMeta}>Clock tools live here. Schedule only reflects the saved blocks.</p>
      </div>
      <div className={styles.timeHubGrid}>
        <ToolCard
          eyebrow="Timer"
          title={timerLabel}
          meta="Open full-screen timer"
          action="Open"
          onClick={onOpenTimer}
        />
        <ToolCard
          eyebrow="Block"
          title={nextBlockLabel}
          meta={nextBlockMeta}
          action="Compose"
          onClick={onOpenBlock}
        />
        <ToolCard
          eyebrow="Alarm"
          title={alarmLabel}
          meta={alarmMeta}
          action={alarmAction}
          onClick={onOpenAlarm}
        />
      </div>
    </section>
  );
}
