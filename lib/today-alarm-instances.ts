import { dayKeyLocal } from "@/lib/date-utils";
import { readStoredTodayAlarms, type TodayAlarm } from "@/lib/today-alarms";
import type { TodayLaunchRequest } from "@/lib/today-launch";

export type TodayAlarmInstanceStatus = "started" | "snoozed" | "missed" | "completed";
export type TodayAlarmInstanceOutcome = "on_time" | "late" | "snoozed" | "missed";

export type TodayAlarmInstance = {
  id: string;
  alarmId: string;
  alarmLabel: string;
  alarmMode: "soft" | "hard";
  scheduledDateKey: string;
  scheduledForISO: string;
  linkedBlockId?: string;
  linkedBlockTitle?: string;
  linkedBlockDateKey?: string;
  linkedBlockDurationMinutes?: number;
  source: "alarm";
  status: TodayAlarmInstanceStatus;
  createdAtISO: string;
  startedAtISO?: string;
  snoozedUntilISO?: string;
  missedAtISO?: string;
  completedAtISO?: string;
  snoozeCount?: number;
  outcome?: TodayAlarmInstanceOutcome;
  effectAppliedAtISO?: string;
};

export const TODAY_ALARM_INSTANCES_STORAGE_KEY = "whelm:today-alarm-instances:v1";
export const TODAY_ALARM_INSTANCES_EVENT = "whelm:today-alarm-instances";

const MISSED_GRACE_MINUTES = 10;
const DEFAULT_SNOOZE_MINUTES = 10;
const ON_TIME_WINDOW_MINUTES = 5;

function normalizeItems(items: TodayAlarmInstance[]) {
  return [...items].sort((a, b) => b.scheduledForISO.localeCompare(a.scheduledForISO));
}

export function readStoredTodayAlarmInstances(): TodayAlarmInstance[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TODAY_ALARM_INSTANCES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TodayAlarmInstance[];
    if (!Array.isArray(parsed)) return [];
    return normalizeItems(
      parsed.filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.alarmId === "string" &&
          typeof item.alarmLabel === "string" &&
          (item.alarmMode === "soft" || item.alarmMode === "hard") &&
          typeof item.scheduledDateKey === "string" &&
          typeof item.scheduledForISO === "string" &&
          item.source === "alarm" &&
          (item.status === "started" ||
            item.status === "snoozed" ||
            item.status === "missed" ||
            item.status === "completed"),
      ),
    );
  } catch {
    return [];
  }
}

export function writeStoredTodayAlarmInstances(items: TodayAlarmInstance[]) {
  if (typeof window === "undefined") return;
  try {
    const next = normalizeItems(items);
    window.localStorage.setItem(TODAY_ALARM_INSTANCES_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(TODAY_ALARM_INSTANCES_EVENT, { detail: next }));
  } catch {
    // Ignore storage failures in constrained environments.
  }
}

function upsertInstance(nextInstance: TodayAlarmInstance) {
  const items = readStoredTodayAlarmInstances();
  const updated = items.some((item) => item.id === nextInstance.id)
    ? items.map((item) => (item.id === nextInstance.id ? nextInstance : item))
    : [nextInstance, ...items];
  writeStoredTodayAlarmInstances(updated);
  return nextInstance;
}

export function startTodayAlarmInstanceFromLaunch(request: TodayLaunchRequest) {
  if (request.source !== "alarm" || !request.alarmId) return null;

  const nowISO = new Date().toISOString();
  const dateKey = dayKeyLocal(new Date());
  const matchingAlarm = readStoredTodayAlarms().find((alarm) => alarm.id === request.alarmId);
  const scheduledFor = matchingAlarm
    ? new Date(`${dateKey}T${matchingAlarm.timeOfDay}:00`)
    : new Date(nowISO);
  const existing = readStoredTodayAlarmInstances().find(
    (item) =>
      item.alarmId === request.alarmId &&
      item.scheduledDateKey === dateKey &&
      (item.status === "started" || item.status === "snoozed"),
  );

  const instance: TodayAlarmInstance = {
    id: existing?.id ?? request.id,
    alarmId: request.alarmId,
    alarmLabel: request.alarmLabel || request.linkedBlockTitle || "Whelm alarm",
    alarmMode: matchingAlarm?.mode === "hard" ? "hard" : "soft",
    scheduledDateKey: dateKey,
    scheduledForISO: Number.isNaN(scheduledFor.getTime()) ? nowISO : scheduledFor.toISOString(),
    linkedBlockId: request.linkedBlockId,
    linkedBlockTitle: request.linkedBlockTitle,
    linkedBlockDateKey: request.linkedBlockDateKey,
    linkedBlockDurationMinutes: request.linkedBlockDurationMinutes,
    source: "alarm",
    status: "started",
    createdAtISO: existing?.createdAtISO ?? nowISO,
    startedAtISO: nowISO,
    snoozeCount: existing?.snoozeCount ?? 0,
  };

  return upsertInstance(instance);
}

export function resolveTodayAlarmMode(instances: TodayAlarmInstance[], alarms: TodayAlarm[]) {
  const alarmModeById = new Map(alarms.map((alarm) => [alarm.id, alarm.mode === "hard" ? "hard" : "soft"] as const));
  let changed = false;
  const next = instances.map((instance) => {
    const nextMode = alarmModeById.get(instance.alarmId);
    if (!nextMode || nextMode === instance.alarmMode) return instance;
    changed = true;
    return { ...instance, alarmMode: nextMode };
  });
  if (changed) {
    writeStoredTodayAlarmInstances(next);
    return next;
  }
  return instances;
}

export function completeTodayAlarmInstance(instanceId: string) {
  const items = readStoredTodayAlarmInstances();
  const completedAtISO = new Date().toISOString();
  const updated = items.map((item) => {
    if (item.id !== instanceId) return item;

    const baseline = item.startedAtISO || completedAtISO;
    const startedAt = new Date(baseline).getTime();
    const scheduledAt = new Date(item.scheduledForISO).getTime();
    const outcome: TodayAlarmInstanceOutcome =
      (item.snoozeCount ?? 0) > 0
        ? "snoozed"
        : Number.isNaN(startedAt) || Number.isNaN(scheduledAt)
          ? "late"
          : startedAt <= scheduledAt + ON_TIME_WINDOW_MINUTES * 60 * 1000
            ? "on_time"
            : "late";

    return {
      ...item,
      status: "completed" as const,
      completedAtISO,
      snoozedUntilISO: undefined,
      outcome,
    };
  });
  writeStoredTodayAlarmInstances(updated);
}

export function snoozeTodayAlarmInstance(instanceId: string, minutes = DEFAULT_SNOOZE_MINUTES) {
  const items = readStoredTodayAlarmInstances();
  const snoozedUntilISO = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  const updated = items.map((item) =>
    item.id === instanceId
      ? {
          ...item,
          status: "snoozed" as const,
          snoozedUntilISO,
          snoozeCount: (item.snoozeCount ?? 0) + 1,
        }
      : item,
  );
  writeStoredTodayAlarmInstances(updated);
}

export function clearTodayAlarmInstance(instanceId: string) {
  const items = readStoredTodayAlarmInstances();
  writeStoredTodayAlarmInstances(items.filter((item) => item.id !== instanceId));
}

export function markTodayAlarmInstanceEffectApplied(instanceId: string) {
  const items = readStoredTodayAlarmInstances();
  const effectAppliedAtISO = new Date().toISOString();
  const updated = items.map((item) =>
    item.id === instanceId ? { ...item, effectAppliedAtISO } : item,
  );
  writeStoredTodayAlarmInstances(updated);
}

export function getActiveTodayAlarmInstance(items = readStoredTodayAlarmInstances()) {
  const now = Date.now();
  return (
    items.find((item) => item.status === "started") ??
    items.find(
      (item) =>
        item.status === "snoozed" &&
        item.snoozedUntilISO &&
        new Date(item.snoozedUntilISO).getTime() > now,
    ) ??
    null
  );
}

export function getLatestMissedTodayAlarmInstance(items = readStoredTodayAlarmInstances()) {
  return items.find((item) => item.status === "missed") ?? null;
}

export function sweepMissedTodayAlarmInstances(alarms: TodayAlarm[], now = new Date()) {
  const items = readStoredTodayAlarmInstances();
  const todayKey = dayKeyLocal(now);
  const next = [...items];
  let changed = false;

  alarms
    .filter((alarm) => alarm.enabled)
    .forEach((alarm) => {
      const scheduledFor = new Date(`${todayKey}T${alarm.timeOfDay}:00`);
      if (Number.isNaN(scheduledFor.getTime())) return;
      if (scheduledFor.getTime() + MISSED_GRACE_MINUTES * 60 * 1000 > now.getTime()) return;

      const existing = next.find(
        (item) => item.alarmId === alarm.id && item.scheduledDateKey === todayKey,
      );
      if (existing) {
        if (
          existing.status === "snoozed" &&
          existing.snoozedUntilISO &&
          new Date(existing.snoozedUntilISO).getTime() <= now.getTime()
        ) {
          existing.status = "missed";
          existing.missedAtISO = now.toISOString();
          existing.outcome = "missed";
          changed = true;
        }
        return;
      }

      next.unshift({
        id:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `alarm-missed-${alarm.id}-${todayKey}`,
        alarmId: alarm.id,
        alarmLabel: alarm.label || alarm.linkedBlockTitle || "Whelm alarm",
        alarmMode: alarm.mode === "hard" ? "hard" : "soft",
        scheduledDateKey: todayKey,
        scheduledForISO: scheduledFor.toISOString(),
        linkedBlockId: alarm.linkedBlockId,
        linkedBlockTitle: alarm.linkedBlockTitle,
        linkedBlockDateKey: alarm.linkedDateKey,
        linkedBlockDurationMinutes: alarm.linkedBlockDurationMinutes,
        source: "alarm",
        status: "missed",
        createdAtISO: now.toISOString(),
        missedAtISO: now.toISOString(),
        outcome: "missed",
        snoozeCount: 0,
      });
      changed = true;
    });

  if (changed) {
    writeStoredTodayAlarmInstances(next);
    return next;
  }

  return items;
}
