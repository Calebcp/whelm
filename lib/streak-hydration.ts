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
  if (computedStreak > 0) {
    return {
      streak: computedStreak,
      nextLastGoodStreak: computedStreak,
      isProvisional: false,
    };
  }

  const evidenceHydrating = !sessionsSynced || !plannedBlocksHydrated || !notesHydrated;
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
