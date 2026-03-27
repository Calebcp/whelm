"use client";

import styles from "@/app/page.module.css";
import StreakBandana from "@/components/StreakBandana";

function getDailyRitualWaveImagePath(tier: string | null | undefined) {
  switch (tier) {
    case "white":
      return "/waving-intro-whelms/wave-white.png";
    case "black":
      return "/waving-intro-whelms/wave-black.png";
    case "blue":
      return "/waving-intro-whelms/wave-blue.png";
    case "purple":
      return "/waving-intro-whelms/wave-purple.png";
    case "green":
      return "/waving-intro-whelms/wave-green.png";
    case "red":
      return "/waving-intro-whelms/wave-red.png";
    case "yellow":
    default:
      return "/waving-intro-whelms/wave-yellow.png";
  }
}

export function DailyRitualWaveIcon({
  className,
  tierColor,
}: {
  className?: string;
  tierColor: string | null | undefined;
}) {
  return (
    <div className={[styles.dailyRitualWaveIcon, className].filter(Boolean).join(" ")} aria-hidden="true">
      <img
        src={getDailyRitualWaveImagePath(tierColor)}
        alt=""
        className={styles.dailyRitualCornerIconImage}
      />
    </div>
  );
}

export function DailyRitualSubmitBandana({
  className,
  streakDays,
}: {
  className?: string;
  streakDays: number;
}) {
  return (
    <div className={[styles.dailyRitualSubmitBandanaWrap, className].filter(Boolean).join(" ")} aria-hidden="true">
      <StreakBandana streakDays={streakDays} className={styles.dailyRitualSubmitBandanaCanvas} />
    </div>
  );
}
