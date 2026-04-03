export function canSyncLeaderboardProfile({
  sessionsSynced,
  streakIsProvisional,
}: {
  sessionsSynced: boolean;
  streakIsProvisional: boolean;
}) {
  return sessionsSynced && !streakIsProvisional;
}
