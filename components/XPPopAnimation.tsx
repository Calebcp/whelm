"use client";

import { useEffect, useRef } from "react";
import WhelmProfileAvatar from "@/components/WhelmProfileAvatar";
import styles from "./XPPopAnimation.module.css";

export type XPPop = {
  id: string;
  amount: number;
  x?: number;
  y?: number;
};

type Props = {
  pops: XPPop[];
  onDone: (id: string) => void;
  currentTierColor: string | null | undefined;
  isPro: boolean;
  photoUrl?: string | null;
};

function XPPopItem({
  pop,
  onDone,
  currentTierColor,
  isPro,
  photoUrl,
}: {
  pop: XPPop;
  onDone: (id: string) => void;
  currentTierColor: string | null | undefined;
  isPro: boolean;
  photoUrl?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => onDone(pop.id), 1100);
    return () => clearTimeout(timer);
  }, [pop.id, onDone]);

  const style: React.CSSProperties = {
    position: "fixed",
    left: pop.x != null ? pop.x : "50%",
    top: pop.y != null ? pop.y : "40%",
    transform: pop.x == null ? "translateX(-50%)" : undefined,
    pointerEvents: "none",
    zIndex: 9999,
  };

  return (
    <div ref={ref} style={style} className={styles.pop}>
      <span className={styles.popAvatarWrap}>
        <WhelmProfileAvatar
          tierColor={currentTierColor}
          size="mini"
          isPro={isPro}
        />
      </span>
      +{pop.amount} XP
    </div>
  );
}

export default function XPPopAnimation({ pops, onDone, currentTierColor, isPro, photoUrl }: Props) {
  return (
    <>
      {pops.map((pop) => (
        <XPPopItem
          key={pop.id}
          pop={pop}
          onDone={onDone}
          currentTierColor={currentTierColor}
          isPro={isPro}
          photoUrl={photoUrl}
        />
      ))}
    </>
  );
}
