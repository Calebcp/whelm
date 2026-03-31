import type { CalendarTone } from "@/lib/calendar-tones";

export const WHELM_STANDARD_NAME = "Whelm Standard";
export const WHELM_PRO_NAME = "Whelm Pro";
export const WHELM_STANDARD_HISTORY_DAYS = 14;

export const STANDARD_CALENDAR_TONES: readonly CalendarTone[] = ["Clear", "Deep", "Steady"];

export const STANDARD_NOTE_COLOR_VALUES = [
  "#f8fafc",
  "#e7e5e4",
  "#f5e6c8",
  "#fef3c7",
  "#bbf7d0",
  "#bae6fd",
] as const;

export function isStandardNoteColor(value: string | null | undefined) {
  return typeof value === "string" && STANDARD_NOTE_COLOR_VALUES.includes(value as (typeof STANDARD_NOTE_COLOR_VALUES)[number]);
}

export function resolveStandardNoteColor(value: string | null | undefined, fallback = "#e7e5e4") {
  return isStandardNoteColor(value) ? (value as string) : fallback;
}
