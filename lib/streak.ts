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

/**
 * Computes the current active streak (count of consecutive qualifying days
 * ending today or yesterday).
 *
 * HOW THE STREAK IS BUILT (two-phase rule system):
 *
 * 1. Activity days are assembled from two sources:
 *    a. Session dates derived from `sessions[].completedAtISO`.
 *    b. `protectedDateKeys` — sick-day saves granted by the user; these count
 *       as qualifying days regardless of session activity.
 *
 * 2. Rule tier (controlled by STREAK_RULE_V2_START_DATE = "2026-03-22"):
 *    • Pre-v2 (dateKey < "2026-03-22"): any positive focus minutes qualifies.
 *    • v2 (dateKey >= "2026-03-22"): needs ≥1 completed block AND
 *      (≥30 focus minutes OR ≥33 note words written that day).
 *    The caller (page.tsx streakQualifiedDateKeys memo) applies these rules
 *    before calling computeStreak; this function receives an already-filtered
 *    list of qualifying date keys (passed as `protectedDateKeys`).
 *
 * 3. Date arithmetic uses LOCAL timezone throughout (`ymdLocal` via
 *    `getFullYear/getMonth/getDate`), so midnight rollover matches the user's
 *    wall clock, not UTC. Future dates are excluded.
 *
 * 4. The streak counts backward from today: if today qualifies, count it then
 *    step back one day and repeat. Stop at the first missing day.
 *    displayStreak in the UI extends this with yesterday's run so the streak
 *    survives into the next calendar day before the user has re-qualified.
 *
 * RACE-CONDITION PROTECTION (page.tsx):
 *    plannedBlocks (needed for v2 rule) loads asynchronously in parallel with
 *    sessions. Until plannedBlocksHydrated is true, the caller preserves the
 *    last non-zero streak to avoid a transient flash to 0.
 */
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
