"use client";

import { useEffect, useState, type CSSProperties } from "react";

import styles from "./BandanaCursor.module.css";

type BandanaCursorProps = {
  tierColor: string | null | undefined;
  glow: string;
};

const CURSOR_ASSET_BY_COLOR: Record<string, { src: string; srcSet: string }> = {
  yellow: {
    src: "/streak/cursor/bandana-yellow-128.png",
    srcSet:
      "/streak/cursor/bandana-yellow-128.png 1x, /streak/cursor/bandana-yellow-256.png 2x",
  },
  red: {
    src: "/streak/cursor/bandana-red-128.png",
    srcSet:
      "/streak/cursor/bandana-red-128.png 1x, /streak/cursor/bandana-red-256.png 2x",
  },
  green: {
    src: "/streak/cursor/bandana-green-128.png",
    srcSet:
      "/streak/cursor/bandana-green-128.png 1x, /streak/cursor/bandana-green-256.png 2x",
  },
  purple: {
    src: "/streak/cursor/bandana-purple-128.png",
    srcSet:
      "/streak/cursor/bandana-purple-128.png 1x, /streak/cursor/bandana-purple-256.png 2x",
  },
  blue: {
    src: "/streak/cursor/bandana-blue-128.png",
    srcSet:
      "/streak/cursor/bandana-blue-128.png 1x, /streak/cursor/bandana-blue-256.png 2x",
  },
  black: {
    src: "/streak/cursor/bandana-black-128.png",
    srcSet:
      "/streak/cursor/bandana-black-128.png 1x, /streak/cursor/bandana-black-256.png 2x",
  },
  white: {
    src: "/streak/cursor/bandana-white-128.png",
    srcSet:
      "/streak/cursor/bandana-white-128.png 1x, /streak/cursor/bandana-white-256.png 2x",
  },
};

export default function BandanaCursor({
  tierColor,
  glow,
}: BandanaCursorProps) {
  const HOTSPOT_X = 32;
  const HOTSPOT_Y = 12;
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

  const asset = CURSOR_ASSET_BY_COLOR[tierColor ?? "yellow"] ?? CURSOR_ASSET_BY_COLOR.yellow;

  return (
    <div
      className={`${styles.cursorShell} ${pressed ? styles.cursorShellPressed : ""}`}
      style={
        {
          left: `${position.x - HOTSPOT_X}px`,
          top: `${position.y - HOTSPOT_Y}px`,
          "--bandana-glow": glow,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <img
        className={styles.cursorBandana}
        src={asset.src}
        srcSet={asset.srcSet}
        alt=""
        draggable="false"
      />
      <div className={styles.cursorKnot} />
    </div>
  );
}
