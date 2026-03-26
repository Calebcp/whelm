export type WhelPose =
  | "alert_discipline"
  | "celebrate_success"
  | "focus_action"
  | "meditating"
  | "ready_idle"
  | "recovery_low_state"
  | "thinking_idea";

export type WhelBandanaColor =
  | "yellow"
  | "red"
  | "green"
  | "purple"
  | "blue"
  | "black"
  | "white";

/** Derive the bandana color from a streak count (0 = no streak → defaults to yellow). */
export function bandanaColorFromStreak(streak: number): WhelBandanaColor {
  if (streak >= 100) return "white";
  if (streak >= 50) return "black";
  if (streak >= 20) return "blue";
  if (streak >= 10) return "purple";
  if (streak >= 5) return "green";
  if (streak >= 2) return "red";
  return "yellow";
}

export function getWhelImagePath(pose: WhelPose, color: WhelBandanaColor): string {
  return `/whelms/${pose}/${pose}_${color}_whelm.PNG`;
}

/** Maps SenseiVariant names to their corresponding WhelPose. */
export const VARIANT_TO_POSE: Record<string, WhelPose> = {
  stressed: "alert_discipline",
  scholar: "thinking_idea",
  victory: "celebrate_success",
  applause: "celebrate_success",
  neutral: "ready_idle",
  wave: "ready_idle",
  anchor: "focus_action",
  bowed: "recovery_low_state",
  meditate: "meditating",
  rest: "meditating",
};

export type MascotTrigger =
  | "session_start"
  | "xp_milestone"
  | "streak_maintained"
  | "streak_broken"
  | "cards_session_done"
  | "note_saved"
  | "long_idle"
  | "plan_created";

export type MascotAppearance = {
  pose: WhelPose;
  message: string;
  trigger: MascotTrigger;
};

export const MASCOT_TRIGGERS: Record<MascotTrigger, Omit<MascotAppearance, "trigger">> = {
  session_start: {
    pose: "ready_idle",
    message: "Ready when you are.",
  },
  xp_milestone: {
    pose: "celebrate_success",
    message: "XP milestone hit. Keep stacking.",
  },
  streak_maintained: {
    pose: "celebrate_success",
    message: "Streak protected. Another day counted.",
  },
  streak_broken: {
    pose: "recovery_low_state",
    message: "Streak reset. The work still happened.",
  },
  cards_session_done: {
    pose: "celebrate_success",
    message: "Cards cleared. Recall sharpened.",
  },
  note_saved: {
    pose: "focus_action",
    message: "Note locked in.",
  },
  long_idle: {
    pose: "meditating",
    message: "Still here when you're ready.",
  },
  plan_created: {
    pose: "thinking_idea",
    message: "Plan set. Now execute.",
  },
};
