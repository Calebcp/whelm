"use client";

import { Capacitor } from "@capacitor/core";
import type { User } from "firebase/auth";

import {
  normalizeAnalyticsEvent,
  validateAnalyticsEventInput,
  type AnalyticsClientPlatform,
  type AnalyticsEventInput,
  type AppOpenedEventInput,
  type SessionAbandonedEventInput,
  type SessionCompletedEventInput,
  type SessionStartedEventInput,
  type StreakUpdatedEventInput,
  type TaskCompletedEventInput,
  type TaskCreatedEventInput,
} from "@/lib/analytics-events";

function detectClientPlatform(): AnalyticsClientPlatform {
  const platform = Capacitor.getPlatform();
  if (platform === "ios" || platform === "android") return platform;
  if (platform === "web") return "web";
  return "desktop";
}

function buildEventInput<T extends AnalyticsEventInput>(input: T): T {
  return {
    ...input,
    clientPlatform: input.clientPlatform ?? detectClientPlatform(),
    clientTimezone: input.clientTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };
}

async function authorizedTrack(user: User, input: AnalyticsEventInput) {
  const validated = validateAnalyticsEventInput(buildEventInput(input));
  const token = await user.getIdToken();

  const response = await fetch("/api/analytics/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: user.uid,
      event: validated,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error || "Failed to track analytics event.");
  }

  return normalizeAnalyticsEvent(user.uid, validated);
}

export async function trackAnalyticsEvent(user: User, input: AnalyticsEventInput) {
  return authorizedTrack(user, input);
}

export async function trackAppOpened(user: User, input: Omit<AppOpenedEventInput, "eventName">) {
  return trackAnalyticsEvent(user, {
    eventName: "app_opened",
    ...input,
  });
}

export async function trackSessionStarted(
  user: User,
  input: Omit<SessionStartedEventInput, "eventName">,
) {
  return trackAnalyticsEvent(user, {
    eventName: "session_started",
    ...input,
  });
}

export async function trackSessionCompleted(
  user: User,
  input: Omit<SessionCompletedEventInput, "eventName">,
) {
  return trackAnalyticsEvent(user, {
    eventName: "session_completed",
    ...input,
  });
}

export async function trackSessionAbandoned(
  user: User,
  input: Omit<SessionAbandonedEventInput, "eventName">,
) {
  return trackAnalyticsEvent(user, {
    eventName: "session_abandoned",
    ...input,
  });
}

export async function trackTaskCreated(
  user: User,
  input: Omit<TaskCreatedEventInput, "eventName">,
) {
  return trackAnalyticsEvent(user, {
    eventName: "task_created",
    ...input,
  });
}

export async function trackTaskCompleted(
  user: User,
  input: Omit<TaskCompletedEventInput, "eventName">,
) {
  return trackAnalyticsEvent(user, {
    eventName: "task_completed",
    ...input,
  });
}

export async function trackStreakUpdated(
  user: User,
  input: Omit<StreakUpdatedEventInput, "eventName">,
) {
  return trackAnalyticsEvent(user, {
    eventName: "streak_updated",
    ...input,
  });
}
