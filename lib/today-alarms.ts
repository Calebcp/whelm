export type TodayAlarm = {
  id: string;
  timeOfDay: string;
  label: string;
  enabled: boolean;
  mode?: "soft" | "hard";
  linkedBlockId?: string;
  linkedBlockTitle?: string;
  linkedDateKey?: string;
  linkedBlockDurationMinutes?: number;
};

export const TODAY_ALARMS_STORAGE_KEY = "whelm:today-alarms:v1";
export const TODAY_ALARMS_CHANGED_EVENT = "whelm:today-alarms-changed";

export function sortTodayAlarms(items: TodayAlarm[]) {
  return [...items].sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay) || a.label.localeCompare(b.label));
}

export function readStoredTodayAlarms(): TodayAlarm[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TODAY_ALARMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TodayAlarm[];
    if (!Array.isArray(parsed)) return [];
    return sortTodayAlarms(
      parsed.filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.timeOfDay === "string" &&
          typeof item.label === "string" &&
          typeof item.enabled === "boolean" &&
          (typeof item.mode === "undefined" || item.mode === "soft" || item.mode === "hard") &&
          (typeof item.linkedBlockId === "undefined" || typeof item.linkedBlockId === "string") &&
          (typeof item.linkedBlockTitle === "undefined" || typeof item.linkedBlockTitle === "string") &&
          (typeof item.linkedDateKey === "undefined" || typeof item.linkedDateKey === "string") &&
          (typeof item.linkedBlockDurationMinutes === "undefined" || Number.isFinite(item.linkedBlockDurationMinutes)),
      ),
    );
  } catch {
    return [];
  }
}

export function writeStoredTodayAlarms(items: TodayAlarm[]) {
  if (typeof window === "undefined") return;
  try {
    const next = sortTodayAlarms(items);
    window.localStorage.setItem(TODAY_ALARMS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(TODAY_ALARMS_CHANGED_EVENT, { detail: next }));
  } catch {
    // Ignore storage errors in constrained environments.
  }
}
