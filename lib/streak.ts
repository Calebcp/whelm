export type SessionCategory = "misc" | "language" | "software";

export type SessionDoc = {
  uid: string;
  completedAtISO: string;
  minutes: number;
  category?: SessionCategory;
  note?: string;
  noteSavedAtISO?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymdLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function sortedActivityDays(sessions: SessionDoc[], protectedDateKeys: string[] = []) {
  const todayKey = ymdLocal(new Date());
  return [
    ...new Set([
      ...sessions.map((session) => ymdLocal(new Date(session.completedAtISO))),
      ...protectedDateKeys,
    ]),
  ]
    .filter((dateKey) => dateKey <= todayKey)
    .sort();
}

export function computeStreak(sessions: SessionDoc[], protectedDateKeys: string[] = []) {
  const days = new Set(sortedActivityDays(sessions, protectedDateKeys));

  let streak = 0;
  const cursor = new Date();
  while (days.has(ymdLocal(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeStreakEndingAtDateKey(
  sessions: SessionDoc[],
  anchorDateKey: string,
  protectedDateKeys: string[] = [],
) {
  const days = new Set(sortedActivityDays(sessions, protectedDateKeys));
  if (!days.has(anchorDateKey)) return 0;

  let streak = 0;
  const cursor = new Date(`${anchorDateKey}T00:00:00`);
  while (days.has(ymdLocal(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeHistoricalStreaks(sessions: SessionDoc[], protectedDateKeys: string[] = []) {
  const streakByDay = new Map<string, number>();
  const days = sortedActivityDays(sessions, protectedDateKeys);

  let previousDate: Date | null = null;
  let currentRun = 0;
  for (const dayKey of days) {
    const currentDate = new Date(`${dayKey}T00:00:00`);

    if (!previousDate) {
      currentRun = 1;
    } else {
      const expectedNextDate = new Date(previousDate);
      expectedNextDate.setDate(expectedNextDate.getDate() + 1);
      currentRun = ymdLocal(expectedNextDate) === dayKey ? currentRun + 1 : 1;
    }

    streakByDay.set(dayKey, currentRun);
    previousDate = currentDate;
  }

  return streakByDay;
}
