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
