export const ANALYTICS_EVENT_NAMES = [
  "app_opened",
  "session_started",
  "session_completed",
  "session_abandoned",
  "task_created",
  "task_completed",
  "streak_updated",
  "leaderboard_viewed",
  "leaderboard_tab_switched",
  "leaderboard_page_loaded",
  "leaderboard_around_me_loaded",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const CLIENT_PLATFORMS = ["ios", "android", "web", "desktop"] as const;
export type AnalyticsClientPlatform = (typeof CLIENT_PLATFORMS)[number];

export const SUBJECT_MODES = ["language", "school", "work", "general"] as const;
export type AnalyticsSubjectMode = (typeof SUBJECT_MODES)[number];

export const SESSION_TYPES = ["focus", "stopwatch"] as const;
export type AnalyticsSessionType = (typeof SESSION_TYPES)[number];

type BaseEventInput = {
  eventId?: string;
  occurredAt?: string;
  clientTimezone?: string;
  clientPlatform?: AnalyticsClientPlatform;
  deviceId?: string | null;
};

export type AppOpenedEventInput = BaseEventInput & {
  eventName: "app_opened";
  screenName: string;
  launchSource?: "cold_start" | "resume" | "deeplink";
};

export type SessionStartedEventInput = BaseEventInput & {
  eventName: "session_started";
  sessionId: string;
  sessionType: AnalyticsSessionType;
  subjectMode: AnalyticsSubjectMode;
  targetMinutes?: number | null;
};

export type SessionCompletedEventInput = BaseEventInput & {
  eventName: "session_completed";
  sessionId: string;
  sessionType: AnalyticsSessionType;
  subjectMode: AnalyticsSubjectMode;
  durationMinutes: number;
  plannedDurationMinutes?: number | null;
  completionStatus?: "completed";
  earlyExit?: boolean;
  interruptionCount?: number | null;
  tasksCompletedCount?: number | null;
  qualityScore?: number | null;
  qualityRating?: "excellent" | "good" | "fair" | "weak" | null;
  noteAttached?: boolean;
  completedFromTaskId?: string | null;
};

export type SessionAbandonedEventInput = BaseEventInput & {
  eventName: "session_abandoned";
  sessionId: string;
  sessionType: AnalyticsSessionType;
  subjectMode: AnalyticsSubjectMode;
  elapsedMinutes: number;
  abandonReason?: "reset" | "route_change" | "component_unmount" | "unknown";
  plannedDurationMinutes?: number | null;
  interruptionCount?: number | null;
  qualityScore?: number | null;
  qualityRating?: "excellent" | "good" | "fair" | "weak" | null;
};

export type TaskCreatedEventInput = BaseEventInput & {
  eventName: "task_created";
  taskId: string;
  scheduledDate: string;
  durationMinutes: number;
  subjectMode: AnalyticsSubjectMode;
  source?: "manual" | "daily_ritual" | "note_convert";
};

export type TaskCompletedEventInput = BaseEventInput & {
  eventName: "task_completed";
  taskId: string;
  scheduledDate: string;
  durationMinutes: number;
  subjectMode: AnalyticsSubjectMode;
  linkedSessionId?: string | null;
};

export type StreakUpdatedEventInput = BaseEventInput & {
  eventName: "streak_updated";
  streakDate: string;
  previousLength: number;
  newLength: number;
  updateSource: "session_completed" | "task_completed" | "sick_day_save";
  linkedSessionId?: string | null;
};

export type LeaderboardViewedEventInput = BaseEventInput & {
  eventName: "leaderboard_viewed";
  metric: "xp" | "streak";
  snapshotDate?: string | null;
};

export type LeaderboardTabSwitchedEventInput = BaseEventInput & {
  eventName: "leaderboard_tab_switched";
  fromMetric: "xp" | "streak";
  toMetric: "xp" | "streak";
};

export type LeaderboardPageLoadedEventInput = BaseEventInput & {
  eventName: "leaderboard_page_loaded";
  metric: "xp" | "streak";
  pageSize: number;
  cursor?: string | null;
  snapshotDate?: string | null;
};

export type LeaderboardAroundMeLoadedEventInput = BaseEventInput & {
  eventName: "leaderboard_around_me_loaded";
  metric: "xp" | "streak";
  anchorRank: number;
  resultCount: number;
  snapshotDate?: string | null;
};

export type AnalyticsEventInput =
  | AppOpenedEventInput
  | SessionStartedEventInput
  | SessionCompletedEventInput
  | SessionAbandonedEventInput
  | TaskCreatedEventInput
  | TaskCompletedEventInput
  | StreakUpdatedEventInput
  | LeaderboardViewedEventInput
  | LeaderboardTabSwitchedEventInput
  | LeaderboardPageLoadedEventInput
  | LeaderboardAroundMeLoadedEventInput;

type AnalyticsProperties = Record<string, string | number | boolean | null>;

export type AnalyticsEventRecord = {
  eventId: string;
  eventName: AnalyticsEventName;
  userId: string;
  occurredAt: string;
  occurredDateLocal: string;
  clientTimezone: string;
  clientPlatform: AnalyticsClientPlatform;
  deviceId: string | null;
  sessionId: string | null;
  taskId: string | null;
  subjectMode: AnalyticsSubjectMode | null;
  payloadVersion: number;
  properties: AnalyticsProperties;
};

export type TrackAnalyticsRequest = {
  userId: string;
  event: AnalyticsEventRecord;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Analytics event field "${field}" must be a non-empty string.`);
  }

  return value.trim();
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("Optional analytics field must be a string.");
  return value;
}

function requireFiniteNumber(value: unknown, field: string, min = 0) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min) {
    throw new Error(`Analytics event field "${field}" must be a finite number >= ${min}.`);
  }

  return value;
}

function optionalFiniteNumber(value: unknown, field: string, min = 0) {
  if (value === undefined || value === null) return null;
  return requireFiniteNumber(value, field, min);
}

function optionalBoolean(value: unknown, field: string) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "boolean") {
    throw new Error(`Analytics event field "${field}" must be a boolean.`);
  }
  return value;
}

function optionalEnumValue<const T extends readonly string[]>(
  values: T,
  value: unknown,
  field: string,
) {
  if (value === undefined || value === null) return undefined;
  return requireEnumValue(values, value, field);
}

function requireEnumValue<const T extends readonly string[]>(
  values: T,
  value: unknown,
  field: string,
): T[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new Error(`Analytics event field "${field}" must be one of: ${values.join(", ")}.`);
  }

  return value as T[number];
}

function requireIsoDateTime(value: unknown, field: string) {
  const normalized = requireNonEmptyString(value, field);
  if (Number.isNaN(new Date(normalized).getTime())) {
    throw new Error(`Analytics event field "${field}" must be a valid ISO datetime string.`);
  }
  return normalized;
}

function requireLocalDate(value: unknown, field: string) {
  const normalized = requireNonEmptyString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`Analytics event field "${field}" must use YYYY-MM-DD format.`);
  }
  return normalized;
}

function buildOccurredDateLocal(occurredAt: string, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date(occurredAt));
}

export function createEventId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function validateAnalyticsEventInput(input: unknown): AnalyticsEventInput {
  if (!isRecord(input)) {
    throw new Error("Analytics input must be an object.");
  }

  const eventName = requireEnumValue(ANALYTICS_EVENT_NAMES, input.eventName, "eventName");
  const clientPlatform =
    input.clientPlatform === undefined
      ? "web"
      : requireEnumValue(CLIENT_PLATFORMS, input.clientPlatform, "clientPlatform");

  const base = {
    eventId: input.eventId === undefined ? undefined : requireNonEmptyString(input.eventId, "eventId"),
    occurredAt:
      input.occurredAt === undefined ? undefined : requireIsoDateTime(input.occurredAt, "occurredAt"),
    clientTimezone:
      input.clientTimezone === undefined
        ? undefined
        : requireNonEmptyString(input.clientTimezone, "clientTimezone"),
    clientPlatform,
    deviceId: optionalString(input.deviceId),
  } as BaseEventInput;

  switch (eventName) {
    case "app_opened":
      return {
        ...base,
        eventName,
        screenName: requireNonEmptyString(input.screenName, "screenName"),
        launchSource:
          input.launchSource === undefined
            ? undefined
            : requireEnumValue(["cold_start", "resume", "deeplink"] as const, input.launchSource, "launchSource"),
      };
    case "session_started":
      return {
        ...base,
        eventName,
        sessionId: requireNonEmptyString(input.sessionId, "sessionId"),
        sessionType: requireEnumValue(SESSION_TYPES, input.sessionType, "sessionType"),
        subjectMode: requireEnumValue(SUBJECT_MODES, input.subjectMode, "subjectMode"),
        targetMinutes: optionalFiniteNumber(input.targetMinutes, "targetMinutes", 1),
      };
    case "session_completed":
      return {
        ...base,
        eventName,
        sessionId: requireNonEmptyString(input.sessionId, "sessionId"),
        sessionType: requireEnumValue(SESSION_TYPES, input.sessionType, "sessionType"),
        subjectMode: requireEnumValue(SUBJECT_MODES, input.subjectMode, "subjectMode"),
        durationMinutes: requireFiniteNumber(input.durationMinutes, "durationMinutes", 1),
        plannedDurationMinutes: optionalFiniteNumber(input.plannedDurationMinutes, "plannedDurationMinutes", 1),
        completionStatus: optionalEnumValue(["completed"] as const, input.completionStatus, "completionStatus"),
        earlyExit:
          input.earlyExit === undefined
            ? undefined
            : optionalBoolean(input.earlyExit, "earlyExit") ?? undefined,
        interruptionCount: optionalFiniteNumber(input.interruptionCount, "interruptionCount", 0),
        tasksCompletedCount: optionalFiniteNumber(input.tasksCompletedCount, "tasksCompletedCount", 0),
        qualityScore: optionalFiniteNumber(input.qualityScore, "qualityScore", 0),
        qualityRating: optionalEnumValue(
          ["excellent", "good", "fair", "weak"] as const,
          input.qualityRating,
          "qualityRating",
        ),
        noteAttached:
          input.noteAttached === undefined
            ? undefined
            : optionalBoolean(input.noteAttached, "noteAttached") ?? undefined,
        completedFromTaskId: optionalString(input.completedFromTaskId),
      };
    case "session_abandoned":
      return {
        ...base,
        eventName,
        sessionId: requireNonEmptyString(input.sessionId, "sessionId"),
        sessionType: requireEnumValue(SESSION_TYPES, input.sessionType, "sessionType"),
        subjectMode: requireEnumValue(SUBJECT_MODES, input.subjectMode, "subjectMode"),
        elapsedMinutes: requireFiniteNumber(input.elapsedMinutes, "elapsedMinutes", 0),
        abandonReason:
          input.abandonReason === undefined
            ? undefined
            : requireEnumValue(
                ["reset", "route_change", "component_unmount", "unknown"] as const,
                input.abandonReason,
                "abandonReason",
              ),
        plannedDurationMinutes: optionalFiniteNumber(input.plannedDurationMinutes, "plannedDurationMinutes", 1),
        interruptionCount: optionalFiniteNumber(input.interruptionCount, "interruptionCount", 0),
        qualityScore: optionalFiniteNumber(input.qualityScore, "qualityScore", 0),
        qualityRating: optionalEnumValue(
          ["excellent", "good", "fair", "weak"] as const,
          input.qualityRating,
          "qualityRating",
        ),
      };
    case "task_created":
      return {
        ...base,
        eventName,
        taskId: requireNonEmptyString(input.taskId, "taskId"),
        scheduledDate: requireLocalDate(input.scheduledDate, "scheduledDate"),
        durationMinutes: requireFiniteNumber(input.durationMinutes, "durationMinutes", 1),
        subjectMode: requireEnumValue(SUBJECT_MODES, input.subjectMode, "subjectMode"),
        source:
          input.source === undefined
            ? undefined
            : requireEnumValue(["manual", "daily_ritual", "note_convert"] as const, input.source, "source"),
      };
    case "task_completed":
      return {
        ...base,
        eventName,
        taskId: requireNonEmptyString(input.taskId, "taskId"),
        scheduledDate: requireLocalDate(input.scheduledDate, "scheduledDate"),
        durationMinutes: requireFiniteNumber(input.durationMinutes, "durationMinutes", 1),
        subjectMode: requireEnumValue(SUBJECT_MODES, input.subjectMode, "subjectMode"),
        linkedSessionId: optionalString(input.linkedSessionId),
      };
    case "streak_updated":
      return {
        ...base,
        eventName,
        streakDate: requireLocalDate(input.streakDate, "streakDate"),
        previousLength: requireFiniteNumber(input.previousLength, "previousLength", 0),
        newLength: requireFiniteNumber(input.newLength, "newLength", 0),
        updateSource: requireEnumValue(
          ["session_completed", "task_completed", "sick_day_save"] as const,
          input.updateSource,
          "updateSource",
        ),
        linkedSessionId: optionalString(input.linkedSessionId),
      };
    case "leaderboard_viewed":
      return {
        ...base,
        eventName,
        metric: requireEnumValue(["xp", "streak"] as const, input.metric, "metric"),
        snapshotDate: optionalString(input.snapshotDate),
      };
    case "leaderboard_tab_switched":
      return {
        ...base,
        eventName,
        fromMetric: requireEnumValue(["xp", "streak"] as const, input.fromMetric, "fromMetric"),
        toMetric: requireEnumValue(["xp", "streak"] as const, input.toMetric, "toMetric"),
      };
    case "leaderboard_page_loaded":
      return {
        ...base,
        eventName,
        metric: requireEnumValue(["xp", "streak"] as const, input.metric, "metric"),
        pageSize: requireFiniteNumber(input.pageSize, "pageSize", 1),
        cursor: optionalString(input.cursor),
        snapshotDate: optionalString(input.snapshotDate),
      };
    case "leaderboard_around_me_loaded":
      return {
        ...base,
        eventName,
        metric: requireEnumValue(["xp", "streak"] as const, input.metric, "metric"),
        anchorRank: requireFiniteNumber(input.anchorRank, "anchorRank", 1),
        resultCount: requireFiniteNumber(input.resultCount, "resultCount", 0),
        snapshotDate: optionalString(input.snapshotDate),
      };
  }
}

export function normalizeAnalyticsEvent(userId: string, input: AnalyticsEventInput): AnalyticsEventRecord {
  const nowIso = input.occurredAt ?? new Date().toISOString();
  const timezone = input.clientTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const eventId = input.eventId ?? createEventId();

  const baseRecord = {
    eventId,
    eventName: input.eventName,
    userId: requireNonEmptyString(userId, "userId"),
    occurredAt: requireIsoDateTime(nowIso, "occurredAt"),
    occurredDateLocal: buildOccurredDateLocal(nowIso, timezone),
    clientTimezone: timezone,
    clientPlatform: input.clientPlatform ?? "web",
    deviceId: input.deviceId ?? null,
    sessionId: null,
    taskId: null,
    subjectMode: null,
    payloadVersion: 1,
  } satisfies Omit<AnalyticsEventRecord, "properties">;

  switch (input.eventName) {
    case "app_opened":
      return {
        ...baseRecord,
        properties: {
          screenName: input.screenName,
          launchSource: input.launchSource ?? null,
        },
      };
    case "session_started":
      return {
        ...baseRecord,
        sessionId: input.sessionId,
        subjectMode: input.subjectMode,
        properties: {
          sessionType: input.sessionType,
          targetMinutes: input.targetMinutes ?? null,
        },
      };
    case "session_completed":
      return {
        ...baseRecord,
        sessionId: input.sessionId,
        taskId: input.completedFromTaskId ?? null,
        subjectMode: input.subjectMode,
        properties: {
          sessionType: input.sessionType,
          durationMinutes: input.durationMinutes,
          plannedDurationMinutes: input.plannedDurationMinutes ?? null,
          completionStatus: input.completionStatus ?? "completed",
          earlyExit: input.earlyExit ?? null,
          interruptionCount: input.interruptionCount ?? null,
          tasksCompletedCount: input.tasksCompletedCount ?? null,
          qualityScore: input.qualityScore ?? null,
          qualityRating: input.qualityRating ?? null,
          noteAttached: input.noteAttached ?? null,
          completedFromTaskId: input.completedFromTaskId ?? null,
        },
      };
    case "session_abandoned":
      return {
        ...baseRecord,
        sessionId: input.sessionId,
        subjectMode: input.subjectMode,
        properties: {
          sessionType: input.sessionType,
          elapsedMinutes: input.elapsedMinutes,
          abandonReason: input.abandonReason ?? "unknown",
          plannedDurationMinutes: input.plannedDurationMinutes ?? null,
          interruptionCount: input.interruptionCount ?? null,
          qualityScore: input.qualityScore ?? null,
          qualityRating: input.qualityRating ?? null,
        },
      };
    case "task_created":
      return {
        ...baseRecord,
        taskId: input.taskId,
        subjectMode: input.subjectMode,
        properties: {
          scheduledDate: input.scheduledDate,
          durationMinutes: input.durationMinutes,
          source: input.source ?? null,
        },
      };
    case "task_completed":
      return {
        ...baseRecord,
        sessionId: input.linkedSessionId ?? null,
        taskId: input.taskId,
        subjectMode: input.subjectMode,
        properties: {
          scheduledDate: input.scheduledDate,
          durationMinutes: input.durationMinutes,
          linkedSessionId: input.linkedSessionId ?? null,
        },
      };
    case "streak_updated":
      return {
        ...baseRecord,
        sessionId: input.linkedSessionId ?? null,
        properties: {
          streakDate: input.streakDate,
          previousLength: input.previousLength,
          newLength: input.newLength,
          updateSource: input.updateSource,
          linkedSessionId: input.linkedSessionId ?? null,
        },
      };
    case "leaderboard_viewed":
      return {
        ...baseRecord,
        properties: {
          metric: input.metric,
          snapshotDate: input.snapshotDate ?? null,
        },
      };
    case "leaderboard_tab_switched":
      return {
        ...baseRecord,
        properties: {
          fromMetric: input.fromMetric,
          toMetric: input.toMetric,
        },
      };
    case "leaderboard_page_loaded":
      return {
        ...baseRecord,
        properties: {
          metric: input.metric,
          pageSize: input.pageSize,
          cursor: input.cursor ?? null,
          snapshotDate: input.snapshotDate ?? null,
        },
      };
    case "leaderboard_around_me_loaded":
      return {
        ...baseRecord,
        properties: {
          metric: input.metric,
          anchorRank: input.anchorRank,
          resultCount: input.resultCount,
          snapshotDate: input.snapshotDate ?? null,
        },
      };
  }
}

export function parseTrackAnalyticsRequest(input: unknown): TrackAnalyticsRequest {
  if (!isRecord(input)) {
    throw new Error("Analytics request body must be an object.");
  }

  const userId = requireNonEmptyString(input.userId, "userId");
  const rawEvent = validateAnalyticsEventInput(input.event);
  return {
    userId,
    event: normalizeAnalyticsEvent(userId, rawEvent),
  };
}
