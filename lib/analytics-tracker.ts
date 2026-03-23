"use client";

import { Capacitor } from "@capacitor/core";
import type { User } from "firebase/auth";

import { resolveApiUrl } from "@/lib/api-base";
import {
  normalizeAnalyticsEvent,
  validateAnalyticsEventInput,
  type AnalyticsClientPlatform,
  type AnalyticsEventInput,
  type AppOpenedEventInput,
  type SessionAbandonedEventInput,
  type SessionCompletedEventInput,
  type SessionStartedEventInput,
  type LeaderboardAroundMeLoadedEventInput,
  type LeaderboardPageLoadedEventInput,
  type LeaderboardTabSwitchedEventInput,
  type LeaderboardViewedEventInput,
  type StreakUpdatedEventInput,
  type TaskCompletedEventInput,
  type TaskCreatedEventInput,
} from "@/lib/analytics-events";

const ANALYTICS_FAILURE_COOLDOWN_MS = 5 * 60 * 1000;

let analyticsDisabledUntil = 0;

function detectClientPlatform(): AnalyticsClientPlatform {
  const platform = Capacitor.getPlatform();
  if (platform === "ios" || platform === "android") return platform;
  if (platform === "web") return "web";
  return "desktop";
}

function analyticsTemporarilyDisabled() {
  return Date.now() < analyticsDisabledUntil;
}

function markAnalyticsFailure(errorMessage: string) {
  if (
    errorMessage.includes("Missing or insufficient permissions") ||
    errorMessage.includes("permission") ||
    errorMessage.includes("analyticsEvents write failed")
  ) {
    analyticsDisabledUntil = Date.now() + ANALYTICS_FAILURE_COOLDOWN_MS;
  }
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
  if (analyticsTemporarilyDisabled()) {
    return null;
  }

  const validated = validateAnalyticsEventInput(buildEventInput(input));
  const token = await user.getIdToken();

  const response = await fetch(resolveApiUrl("/api/analytics/events"), {
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
    const message = body?.error || "Failed to track analytics event.";
    markAnalyticsFailure(message);
    throw new Error(message);
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

export async function trackLeaderboardViewed(
  user: User,
  input: Omit<LeaderboardViewedEventInput, "eventName">,
) {
  return trackAnalyticsEvent(user, {
    eventName: "leaderboard_viewed",
    ...input,
  });
}

export async function trackLeaderboardTabSwitched(
  user: User,
  input: Omit<LeaderboardTabSwitchedEventInput, "eventName">,
) {
  return trackAnalyticsEvent(user, {
    eventName: "leaderboard_tab_switched",
    ...input,
  });
}

export async function trackLeaderboardPageLoaded(
  user: User,
  input: Omit<LeaderboardPageLoadedEventInput, "eventName">,
) {
  return trackAnalyticsEvent(user, {
    eventName: "leaderboard_page_loaded",
    ...input,
  });
}

export async function trackLeaderboardAroundMeLoaded(
  user: User,
  input: Omit<LeaderboardAroundMeLoadedEventInput, "eventName">,
) {
  return trackAnalyticsEvent(user, {
    eventName: "leaderboard_around_me_loaded",
    ...input,
  });
}
