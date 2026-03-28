export function resolveFirestoreDatabaseId() {
  return (
    process.env.FIREBASE_DATABASE_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID?.trim() ||
    "(default)"
  );
}

export function firestoreCleanupDatabaseIds() {
  const primary = resolveFirestoreDatabaseId();
  return primary === "(default)" ? [primary] : [primary, "(default)"];
}
