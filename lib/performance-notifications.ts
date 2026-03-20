import type { AnalyticsDailyMetricRecord } from "@/lib/analytics-aggregation";

export type PerformanceNotificationKind =
  | "morning_plan"
  | "midday_reset"
  | "evening_close";

export type PerformanceNotification = {
  kind: PerformanceNotificationKind;
  deliverAtLocalTime: string;
  title: string;
  body: string;
};

export type PerformanceNotificationPlan = {
  performanceBand: AnalyticsDailyMetricRecord["dailyPerformanceBand"];
  maxNotifications: number;
  notifications: PerformanceNotification[];
};

type AnalyticsSnapshot = Pick<
  AnalyticsDailyMetricRecord,
  | "dailyPerformanceScore"
  | "dailyPerformanceBand"
  | "sessionCompletionRate"
  | "sessionsAbandoned"
  | "taskCompletedCount"
  | "focusMinutes"
  | "averageSessionQualityScore"
>;

type NotificationStrategyConfig = {
  maxNotifications: number;
  defaultTimes: Record<PerformanceNotificationKind, string>;
};

const NOTIFICATION_STRATEGY: Record<
  AnalyticsDailyMetricRecord["dailyPerformanceBand"],
  NotificationStrategyConfig
> = {
  high: {
    maxNotifications: 1,
    defaultTimes: {
      morning_plan: "09:00",
      midday_reset: "13:00",
      evening_close: "20:30",
    },
  },
  steady: {
    maxNotifications: 2,
    defaultTimes: {
      morning_plan: "09:00",
      midday_reset: "13:00",
      evening_close: "20:30",
    },
  },
  recovery: {
    maxNotifications: 3,
    defaultTimes: {
      morning_plan: "09:00",
      midday_reset: "13:00",
      evening_close: "20:30",
    },
  },
};

function buildMorningBody(snapshot: AnalyticsSnapshot) {
  if (snapshot.sessionsAbandoned >= 2) {
    return "Start smaller today. Finish one clean session before you open a second one.";
  }

  if (snapshot.taskCompletedCount === 0) {
    return "Protect the first block and turn it into one finished task.";
  }

  if (snapshot.sessionCompletionRate < 50) {
    return "Finish the first planned session before you let the day branch out.";
  }

  return "Protect the first planned session early and let momentum do the rest.";
}

function buildMiddayBody(snapshot: AnalyticsSnapshot) {
  if (snapshot.sessionsAbandoned >= 2) {
    return "Reset the day with one 20 minute win. Small and clean beats scattered.";
  }

  if (snapshot.focusMinutes < 45) {
    return "You do not need a perfect afternoon. One solid focus block is enough to recover the day.";
  }

  return "Keep the rhythm. One more focused block keeps today aligned with your standard.";
}

function buildEveningBody(snapshot: AnalyticsSnapshot) {
  if (snapshot.taskCompletedCount === 0) {
    return "Before the day closes, complete one task so the work ends with something finished.";
  }

  if ((snapshot.averageSessionQualityScore ?? 0) < 60) {
    return "Close with one calm, high quality session rather than another rushed start.";
  }

  return "Close the day on purpose. One clean finish is better than drifting into tomorrow.";
}

function buildPlanForHigh(snapshot: AnalyticsSnapshot, config: NotificationStrategyConfig) {
  return {
    performanceBand: "high" as const,
    maxNotifications: config.maxNotifications,
    notifications: [
      {
        kind: "morning_plan" as const,
        deliverAtLocalTime: config.defaultTimes.morning_plan,
        title: `Yesterday was a ${snapshot.dailyPerformanceScore}. Keep the standard.`,
        body: "You already have momentum. Protect the first meaningful session and stay deliberate.",
      },
    ],
  };
}

function buildPlanForSteady(snapshot: AnalyticsSnapshot, config: NotificationStrategyConfig) {
  return {
    performanceBand: "steady" as const,
    maxNotifications: config.maxNotifications,
    notifications: [
      {
        kind: "morning_plan" as const,
        deliverAtLocalTime: config.defaultTimes.morning_plan,
        title: "Set the tone early.",
        body: buildMorningBody(snapshot),
      },
      {
        kind: "evening_close" as const,
        deliverAtLocalTime: config.defaultTimes.evening_close,
        title: "Finish the day cleanly.",
        body: buildEveningBody(snapshot),
      },
    ],
  };
}

function buildPlanForRecovery(snapshot: AnalyticsSnapshot, config: NotificationStrategyConfig) {
  return {
    performanceBand: "recovery" as const,
    maxNotifications: config.maxNotifications,
    notifications: [
      {
        kind: "morning_plan" as const,
        deliverAtLocalTime: config.defaultTimes.morning_plan,
        title: "Reset the day with one win.",
        body: buildMorningBody(snapshot),
      },
      {
        kind: "midday_reset" as const,
        deliverAtLocalTime: config.defaultTimes.midday_reset,
        title: "The day is still recoverable.",
        body: buildMiddayBody(snapshot),
      },
      {
        kind: "evening_close" as const,
        deliverAtLocalTime: config.defaultTimes.evening_close,
        title: "Do not end on drift.",
        body: buildEveningBody(snapshot),
      },
    ],
  };
}

// Notifications stay analytics-driven, but the strategy is intentionally config-based
// so later phases can add quiet hours, user preferences, experiments, or delivery channels.
export function buildPerformanceNotificationPlan(
  snapshot: AnalyticsSnapshot,
): PerformanceNotificationPlan {
  const config = NOTIFICATION_STRATEGY[snapshot.dailyPerformanceBand];

  switch (snapshot.dailyPerformanceBand) {
    case "high":
      return buildPlanForHigh(snapshot, config);
    case "steady":
      return buildPlanForSteady(snapshot, config);
    case "recovery":
      return buildPlanForRecovery(snapshot, config);
  }
}
