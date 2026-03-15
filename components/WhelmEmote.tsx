"use client";

import { useRive } from "@rive-app/react-canvas";

import { getWhelmEmote, type WhelmEmoteId } from "@/lib/whelm-emotes";
import styles from "./WhelmEmote.module.css";

type WhelmEmoteSize = "hero" | "card" | "inline" | "badge";
type WhelmEmoteAlign = "center" | "left" | "right";

export default function WhelmEmote({
  emoteId,
  size = "card",
  align = "center",
  message,
  className,
}: {
  emoteId: WhelmEmoteId;
  size?: WhelmEmoteSize;
  align?: WhelmEmoteAlign;
  message?: string;
  className?: string;
}) {
  const emote = getWhelmEmote(emoteId);
  const { RiveComponent } = useRive({
    src: emote.publicPath,
    autoplay: true,
  });

  return (
    <div
      className={[
        styles.figure,
        styles[size],
        align === "left" ? styles.alignLeft : align === "right" ? styles.alignRight : styles.alignCenter,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {message ? <div className={styles.bubble}>{message}</div> : null}
      <div className={styles.shell}>
        <RiveComponent className={styles.canvas} aria-label={emote.label} />
      </div>
    </div>
  );
}
