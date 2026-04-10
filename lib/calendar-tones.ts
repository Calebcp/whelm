import type { CSSProperties } from "react";

export const CALENDAR_TONES = [
  { value: "Clear", ariaLabel: "Electric blue", accent: "#52bcff" },
  { value: "Push", ariaLabel: "Solar orange", accent: "#ff9a4d" },
  { value: "Deep", ariaLabel: "Voltage violet", accent: "#9275ff" },
  { value: "Sharp", ariaLabel: "Signal gold", accent: "#ffd84a" },
  { value: "Steady", ariaLabel: "Emerald green", accent: "#36ea8f" },
  { value: "Recover", ariaLabel: "Hot pink", accent: "#ff5fab" },
  { value: "Ember", ariaLabel: "Vermilion red", accent: "#ff5465" },
  { value: "Frost", ariaLabel: "Arctic cyan", accent: "#5fe9ff" },
  { value: "Tide", ariaLabel: "Teal surge", accent: "#19d2bc" },
  { value: "Dusk", ariaLabel: "Indigo dusk", accent: "#6f7bff" },
] as const;

export type CalendarTone = (typeof CALENDAR_TONES)[number]["value"];

export const FREE_CALENDAR_TONES: readonly CalendarTone[] = ["Clear", "Steady"];
export const PRO_CALENDAR_TONES: readonly CalendarTone[] = [
  "Clear",
  "Steady",
  "Deep",
  "Push",
  "Recover",
  "Sharp",
  "Ember",
  "Frost",
  "Tide",
  "Dusk",
];

export function getCalendarToneMeta(tone: CalendarTone | null | undefined) {
  return CALENDAR_TONES.find((item) => item.value === tone) ?? null;
}

export function getCalendarToneStyle(tone: CalendarTone | null | undefined): CSSProperties | undefined {
  const meta = getCalendarToneMeta(tone);
  return meta ? ({ ["--calendar-tone-accent" as const]: meta.accent } as CSSProperties) : undefined;
}

export function getAccessibleCalendarTones(isPro: boolean) {
  return isPro ? PRO_CALENDAR_TONES : FREE_CALENDAR_TONES;
}

export function canUseCalendarTone(tone: CalendarTone | null | undefined, isPro: boolean) {
  if (!tone) return false;
  return getAccessibleCalendarTones(isPro).includes(tone);
}

export function resolveAccessibleCalendarTone(tone: CalendarTone | null | undefined, isPro: boolean) {
  return canUseCalendarTone(tone, isPro) ? tone ?? null : null;
}
