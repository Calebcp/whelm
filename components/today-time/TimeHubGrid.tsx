"use client";

import styles from "@/app/page.module.css";
import type { WhelBandanaColor } from "@/lib/whelm-mascot";

const TIMER_PREVIEW_BY_COLOR: Record<WhelBandanaColor, string> = {
  black: "/time-hub/timer/black.png",
  blue: "/time-hub/timer/blue.png",
  green: "/time-hub/timer/green.png",
  purple: "/time-hub/timer/purple.png",
  red: "/time-hub/timer/red.png",
  white: "/time-hub/timer/white.png",
  yellow: "/time-hub/timer/yellow.png",
};

const ALARM_PREVIEW_BY_COLOR: Record<WhelBandanaColor, string> = {
  black: "/time-hub/alarm/black.png",
  blue: "/time-hub/alarm/blue.png",
  green: "/time-hub/alarm/green.png",
  purple: "/time-hub/alarm/purple.png",
  red: "/time-hub/alarm/red.png",
  white: "/time-hub/alarm/white.png",
  yellow: "/time-hub/alarm/yellow.png",
};

const BLOCK_PREVIEW = "/time-hub/block/block-preview.jpg";

type TimeHubGridProps = {
  bandanaColor: WhelBandanaColor;
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
  imageSrc: string;
  imageAlt: string;
  imageClassName?: string;
  onClick: () => void;
};

function ToolCard({ eyebrow, title, meta, action, imageSrc, imageAlt, imageClassName, onClick }: ToolCardProps) {
  return (
    <button type="button" className={styles.timeToolCard} onClick={onClick}>
      <div className={styles.timeToolCardCopy}>
        <span className={styles.timeToolEyebrow}>{eyebrow}</span>
        <strong className={styles.timeToolTitle}>{title}</strong>
        <span className={styles.timeToolMeta}>{meta}</span>
        <span className={styles.timeToolAction}>{action}</span>
      </div>
      <div className={styles.timeToolPreviewWrap} aria-hidden="true">
        <img
          src={imageSrc}
          alt={imageAlt}
          className={`${styles.timeToolPreview} ${imageClassName ?? ""}`}
          loading="lazy"
        />
      </div>
    </button>
  );
}

export default function TimeHubGrid({
  bandanaColor,
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
          imageSrc={TIMER_PREVIEW_BY_COLOR[bandanaColor]}
          imageAlt=""
          onClick={onOpenTimer}
        />
        <ToolCard
          eyebrow="Block"
          title={nextBlockLabel}
          meta={nextBlockMeta}
          action="Compose"
          imageSrc={BLOCK_PREVIEW}
          imageAlt=""
          imageClassName={styles.timeToolPreviewBlock}
          onClick={onOpenBlock}
        />
        <ToolCard
          eyebrow="Alarm"
          title={alarmLabel}
          meta={alarmMeta}
          action={alarmAction}
          imageSrc={ALARM_PREVIEW_BY_COLOR[bandanaColor]}
          imageAlt=""
          imageClassName={styles.timeToolPreviewAlarm}
          onClick={onOpenAlarm}
        />
      </div>
    </section>
  );
}
