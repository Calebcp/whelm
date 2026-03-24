"use client";

import { useEffect, useState, type CSSProperties } from "react";

import styles from "./BandanaCursor.module.css";

type BandanaCursorProps = {
  accent: string;
  accentStrong: string;
  accentDeep: string;
  glow: string;
};

export default function BandanaCursor({
  accent,
  accentStrong,
  accentDeep,
  glow,
}: BandanaCursorProps) {
  const [enabled, setEnabled] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [position, setPosition] = useState({ x: -100, y: -100 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(pointer: fine)");
    const updateEnabled = () => setEnabled(media.matches);
    updateEnabled();

    const handleMove = (event: MouseEvent) => {
      setPosition({ x: event.clientX, y: event.clientY });
    };
    const handleDown = () => setPressed(true);
    const handleUp = () => setPressed(false);

    media.addEventListener("change", updateEnabled);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("mouseup", handleUp);

    return () => {
      media.removeEventListener("change", updateEnabled);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("bandanaCursorActive", enabled);
    return () => {
      document.body.classList.remove("bandanaCursorActive");
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      className={`${styles.cursorShell} ${pressed ? styles.cursorShellPressed : ""}`}
      style={
        {
          left: `${position.x}px`,
          top: `${position.y}px`,
          "--bandana-accent": accent,
          "--bandana-accent-strong": accentStrong,
          "--bandana-accent-deep": accentDeep,
          "--bandana-glow": glow,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <div className={styles.cursorBandana} />
      <div className={styles.cursorKnot} />
    </div>
  );
}
