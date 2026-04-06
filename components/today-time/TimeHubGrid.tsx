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
  onOpenTimer: () => void;
  onOpenBlock: () => void;
  onOpenAlarm: () => void;
};

type ToolCardProps = {
  label: string;
  imageSrc: string;
  imageAlt: string;
  imageClassName?: string;
  dataTour?: string;
  onClick: () => void;
};

function ToolCard({ label, imageSrc, imageAlt, imageClassName, dataTour, onClick }: ToolCardProps) {
  return (
    <button type="button" className={styles.timeToolCard} data-tour={dataTour} onClick={onClick}>
      <strong className={styles.timeToolName}>{label}</strong>
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
  onOpenTimer,
  onOpenBlock,
  onOpenAlarm,
}: TimeHubGridProps) {
  return (
    <section className={styles.timeHubSection}>
      <div className={styles.timeHubGrid}>
        <ToolCard
          label="Timer"
          imageSrc={TIMER_PREVIEW_BY_COLOR[bandanaColor]}
          imageAlt=""
          dataTour="time-hub-timer"
          onClick={onOpenTimer}
        />
        <ToolCard
          label="Block"
          imageSrc={BLOCK_PREVIEW}
          imageAlt=""
          imageClassName={styles.timeToolPreviewBlock}
          dataTour="time-hub-block"
          onClick={onOpenBlock}
        />
        <ToolCard
          label="Alarm"
          imageSrc={ALARM_PREVIEW_BY_COLOR[bandanaColor]}
          imageAlt=""
          imageClassName={styles.timeToolPreviewAlarm}
          onClick={onOpenAlarm}
        />
      </div>
    </section>
  );
}
