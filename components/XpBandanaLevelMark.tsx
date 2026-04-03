"use client";

import { memo } from "react";
import { useRive } from "@rive-app/react-canvas";

import styles from "@/app/page.module.css";
import { getStreakBandanaAssetPath } from "@/lib/profile-tier";

const XpBandanaAsset = memo(function XpBandanaAsset({
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

const XpBandanaLevelMark = memo(function XpBandanaLevelMark({
  className,
  tierColor,
  level,
}: {
  className?: string;
  tierColor: string | null | undefined;
  level: number;
}) {
  const src = getStreakBandanaAssetPath(tierColor);

  return (
    <div className={[styles.xpBandanaLevelMark, className].filter(Boolean).join(" ")} aria-hidden="true">
      <XpBandanaAsset key={src} src={src} className={styles.xpBandanaLevelCanvas} />
      <span className={styles.xpBandanaLevelValue}>{level}</span>
    </div>
  );
});

export default XpBandanaLevelMark;
