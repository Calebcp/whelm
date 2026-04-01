"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

import type { PerformanceNotificationPlan } from "@/lib/performance-notifications";
import type { PreferencesNotificationSettings } from "@/lib/preferences-store";

type NotificationPermissionState = "unsupported" | "default" | "granted" | "denied";
type NotificationDeliveryMode = "native" | "web" | "unsupported";

type NoteReminderLike = {
  id: string;
  title: string;
  reminderAtISO?: string | null;
};

type ScheduledNotificationPayload = {
  id: number;
  title: string;
  body: string;
  at: Date;
};

type UseWhelmNotificationsOptions = {
  user: User | null;
  notificationSettings?: PreferencesNotificationSettings | null;
  analyticsNotificationPlan: PerformanceNotificationPlan | null;
  notes: NoteReminderLike[];
  showToast?: (message: string, tone?: "success" | "warning" | "error" | "info") => void;
};

type StoredScheduleState = {
  signature: string;
  ids: number[];
};

const STORE_PREFIX = "whelm:notification-schedule:";
const MAX_NOTE_REMINDERS = 12;
const MAX_NOTIFICATION_WINDOW_DAYS = 7;
const DEFAULT_NOTIFICATION_SETTINGS: PreferencesNotificationSettings = {
  enabled: false,
  performanceNudges: true,
  noteReminders: true,
};

function getDeliveryMode(): NotificationDeliveryMode {
  const platform = Capacitor.getPlatform();
  if (platform === "ios" || platform === "android") return "native";
  if (typeof window !== "undefined" && "Notification" in window) return "web";
  return "unsupported";
}

function storageKey(uid: string) {
  return `${STORE_PREFIX}${uid}`;
}

function hashNotificationId(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) % 2147480000;
}

function readStoredSchedule(uid: string): StoredScheduleState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredScheduleState> | null;
    if (!parsed || typeof parsed.signature !== "string" || !Array.isArray(parsed.ids)) return null;
    return {
      signature: parsed.signature,
      ids: parsed.ids.filter((value) => Number.isInteger(value)),
    };
  } catch {
    return null;
  }
}

function writeStoredSchedule(uid: string, payload: StoredScheduleState | null) {
  if (typeof window === "undefined") return;
  try {
    if (!payload) {
      window.localStorage.removeItem(storageKey(uid));
      return;
    }
    window.localStorage.setItem(storageKey(uid), JSON.stringify(payload));
  } catch {
    // Ignore storage failures in constrained environments.
  }
}

function localDateAtTime(base: Date, timeLabel: string) {
  const [hourRaw, minuteRaw] = timeLabel.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    Number.isFinite(hour) ? hour : 9,
    Number.isFinite(minute) ? minute : 0,
    0,
    0,
  );
}

function stripHtml(input: string) {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPerformancePayloads(plan: PerformanceNotificationPlan | null, now: Date) {
  if (!plan) return [] as ScheduledNotificationPayload[];

  return plan.notifications.map((notification) => {
    let at = localDateAtTime(now, notification.deliverAtLocalTime);
    if (at.getTime() <= now.getTime()) {
      at = localDateAtTime(new Date(now.getTime() + 24 * 60 * 60 * 1000), notification.deliverAtLocalTime);
    }

    return {
      id: hashNotificationId(`performance:${notification.kind}:${at.toISOString()}`),
      title: notification.title,
      body: notification.body,
      at,
    };
  });
}

function buildReminderPayloads(notes: NoteReminderLike[], now: Date) {
  const maxTime = now.getTime() + MAX_NOTIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return notes
    .filter((note) => typeof note.reminderAtISO === "string" && note.reminderAtISO)
    .map((note) => {
      const at = new Date(note.reminderAtISO as string);
      if (Number.isNaN(at.getTime())) return null;
      if (at.getTime() <= now.getTime()) return null;
      if (at.getTime() > maxTime) return null;
      const cleanTitle = stripHtml(note.title || "").slice(0, 96) || "Untitled note";
      return {
        id: hashNotificationId(`note:${note.id}:${at.toISOString()}`),
        title: "Whelm note ready.",
        body: cleanTitle,
        at,
      } satisfies ScheduledNotificationPayload;
    })
    .filter((value): value is ScheduledNotificationPayload => Boolean(value))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_NOTE_REMINDERS);
}

async function getNativePermissionState(): Promise<NotificationPermissionState> {
  try {
    const permissions = await LocalNotifications.checkPermissions();
    const state = permissions.display;
    if (state === "granted" || state === "denied" || state === "prompt") {
      return state === "prompt" ? "default" : state;
    }
    return "default";
  } catch {
    return "unsupported";
  }
}

function getWebPermissionState(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "default";
}

export function useWhelmNotifications({
  user,
  notificationSettings,
  analyticsNotificationPlan,
  notes,
  showToast,
}: UseWhelmNotificationsOptions) {
  const normalizedSettings = useMemo<PreferencesNotificationSettings>(
    () => ({
      enabled:
        typeof notificationSettings?.enabled === "boolean"
          ? notificationSettings.enabled
          : DEFAULT_NOTIFICATION_SETTINGS.enabled,
      performanceNudges:
        typeof notificationSettings?.performanceNudges === "boolean"
          ? notificationSettings.performanceNudges
          : DEFAULT_NOTIFICATION_SETTINGS.performanceNudges,
      noteReminders:
        typeof notificationSettings?.noteReminders === "boolean"
          ? notificationSettings.noteReminders
          : DEFAULT_NOTIFICATION_SETTINGS.noteReminders,
    }),
    [notificationSettings],
  );

  const deliveryMode = useMemo(getDeliveryMode, []);
  const [permissionState, setPermissionState] = useState<NotificationPermissionState>("default");
  const [notificationStatus, setNotificationStatus] = useState("");
  const [notificationBusy, setNotificationBusy] = useState(false);
  const webTimeoutsRef = useRef<number[]>([]);
  const previousUidRef = useRef<string | null>(null);

  const clearWebTimeouts = useCallback(() => {
    webTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    webTimeoutsRef.current = [];
  }, []);

  const clearScheduledNotifications = useCallback(async () => {
    clearWebTimeouts();

    if (!user) return;
    const stored = readStoredSchedule(user.uid);
    if (!stored?.ids.length) {
      writeStoredSchedule(user.uid, null);
      return;
    }

    if (deliveryMode === "native") {
      try {
        await LocalNotifications.cancel({
          notifications: stored.ids.map((id) => ({ id })),
        });
      } catch {
        // Ignore cancellation failures; a later schedule pass can overwrite.
      }
    }

    writeStoredSchedule(user.uid, null);
  }, [clearWebTimeouts, deliveryMode, user]);

  const refreshPermissionState = useCallback(async () => {
    if (deliveryMode === "native") {
      setPermissionState(await getNativePermissionState());
      return;
    }

    setPermissionState(getWebPermissionState());
  }, [deliveryMode]);

  const requestNotificationPermission = useCallback(async () => {
    if (deliveryMode === "unsupported") {
      setNotificationStatus("This build does not support Whelm notifications.");
      return false;
    }

    setNotificationBusy(true);
    try {
      if (deliveryMode === "native") {
        const result = await LocalNotifications.requestPermissions();
        const nextState =
          result.display === "granted"
            ? "granted"
            : result.display === "denied"
              ? "denied"
              : "default";
        setPermissionState(nextState);
        setNotificationStatus(
          nextState === "granted"
            ? "Whelm notifications are enabled on this device."
            : "Notification permission is still blocked.",
        );
        return nextState === "granted";
      }

      if (!("Notification" in window)) {
        setPermissionState("unsupported");
        setNotificationStatus("This browser does not support notifications.");
        return false;
      }

      const result = await Notification.requestPermission();
      const nextState = result === "granted" ? "granted" : result === "denied" ? "denied" : "default";
      setPermissionState(nextState);
      setNotificationStatus(
        nextState === "granted"
          ? "Whelm notifications are enabled in this browser."
          : "Notification permission is still blocked.",
      );
      return nextState === "granted";
    } finally {
      setNotificationBusy(false);
    }
  }, [deliveryMode]);

  const scheduledPayloads = useMemo(() => {
    const now = new Date();
    const payloads: ScheduledNotificationPayload[] = [];

    if (normalizedSettings.enabled && normalizedSettings.performanceNudges) {
      payloads.push(...buildPerformancePayloads(analyticsNotificationPlan, now));
    }

    if (normalizedSettings.enabled && normalizedSettings.noteReminders) {
      payloads.push(...buildReminderPayloads(notes, now));
    }

    return payloads.sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [
    analyticsNotificationPlan,
    normalizedSettings.enabled,
    normalizedSettings.noteReminders,
    normalizedSettings.performanceNudges,
    notes,
  ]);

  const scheduleNotifications = useCallback(async (force = false) => {
    if (!user) return;
    if (!normalizedSettings.enabled) {
      await clearScheduledNotifications();
      setNotificationStatus("Whelm notifications are off.");
      return;
    }

    if (permissionState !== "granted") {
      await clearScheduledNotifications();
      setNotificationStatus("Enable notification permission to let Whelm reach you.");
      return;
    }

    const signature = JSON.stringify(
      scheduledPayloads.map((payload) => ({
        id: payload.id,
        at: payload.at.toISOString(),
        title: payload.title,
        body: payload.body,
      })),
    );
    const stored = readStoredSchedule(user.uid);
    if (!force && stored?.signature === signature) {
      return;
    }

    await clearScheduledNotifications();

    if (!scheduledPayloads.length) {
      setNotificationStatus("No Whelm notifications are queued right now.");
      return;
    }

    if (deliveryMode === "native") {
      await LocalNotifications.schedule({
        notifications: scheduledPayloads.map((payload) => ({
          id: payload.id,
          title: payload.title,
          body: payload.body,
          schedule: { at: payload.at, allowWhileIdle: true },
        })),
      });
    } else if (deliveryMode === "web" && typeof window !== "undefined") {
      const now = Date.now();
      webTimeoutsRef.current = scheduledPayloads
        .filter((payload) => payload.at.getTime() > now)
        .map((payload) =>
          window.setTimeout(() => {
            if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
            void new Notification(payload.title, {
              body: payload.body,
              tag: `whelm-${payload.id}`,
            });
          }, Math.max(0, payload.at.getTime() - now)),
        );
    }

    writeStoredSchedule(user.uid, {
      signature,
      ids: scheduledPayloads.map((payload) => payload.id),
    });
    setNotificationStatus(
      `${scheduledPayloads.length} Whelm notification${scheduledPayloads.length === 1 ? "" : "s"} queued.`,
    );
  }, [
    clearScheduledNotifications,
    deliveryMode,
    normalizedSettings.enabled,
    permissionState,
    scheduledPayloads,
    user,
  ]);

  const resyncNotifications = useCallback(async () => {
    setNotificationBusy(true);
    try {
      await refreshPermissionState();
      await scheduleNotifications(true);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Whelm could not update notification delivery.";
      setNotificationStatus(message);
      showToast?.(message, "error");
    } finally {
      setNotificationBusy(false);
    }
  }, [refreshPermissionState, scheduleNotifications, showToast]);

  useEffect(() => {
    void refreshPermissionState();
  }, [refreshPermissionState]);

  useEffect(() => {
    void scheduleNotifications();
  }, [scheduleNotifications]);

  useEffect(() => {
    const previousUid = previousUidRef.current;
    previousUidRef.current = user?.uid ?? null;

    if (user || !previousUid) return;

    clearWebTimeouts();
    const stored = readStoredSchedule(previousUid);
    if (!stored?.ids.length) {
      writeStoredSchedule(previousUid, null);
      return;
    }

    if (deliveryMode === "native") {
      void LocalNotifications.cancel({
        notifications: stored.ids.map((id) => ({ id })),
      }).catch(() => {
        // Ignore cleanup failures during sign-out.
      });
    }

    writeStoredSchedule(previousUid, null);
  }, [clearWebTimeouts, deliveryMode, user]);

  useEffect(() => () => {
    clearWebTimeouts();
  }, [clearWebTimeouts]);

  return {
    deliveryMode,
    permissionState,
    notificationStatus,
    notificationBusy,
    scheduledNotificationCount: scheduledPayloads.length,
    requestNotificationPermission,
    resyncNotifications,
  };
}
