import type { CSSProperties } from "react";

export const CALENDAR_TONES = [
  { value: "Clear", ariaLabel: "Electric blue", accent: "#53b7ff" },
  { value: "Push", ariaLabel: "Solar orange", accent: "#ff9b54" },
  { value: "Deep", ariaLabel: "Voltage violet", accent: "#7c7cff" },
  { value: "Sharp", ariaLabel: "Laser yellow", accent: "#ffe14d" },
  { value: "Steady", ariaLabel: "Neon green", accent: "#47f59a" },
  { value: "Recover", ariaLabel: "Hot pink", accent: "#ff6f9f" },
] as const;

export type CalendarTone = (typeof CALENDAR_TONES)[number]["value"];

export function getCalendarToneMeta(tone: CalendarTone | null | undefined) {
  return CALENDAR_TONES.find((item) => item.value === tone) ?? null;
}

export function getCalendarToneStyle(tone: CalendarTone | null | undefined): CSSProperties | undefined {
  const meta = getCalendarToneMeta(tone);
  return meta ? ({ ["--calendar-tone-accent" as const]: meta.accent } as CSSProperties) : undefined;
}
