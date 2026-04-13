import { getCalendarToneMeta, type CalendarTone } from "@/lib/calendar-tones";
import type { StreakLedgerEntry } from "@/lib/streak-ledger";
import type { LifetimeXpSummary } from "@/lib/xp-engine";

function plannedBlocksStorageKey(uid: string) {
  return `whelm:planned-focus:${uid}`;
}

function senseiStyleStorageKey(uid: string) {
  return `whelm:sensei-style:${uid}`;
}

function dayToneStorageKey(uid: string) {
  return `whelm:day-tones:${uid}`;
}

function monthToneStorageKey(uid: string) {
  return `whelm:month-tones:${uid}`;
}

function streakMirrorStorageKey(uid: string) {
  return `whelm:streak-mirror:${uid}`;
}

function sickDaySaveStorageKey(uid: string) {
  return `whelm:sick-day-saves:${uid}`;
}

function sickDaySaveDismissalsStorageKey(uid: string) {
  return `whelm:sick-day-save-dismissals:${uid}`;
}

function streakSnapshotStorageKey(uid: string) {
  return `whelm:streak-snapshot:v3:${uid}`;
}

const LOCAL_STREAK_SNAPSHOT_VERSION = 3;

export type LocalStreakSnapshot = {
  version: number;
  streak: number;
  qualifiedDateKeys: string[];
  dailyRecords: StreakLedgerEntry[];
  lifetimeXpSummary: LifetimeXpSummary;
  updatedAtISO: string;
};

export function clearLocalAccountData(uid: string) {
  try {
    const keysToRemove = [
      `whelm:notes:${uid}`,
      `whelm:sessions:${uid}`,
      plannedBlocksStorageKey(uid),
      `whelm:preferences:${uid}`,
      dayToneStorageKey(uid),
      monthToneStorageKey(uid),
      senseiStyleStorageKey(uid),
      streakMirrorStorageKey(uid),
      sickDaySaveStorageKey(uid),
      sickDaySaveDismissalsStorageKey(uid),
      streakSnapshotStorageKey(uid),
      `whelm_cards_${uid}`,
      `whelm:cards:${uid}`,
      "whelm-pro-state-v1",
    ];

    keysToRemove.forEach((key) => window.localStorage.removeItem(key));

    const prefixedKeys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
      .filter((key): key is string => Boolean(key))
      .filter(
        (key) =>
          key.startsWith(`whelm:notes:pending-delete:${uid}`) ||
          key.startsWith(`whelm:notes:revisions:${uid}:`),
      );

    prefixedKeys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Ignore storage cleanup failures in private / constrained webviews.
  }
}

export function loadLocalStreakSnapshot(uid: string): LocalStreakSnapshot | null {
  try {
    const raw = window.localStorage.getItem(streakSnapshotStorageKey(uid));
    const parsed = raw ? (JSON.parse(raw) as LocalStreakSnapshot) : null;
    if (!parsed) return null;
    if (parsed.version !== LOCAL_STREAK_SNAPSHOT_VERSION) return null;
    if (!Array.isArray(parsed.qualifiedDateKeys) || !Array.isArray(parsed.dailyRecords)) return null;
    if (!parsed.lifetimeXpSummary || typeof parsed.lifetimeXpSummary.totalXp !== "number") return null;
    if (typeof parsed.streak !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalStreakSnapshot(uid: string, snapshot: LocalStreakSnapshot) {
  try {
    window.localStorage.setItem(
      streakSnapshotStorageKey(uid),
      JSON.stringify({
        ...snapshot,
        version: LOCAL_STREAK_SNAPSHOT_VERSION,
      }),
    );
  } catch {
    // Ignore storage failures in private / constrained webviews.
  }
}

export function loadDayTones(uid: string): Record<string, CalendarTone> {
  try {
    const raw = window.localStorage.getItem(dayToneStorageKey(uid));
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(
          ([dateKey, tone]) =>
            /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && Boolean(getCalendarToneMeta(tone as CalendarTone)),
        )
        .map(([dateKey, tone]) => [dateKey, tone as CalendarTone]),
    );
  } catch {
    return {};
  }
}

export function saveDayTones(uid: string, tones: Record<string, CalendarTone>) {
  try {
    window.localStorage.setItem(dayToneStorageKey(uid), JSON.stringify(tones));
  } catch {
    // Ignore storage failures in private / constrained webviews.
  }
}

export function loadMonthTones(uid: string): Record<string, CalendarTone> {
  try {
    const raw = window.localStorage.getItem(monthToneStorageKey(uid));
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(
          ([monthKey, tone]) =>
            /^\d{4}-\d{2}$/.test(monthKey) && Boolean(getCalendarToneMeta(tone as CalendarTone)),
        )
        .map(([monthKey, tone]) => [monthKey, tone as CalendarTone]),
    );
  } catch {
    return {};
  }
}

export function saveMonthTones(uid: string, tones: Record<string, CalendarTone>) {
  try {
    window.localStorage.setItem(monthToneStorageKey(uid), JSON.stringify(tones));
  } catch {
    // Ignore storage failures in private / constrained webviews.
  }
}
