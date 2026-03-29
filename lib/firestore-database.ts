function normalizeDatabaseId(databaseId: string | undefined) {
  const trimmed = databaseId?.trim();
  return trimmed ? trimmed : null;
}

export function resolveFirestoreDatabaseId() {
  const explicitDatabaseId =
    normalizeDatabaseId(process.env.FIREBASE_DATABASE_ID) ||
    normalizeDatabaseId(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID);

  if (explicitDatabaseId) return explicitDatabaseId;

  const projectId = normalizeDatabaseId(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  return projectId || "(default)";
}

export function firestoreCleanupDatabaseIds() {
  const primary = resolveFirestoreDatabaseId();
  return primary === "(default)" ? [primary] : [primary, "(default)"];
}
