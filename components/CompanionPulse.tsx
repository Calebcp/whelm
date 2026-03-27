"use client";

import styles from "@/app/page.module.css";
import SenseiFigure, { type SenseiVariant } from "@/components/SenseiFigure";
import type { WhelBandanaColor } from "@/lib/whelm-mascot";

export default function CompanionPulse({
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
