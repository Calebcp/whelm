import { useCallback, useRef, useState } from "react";

import {
  type MascotTrigger,
  type WhelBandanaColor,
  type WhelPose,
  MASCOT_TRIGGERS,
} from "@/lib/whelm-mascot";

export type MascotState = {
  visible: boolean;
  pose: WhelPose;
  bandanaColor: WhelBandanaColor;
  message: string;
};

const HIDDEN: MascotState = {
  visible: false,
  pose: "ready_idle",
  bandanaColor: "yellow",
  message: "",
};

/**
 * Manages the floating Whelm mascot state.
 *
 * Each trigger fires at most once per browser session (tracked in sessionStorage)
 * unless `force` is passed, which overrides the dedup check.
 *
 * @param bandanaColor  The color derived from the user's current streak.
 */
export function useMascot(bandanaColor: WhelBandanaColor) {
  const [mascot, setMascot] = useState<MascotState>(HIDDEN);
  // Set of triggers already shown this session
  const shownRef = useRef(new Set<string>(loadShown()));

  const show = useCallback(
    (trigger: MascotTrigger, opts?: { force?: boolean; message?: string }) => {
      if (!opts?.force && shownRef.current.has(trigger)) return;

      shownRef.current.add(trigger);
      persistShown(shownRef.current);

      const template = MASCOT_TRIGGERS[trigger];
      setMascot({
        visible: true,
        pose: template.pose,
        bandanaColor,
        message: opts?.message ?? template.message,
      });
    },
    [bandanaColor],
  );

  const dismiss = useCallback(() => {
    setMascot(HIDDEN);
  }, []);

  return { mascot, show, dismiss };
}

const SESSION_KEY = "whelm:mascot:shown";

function loadShown(): string[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function persistShown(set: Set<string>) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...set]));
  } catch {
    // sessionStorage unavailable — silently continue
  }
}
