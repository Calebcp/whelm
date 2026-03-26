"use client";

import { useEffect, useRef } from "react";
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
};

function XPPopItem({ pop, onDone }: { pop: XPPop; onDone: (id: string) => void }) {
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
      +{pop.amount} XP
    </div>
  );
}

export default function XPPopAnimation({ pops, onDone }: Props) {
  return (
    <>
      {pops.map((pop) => (
        <XPPopItem key={pop.id} pop={pop} onDone={onDone} />
      ))}
    </>
  );
}
