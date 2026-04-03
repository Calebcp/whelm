export function resolveHydratedStreak({
  computedStreak,
  lastGoodStreak,
  sessionsSynced,
  plannedBlocksHydrated,
  notesHydrated,
}: {
  computedStreak: number;
  lastGoodStreak: number;
  sessionsSynced: boolean;
  plannedBlocksHydrated: boolean;
  notesHydrated: boolean;
}) {
  const evidenceHydrating = !sessionsSynced || !plannedBlocksHydrated || !notesHydrated;

  if (computedStreak > 0) {
    return {
      streak: computedStreak,
      nextLastGoodStreak: computedStreak,
      isProvisional: evidenceHydrating,
    };
  }

  if (evidenceHydrating && lastGoodStreak > 0) {
    return {
      streak: lastGoodStreak,
      nextLastGoodStreak: lastGoodStreak,
      isProvisional: true,
    };
  }

  return {
    streak: computedStreak,
    nextLastGoodStreak: lastGoodStreak,
    isProvisional: false,
  };
}
