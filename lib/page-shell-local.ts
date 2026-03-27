import { getCalendarToneMeta, type CalendarTone } from "@/lib/calendar-tones";

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

export function clearLocalAccountData(uid: string) {
  window.localStorage.removeItem(`whelm:notes:${uid}`);
  window.localStorage.removeItem(`whelm:sessions:${uid}`);
  window.localStorage.removeItem(plannedBlocksStorageKey(uid));
  window.localStorage.removeItem(`whelm:preferences:${uid}`);
  window.localStorage.removeItem(dayToneStorageKey(uid));
  window.localStorage.removeItem(monthToneStorageKey(uid));
  window.localStorage.removeItem(senseiStyleStorageKey(uid));
  window.localStorage.removeItem(streakMirrorStorageKey(uid));
  window.localStorage.removeItem(sickDaySaveStorageKey(uid));
  window.localStorage.removeItem(sickDaySaveDismissalsStorageKey(uid));
  window.localStorage.removeItem("whelm-pro-state-v1");
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
  window.localStorage.setItem(dayToneStorageKey(uid), JSON.stringify(tones));
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
  window.localStorage.setItem(monthToneStorageKey(uid), JSON.stringify(tones));
}
