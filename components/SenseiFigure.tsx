"use client";

import { useEffect, useRef, useState } from "react";

import {
  type WhelBandanaColor,
  type WhelPose,
  VARIANT_TO_POSE,
  getWhelImagePath,
} from "@/lib/whelm-mascot";
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
  bandanaColor?: WhelBandanaColor;
  size?: SenseiSize;
  align?: SenseiAlign;
  message?: string;
  alt?: string;
  className?: string;
  emoteVideoSrc?: string;
  autoPlayEmote?: boolean;
};

const SENSEI_VARIANTS: Record<
  SenseiVariant,
  { alt: string; motion: "float" | "calm" | "celebrate" | "wave" | "still" }
> = {
  stressed: { alt: "Whelm wiping stress away", motion: "float" },
  scholar: { alt: "Whelm holding coffee and a book", motion: "float" },
  victory: { alt: "Whelm celebrating with raised fists", motion: "celebrate" },
  neutral: { alt: "Whelm standing ready", motion: "still" },
  anchor: { alt: "Whelm standing with hands on hips", motion: "float" },
  bowed: { alt: "Whelm hanging their head", motion: "still" },
  meditate: { alt: "Whelm meditating", motion: "calm" },
  rest: { alt: "Whelm holding a pillow", motion: "calm" },
  wave: { alt: "Whelm waving hello", motion: "wave" },
  applause: { alt: "Whelm clapping", motion: "celebrate" },
};

function resolveImageSrc(variant: SenseiVariant, bandanaColor: WhelBandanaColor): string {
  const pose: WhelPose = VARIANT_TO_POSE[variant] ?? "ready_idle";
  return getWhelImagePath(pose, bandanaColor);
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function SenseiFigure({
  variant,
  bandanaColor = "yellow",
  size = "card",
  align = "center",
  message,
  alt,
  className,
  emoteVideoSrc,
  autoPlayEmote = false,
}: SenseiFigureProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [showEmote, setShowEmote] = useState(Boolean(emoteVideoSrc && autoPlayEmote));
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const asset = SENSEI_VARIANTS[variant];
  const imageSrc = resolveImageSrc(variant, bandanaColor);
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

  useEffect(() => {
    if (!emoteVideoSrc || !autoPlayEmote) return;
    setShowEmote(false);
    const frameId = window.requestAnimationFrame(() => {
      setShowEmote(true);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [autoPlayEmote, emoteVideoSrc]);

  useEffect(() => {
    if (!showEmote) return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch(() => {
      setShowEmote(false);
    });
  }, [showEmote]);

  function triggerEmote() {
    if (!emoteVideoSrc) return;
    setShowEmote(false);
    window.requestAnimationFrame(() => {
      const video = videoRef.current;
      setShowEmote(true);
      if (video) {
        video.currentTime = 0;
        void video.play().catch(() => {
          setShowEmote(false);
        });
      }
    });
  }

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
      <div
        className={cx(styles.shell, motionClass, emoteVideoSrc && styles.shellEmote)}
        onMouseEnter={emoteVideoSrc ? triggerEmote : undefined}
        onFocus={emoteVideoSrc ? triggerEmote : undefined}
        onTouchStart={emoteVideoSrc ? triggerEmote : undefined}
        tabIndex={emoteVideoSrc ? 0 : undefined}
      >
        {imageFailed ? (
          <div className={styles.fallback} aria-label={alt ?? asset.alt} role="img">
            <div className={styles.fallbackBandana} aria-hidden="true" />
            <span className={styles.fallbackMark}>W</span>
          </div>
        ) : (
          <>
            <img
              src={imageSrc}
              alt={alt ?? asset.alt}
              className={styles.image}
              onError={() => setImageFailed(true)}
            />
            {emoteVideoSrc ? (
              <video
                ref={videoRef}
                className={cx(styles.emoteVideo, showEmote && styles.emoteVideoVisible)}
                muted
                playsInline
                preload="metadata"
                aria-hidden="true"
                onEnded={() => setShowEmote(false)}
              >
                <source src={emoteVideoSrc} type="video/mp4" />
              </video>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
