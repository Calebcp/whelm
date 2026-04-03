"use client";

import { memo } from "react";
import { useRive } from "@rive-app/react-canvas";

import styles from "@/app/page.module.css";
import { getStreakBandanaTier } from "@/lib/streak-bandanas";

const StreakBandanaAsset = memo(function StreakBandanaAsset({
  src,
  className,
}: {
  src: string;
  className: string;
}) {
  const { RiveComponent } = useRive({
    src,
    autoplay: true,
  });

  return <RiveComponent className={className} />;
});

const StreakBandana = memo(function StreakBandana({
  streakDays,
  className,
}: {
  streakDays: number;
  className?: string;
}) {
  const tier = getStreakBandanaTier(streakDays);
  const src = tier ? `/streak/${tier.assetFile}` : "/streak/moveband.riv";

  return (
    <div
      className={[styles.streakBandanaWrap, className].filter(Boolean).join(" ")}
      aria-hidden="true"
      title={tier?.label}
    >
      <StreakBandanaAsset key={src} src={src} className={styles.streakBandanaRive} />
    </div>
  );
});

export default StreakBandana;
