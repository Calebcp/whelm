"use client";

import { useRive } from "@rive-app/react-canvas";

import styles from "@/app/page.module.css";
import { getStreakBandanaTier } from "@/lib/streak-bandanas";

export default function StreakBandana({
  streakDays,
  className,
}: {
  streakDays: number;
  className?: string;
}) {
  "use no memo";

  const tier = getStreakBandanaTier(streakDays);
  const { RiveComponent } = useRive({
    src: tier ? `/streak/${tier.assetFile}` : "/streak/moveband.riv",
    autoplay: true,
  });

  return (
    <div
      className={[styles.streakBandanaWrap, className].filter(Boolean).join(" ")}
      aria-hidden="true"
      title={tier?.label}
    >
      <RiveComponent className={styles.streakBandanaRive} />
    </div>
  );
}
