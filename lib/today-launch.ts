import { readStoredTodayAlarms, type TodayAlarm } from "@/lib/today-alarms";

export type TodayLaunchRequest = {
  id: string;
  source: "alarm";
  tool: "timer" | "alarm";
  alarmId?: string;
  alarmLabel?: string;
  alarmTimeOfDay?: string;
  linkedBlockId?: string;
  linkedBlockTitle?: string;
  linkedBlockDateKey?: string;
  linkedBlockDurationMinutes?: number;
  autoStart?: boolean;
  createdAtISO: string;
};

export const TODAY_LAUNCH_REQUEST_STORAGE_KEY = "whelm:today-launch-request:v1";
export const TODAY_LAUNCH_REQUEST_EVENT = "whelm:today-launch-request";

function createRequestId(prefix: string) {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}`;
}

export function readStoredTodayLaunchRequest(): TodayLaunchRequest | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TODAY_LAUNCH_REQUEST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TodayLaunchRequest> | null;
    if (!parsed || typeof parsed.id !== "string" || parsed.source !== "alarm") return null;
    if (parsed.tool !== "timer" && parsed.tool !== "alarm") return null;
    return {
      id: parsed.id,
      source: "alarm",
      tool: parsed.tool,
      alarmId: typeof parsed.alarmId === "string" ? parsed.alarmId : undefined,
      alarmLabel: typeof parsed.alarmLabel === "string" ? parsed.alarmLabel : undefined,
      alarmTimeOfDay: typeof parsed.alarmTimeOfDay === "string" ? parsed.alarmTimeOfDay : undefined,
      linkedBlockId: typeof parsed.linkedBlockId === "string" ? parsed.linkedBlockId : undefined,
      linkedBlockTitle: typeof parsed.linkedBlockTitle === "string" ? parsed.linkedBlockTitle : undefined,
      linkedBlockDateKey: typeof parsed.linkedBlockDateKey === "string" ? parsed.linkedBlockDateKey : undefined,
      linkedBlockDurationMinutes:
        typeof parsed.linkedBlockDurationMinutes === "number" && Number.isFinite(parsed.linkedBlockDurationMinutes)
          ? parsed.linkedBlockDurationMinutes
          : undefined,
      autoStart: parsed.autoStart === true,
      createdAtISO:
        typeof parsed.createdAtISO === "string" ? parsed.createdAtISO : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeStoredTodayLaunchRequest(request: TodayLaunchRequest | null) {
  if (typeof window === "undefined") return;
  try {
    if (!request) {
      window.localStorage.removeItem(TODAY_LAUNCH_REQUEST_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(TODAY_LAUNCH_REQUEST_EVENT, { detail: null }));
      return;
    }
    window.localStorage.setItem(TODAY_LAUNCH_REQUEST_STORAGE_KEY, JSON.stringify(request));
    window.dispatchEvent(new CustomEvent(TODAY_LAUNCH_REQUEST_EVENT, { detail: request }));
  } catch {
    // Ignore storage errors in constrained environments.
  }
}

export function clearStoredTodayLaunchRequest() {
  writeStoredTodayLaunchRequest(null);
}

export function buildTodayLaunchRequestFromAlarm(alarm: TodayAlarm): TodayLaunchRequest {
  const linkedDuration = Number.isFinite(alarm.linkedBlockDurationMinutes)
    ? alarm.linkedBlockDurationMinutes
    : undefined;

  return {
    id: createRequestId(`alarm-launch-${alarm.id}`),
    source: "alarm",
    tool: linkedDuration ? "timer" : "alarm",
    alarmId: alarm.id,
    alarmLabel: alarm.label || alarm.linkedBlockTitle || "Whelm alarm",
    alarmTimeOfDay: alarm.timeOfDay,
    linkedBlockId: alarm.linkedBlockId,
    linkedBlockTitle: alarm.linkedBlockTitle,
    linkedBlockDateKey: alarm.linkedDateKey,
    linkedBlockDurationMinutes: linkedDuration,
    autoStart: Boolean(linkedDuration),
    createdAtISO: new Date().toISOString(),
  };
}

export function buildTodayLaunchRequestFromAlarmId(alarmId: string) {
  const alarm = readStoredTodayAlarms().find((item) => item.id === alarmId);
  return alarm ? buildTodayLaunchRequestFromAlarm(alarm) : null;
}
