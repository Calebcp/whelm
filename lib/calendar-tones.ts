import type { CSSProperties } from "react";

export const CALENDAR_TONES = [
  { value: "Clear", ariaLabel: "Electric blue", accent: "#53b7ff" },
  { value: "Push", ariaLabel: "Solar orange", accent: "#ff9b54" },
  { value: "Deep", ariaLabel: "Voltage violet", accent: "#7c7cff" },
  { value: "Sharp", ariaLabel: "Laser yellow", accent: "#ffe14d" },
  { value: "Steady", ariaLabel: "Neon green", accent: "#47f59a" },
  { value: "Recover", ariaLabel: "Hot pink", accent: "#ff6f9f" },
  { value: "Ember", ariaLabel: "Crimson ember", accent: "#ff5a5f" },
  { value: "Frost", ariaLabel: "Arctic cyan", accent: "#71e7ff" },
  { value: "Tide", ariaLabel: "Ocean teal", accent: "#2dd4bf" },
  { value: "Dusk", ariaLabel: "Midnight indigo", accent: "#5b6cff" },
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
