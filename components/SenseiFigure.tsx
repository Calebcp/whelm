"use client";

import { useState } from "react";

import styles from "./SenseiFigure.module.css";

export type SenseiVariant =
  | "stressed"
  | "scholar"
  | "victory"
  | "neutral"
  | "anchor"
  | "bowed"
  | "meditate"
  | "rest"
  | "wave"
  | "applause";

type SenseiSize = "hero" | "card" | "inline" | "badge";
type SenseiAlign = "center" | "left" | "right";

type SenseiFigureProps = {
  variant: SenseiVariant;
  size?: SenseiSize;
  align?: SenseiAlign;
  message?: string;
  alt?: string;
  className?: string;
};

const SENSEI_VARIANTS: Record<
  SenseiVariant,
  { src: string; alt: string; motion: "float" | "calm" | "celebrate" | "wave" | "still" }
> = {
  stressed: {
    src: "/sensei/stressed.png",
    alt: "Whelm Sensei wiping stress away",
    motion: "float",
  },
  scholar: {
    src: "/sensei/scholar.png",
    alt: "Whelm Sensei holding coffee and a book",
    motion: "float",
  },
  victory: {
    src: "/sensei/victory.png",
    alt: "Whelm Sensei celebrating with raised fists",
    motion: "celebrate",
  },
  neutral: {
    src: "/sensei/neutral.png",
    alt: "Whelm Sensei standing ready",
    motion: "still",
  },
  anchor: {
    src: "/sensei/anchor.png",
    alt: "Whelm Sensei standing with hands on hips",
    motion: "float",
  },
  bowed: {
    src: "/sensei/bowed.png",
    alt: "Whelm Sensei hanging their head",
    motion: "still",
  },
  meditate: {
    src: "/sensei/meditate.png",
    alt: "Whelm Sensei meditating",
    motion: "calm",
  },
  rest: {
    src: "/sensei/rest.png",
    alt: "Whelm Sensei holding a pillow",
    motion: "calm",
  },
  wave: {
    src: "/sensei/wave.png",
    alt: "Whelm Sensei waving hello",
    motion: "wave",
  },
  applause: {
    src: "/sensei/applause.png",
    alt: "Whelm Sensei clapping",
    motion: "celebrate",
  },
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function SenseiFigure({
  variant,
  size = "card",
  align = "center",
  message,
  alt,
  className,
}: SenseiFigureProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const asset = SENSEI_VARIANTS[variant];
  const motionClass =
    asset.motion === "calm"
      ? styles.motionCalm
      : asset.motion === "celebrate"
        ? styles.motionCelebrate
        : asset.motion === "wave"
          ? styles.motionWave
          : asset.motion === "still"
            ? styles.motionStill
            : styles.motionFloat;

  return (
    <div
      className={cx(
        styles.figure,
        styles[size],
        align === "left" ? styles.alignLeft : align === "right" ? styles.alignRight : styles.alignCenter,
        className,
      )}
    >
      {message ? <div className={styles.bubble}>{message}</div> : null}
      <div className={cx(styles.shell, motionClass)}>
        {imageFailed ? (
          <div className={styles.fallback} aria-label={alt ?? asset.alt} role="img">
            <div className={styles.fallbackBandana} aria-hidden="true" />
            <span className={styles.fallbackMark}>W</span>
          </div>
        ) : (
          <img
            src={asset.src}
            alt={alt ?? asset.alt}
            className={styles.image}
            onError={() => setImageFailed(true)}
          />
        )}
      </div>
    </div>
  );
}
