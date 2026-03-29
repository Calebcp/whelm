import test from "node:test";
import assert from "node:assert/strict";

function resetDatabaseEnv() {
  delete process.env.FIREBASE_DATABASE_ID;
  delete process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID;
  delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
}

test("resolveFirestoreDatabaseId prefers explicit server database id", async () => {
  resetDatabaseEnv();
  process.env.FIREBASE_DATABASE_ID = "(default)";
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID = "public-db";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "project-db";

  const { resolveFirestoreDatabaseId } = await import("@/lib/firestore-database");
  assert.equal(resolveFirestoreDatabaseId(), "(default)");

  resetDatabaseEnv();
});

test("resolveFirestoreDatabaseId falls back to public database id", async () => {
  resetDatabaseEnv();
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID = "public-db";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "project-db";

  const { resolveFirestoreDatabaseId } = await import("@/lib/firestore-database");
  assert.equal(resolveFirestoreDatabaseId(), "public-db");

  resetDatabaseEnv();
});

test("resolveFirestoreDatabaseId falls back to project id when public database id is missing", async () => {
  resetDatabaseEnv();
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "whelm-16d5c";

  const { resolveFirestoreDatabaseId } = await import("@/lib/firestore-database");
  assert.equal(resolveFirestoreDatabaseId(), "whelm-16d5c");

  resetDatabaseEnv();
});

test("resolveFirestoreDatabaseId returns default when no database config exists", async () => {
  resetDatabaseEnv();

  const { resolveFirestoreDatabaseId } = await import("@/lib/firestore-database");
  assert.equal(resolveFirestoreDatabaseId(), "(default)");
});
