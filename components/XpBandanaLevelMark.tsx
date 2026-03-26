"use client";

import { useRive } from "@rive-app/react-canvas";

import styles from "@/app/page.module.css";
import { getStreakBandanaAssetPath } from "@/lib/profile-tier";

export default function XpBandanaLevelMark({
  className,
  tierColor,
  level,
}: {
  className?: string;
  tierColor: string | null | undefined;
  level: number;
}) {
  "use no memo";

  const { RiveComponent } = useRive({
    src: getStreakBandanaAssetPath(tierColor),
    autoplay: true,
  });

  return (
    <div className={[styles.xpBandanaLevelMark, className].filter(Boolean).join(" ")} aria-hidden="true">
      <RiveComponent className={styles.xpBandanaLevelCanvas} />
      <span className={styles.xpBandanaLevelValue}>{level}</span>
    </div>
  );
}
