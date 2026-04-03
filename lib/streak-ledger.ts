import { dayKeyLocal } from "@/lib/date-utils";
import type { SessionDoc } from "@/lib/streak";
import { doesDateQualifyForStreak, STREAK_RULE_V2_START_DATE } from "@/lib/xp-engine";

export type StreakLedgerEntry = {
  dateKey: string;
  focusMinutes: number;
  completedBlocks: number;
  noteWords: number;
  isProtected: boolean;
  qualifies: boolean;
  qualificationReason: "protected" | "legacy_focus" | "v2_combo" | "none";
};

function dayKeyUtc(iso: string) {
  const date = new Date(iso);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isPlannedBlockCompletionSession(session: SessionDoc) {
  const note = session.note?.trim() ?? "";
  return note.toLowerCase().startsWith("planned block completed:");
}

export function buildSessionMinutesByDayForStreakLedger(sessions: SessionDoc[]) {
  const map = new Map<string, number>();

  for (const session of sessions) {
    const dateKey = isPlannedBlockCompletionSession(session)
      ? dayKeyUtc(session.completedAtISO)
      : dayKeyLocal(session.completedAtISO);
    map.set(dateKey, (map.get(dateKey) ?? 0) + session.minutes);
  }

  return map;
}

export function inferCompletedBlocksByDayFromSessions(sessions: SessionDoc[]) {
  const map = new Map<string, number>();

  for (const session of sessions) {
    if (!isPlannedBlockCompletionSession(session)) continue;
    // Planned-block completion sessions encode the chosen calendar day into the
    // ISO timestamp. Recover them by UTC date so the inferred block stays on
    // the original planned day across devices and timezones.
    const dateKey = dayKeyUtc(session.completedAtISO);
    map.set(dateKey, (map.get(dateKey) ?? 0) + 1);
  }

  return map;
}

export function mergeCompletedBlocksByDay({
  completedBlocksByDay,
  inferredCompletedBlocksByDay,
}: {
  completedBlocksByDay: ReadonlyMap<string, number>;
  inferredCompletedBlocksByDay: ReadonlyMap<string, number>;
}) {
  const merged = new Map(completedBlocksByDay);

  for (const [dateKey, count] of inferredCompletedBlocksByDay.entries()) {
    merged.set(dateKey, Math.max(merged.get(dateKey) ?? 0, count));
  }

  return merged;
}

export function collectTrackedDayKeys({
  sessionMinutesByDay,
  completedBlocksByDay,
  noteWordsByDay,
  protectedStreakDateKeys,
}: {
  sessionMinutesByDay: ReadonlyMap<string, number>;
  completedBlocksByDay: ReadonlyMap<string, number>;
  noteWordsByDay: ReadonlyMap<string, number>;
  protectedStreakDateKeys: readonly string[];
}) {
  return new Set<string>([
    ...sessionMinutesByDay.keys(),
    ...completedBlocksByDay.keys(),
    ...noteWordsByDay.keys(),
    ...protectedStreakDateKeys,
  ]);
}

export function buildStreakLedger({
  sessionMinutesByDay,
  completedBlocksByDay,
  noteWordsByDay,
  protectedStreakDateKeys,
  todayKey,
}: {
  sessionMinutesByDay: ReadonlyMap<string, number>;
  completedBlocksByDay: ReadonlyMap<string, number>;
  noteWordsByDay: ReadonlyMap<string, number>;
  protectedStreakDateKeys: readonly string[];
  todayKey: string;
}) {
  const trackedDayKeys = collectTrackedDayKeys({
    sessionMinutesByDay,
    completedBlocksByDay,
    noteWordsByDay,
    protectedStreakDateKeys,
  });

  return [...trackedDayKeys]
    .sort()
    .map<StreakLedgerEntry>((dateKey) => {
      const focusMinutes = sessionMinutesByDay.get(dateKey) ?? 0;
      const completedBlocks = completedBlocksByDay.get(dateKey) ?? 0;
      const noteWords = noteWordsByDay.get(dateKey) ?? 0;
      const isProtected = protectedStreakDateKeys.includes(dateKey);
      const qualifies = doesDateQualifyForStreak({
        dateKey,
        focusMinutes,
        completedBlocks,
        noteWords,
        todayKey,
        protectedDateKeys: [...protectedStreakDateKeys],
      });

      let qualificationReason: StreakLedgerEntry["qualificationReason"] = "none";
      if (isProtected) {
        qualificationReason = "protected";
      } else if (qualifies) {
        qualificationReason = dateKey < STREAK_RULE_V2_START_DATE ? "legacy_focus" : "v2_combo";
      }

      return {
        dateKey,
        focusMinutes,
        completedBlocks,
        noteWords,
        isProtected,
        qualifies,
        qualificationReason,
      };
    });
}
