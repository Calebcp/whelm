import { NextRequest, NextResponse } from "next/server";

import { firestoreCleanupDatabaseIds } from "@/lib/firestore-database";
import { getAdminAuth, getAdminDb, getAdminStorageBucket, hasFirebaseAdmin } from "@/lib/firebase-admin";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
}

async function requireAuthorizedUid(request: NextRequest) {
  if (!hasFirebaseAdmin()) {
    throw new Error("Firebase admin configuration is required for full account deletion.");
  }

  const token = getBearerToken(request);
  if (!token) {
    throw new Error("Missing Firebase auth token.");
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    throw new Error("Firebase admin auth is not configured.");
  }

  const decoded = await adminAuth.verifyIdToken(token);
  if (!decoded.uid) {
    throw new Error("Unable to verify the signed-in user.");
  }

  return decoded.uid;
}

async function commitDeletes(
  db: FirebaseFirestore.Firestore,
  refs: FirebaseFirestore.DocumentReference[],
) {
  for (let index = 0; index < refs.length; index += 200) {
    const batch = db.batch();
    for (const ref of refs.slice(index, index + 200)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

async function deleteQueryInBatches(
  db: FirebaseFirestore.Firestore,
  query: FirebaseFirestore.Query,
) {
  let deleted = 0;

  while (true) {
    const snapshot = await query.limit(200).get();
    if (snapshot.empty) break;

    await commitDeletes(
      db,
      snapshot.docs.map((doc) => doc.ref),
    );
    deleted += snapshot.size;
  }

  return deleted;
}

async function deleteUserNotes(
  db: FirebaseFirestore.Firestore,
  uid: string,
) {
  const userNotesRef = db.collection("userNotes").doc(uid);
  const notesSnapshot = await userNotesRef.collection("notes").get();
  let deletedRevisions = 0;

  for (const noteDoc of notesSnapshot.docs) {
    const revisionsSnapshot = await noteDoc.ref.collection("revisions").get();
    if (!revisionsSnapshot.empty) {
      await commitDeletes(
        db,
        revisionsSnapshot.docs.map((doc) => doc.ref),
      );
      deletedRevisions += revisionsSnapshot.size;
    }
  }

  if (!notesSnapshot.empty) {
    await commitDeletes(
      db,
      notesSnapshot.docs.map((doc) => doc.ref),
    );
  }

  await userNotesRef.delete().catch(() => undefined);

  return {
    notesDeleted: notesSnapshot.size,
    noteRevisionsDeleted: deletedRevisions,
  };
}

async function deleteUserRelationships(
  db: FirebaseFirestore.Firestore,
  uid: string,
) {
  const friendshipsRoot = db.collection("friendships").doc(uid);
  const requestsRoot = db.collection("friendRequests").doc(uid);

  const [friendsSnapshot, incomingSnapshot, outgoingSnapshot] = await Promise.all([
    friendshipsRoot.collection("friends").get(),
    requestsRoot.collection("incoming").get(),
    requestsRoot.collection("outgoing").get(),
  ]);

  const reciprocalRefs: FirebaseFirestore.DocumentReference[] = [];

  for (const doc of friendsSnapshot.docs) {
    const friendUid = String(doc.get("friendUid") ?? doc.id);
    if (friendUid) {
      reciprocalRefs.push(db.collection("friendships").doc(friendUid).collection("friends").doc(uid));
    }
  }

  for (const doc of incomingSnapshot.docs) {
    const fromUid = String(doc.get("fromUid") ?? doc.id);
    if (fromUid) {
      reciprocalRefs.push(db.collection("friendRequests").doc(fromUid).collection("outgoing").doc(uid));
    }
  }

  for (const doc of outgoingSnapshot.docs) {
    const toUid = String(doc.get("toUid") ?? doc.id);
    if (toUid) {
      reciprocalRefs.push(db.collection("friendRequests").doc(toUid).collection("incoming").doc(uid));
    }
  }

  const uniqueReciprocalRefs = [...new Map(reciprocalRefs.map((ref) => [ref.path, ref])).values()];
  if (uniqueReciprocalRefs.length > 0) {
    await commitDeletes(db, uniqueReciprocalRefs);
  }

  const localRefs = [
    ...friendsSnapshot.docs.map((doc) => doc.ref),
    ...incomingSnapshot.docs.map((doc) => doc.ref),
    ...outgoingSnapshot.docs.map((doc) => doc.ref),
  ];
  if (localRefs.length > 0) {
    await commitDeletes(db, localRefs);
  }

  await Promise.all([
    friendshipsRoot.delete().catch(() => undefined),
    requestsRoot.delete().catch(() => undefined),
  ]);

  return {
    friendsDeleted: friendsSnapshot.size,
    incomingRequestsDeleted: incomingSnapshot.size,
    outgoingRequestsDeleted: outgoingSnapshot.size,
    reciprocalDeletes: uniqueReciprocalRefs.length,
  };
}

async function deleteUserStorage(uid: string) {
  const bucket = getAdminStorageBucket();
  if (!bucket) return 0;

  const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
  if (files.length === 0) return 0;

  await Promise.allSettled(files.map((file) => file.delete()));
  return files.length;
}

export async function DELETE(request: NextRequest) {
  try {
    const uid = await requireAuthorizedUid(request);
    const adminAuth = getAdminAuth();
    const databaseIds = firestoreCleanupDatabaseIds();

    if (!adminAuth) {
      return jsonError("Firebase admin configuration is required for full account deletion.", 500);
    }

    const summary = {
      notesDeleted: 0,
      noteRevisionsDeleted: 0,
      friendsDeleted: 0,
      incomingRequestsDeleted: 0,
      outgoingRequestsDeleted: 0,
      reciprocalDeletes: 0,
      sessionsDeleted: 0,
      analyticsEventsDeleted: 0,
      analyticsDailyMetricsDeleted: 0,
      leaderboardSnapshotsDeleted: 0,
      storageFilesDeleted: 0,
    };

    for (const databaseId of databaseIds) {
      const db = getAdminDb(databaseId);
      if (!db) {
        return jsonError("Firebase admin configuration is required for full account deletion.", 500);
      }

      const notesSummary = await deleteUserNotes(db, uid);
      const relationshipSummary = await deleteUserRelationships(db, uid);

      const [
        sessionsDeleted,
        analyticsEventsDeleted,
        analyticsDailyMetricsDeleted,
        leaderboardSnapshotsDeleted,
      ] = await Promise.all([
        deleteQueryInBatches(db, db.collection("sessions").where("uid", "==", uid)),
        deleteQueryInBatches(db, db.collection("analyticsEvents").where("userId", "==", uid)),
        deleteQueryInBatches(db, db.collection("analyticsDailyMetrics").where("userId", "==", uid)),
        deleteQueryInBatches(db, db.collection("leaderboardDailySnapshots").where("userId", "==", uid)),
      ]);

      await Promise.all([
        db.collection("userPlannedBlocks").doc(uid).delete().catch(() => undefined),
        db.collection("userPreferences").doc(uid).delete().catch(() => undefined),
        db.collection("userReflectionState").doc(uid).delete().catch(() => undefined),
        db.collection("userCards").doc(uid).delete().catch(() => undefined),
        db.collection("leaderboardProfiles").doc(uid).delete().catch(() => undefined),
      ]);

      summary.notesDeleted += notesSummary.notesDeleted;
      summary.noteRevisionsDeleted += notesSummary.noteRevisionsDeleted;
      summary.friendsDeleted += relationshipSummary.friendsDeleted;
      summary.incomingRequestsDeleted += relationshipSummary.incomingRequestsDeleted;
      summary.outgoingRequestsDeleted += relationshipSummary.outgoingRequestsDeleted;
      summary.reciprocalDeletes += relationshipSummary.reciprocalDeletes;
      summary.sessionsDeleted += sessionsDeleted;
      summary.analyticsEventsDeleted += analyticsEventsDeleted;
      summary.analyticsDailyMetricsDeleted += analyticsDailyMetricsDeleted;
      summary.leaderboardSnapshotsDeleted += leaderboardSnapshotsDeleted;
    }

    summary.storageFilesDeleted = await deleteUserStorage(uid);

    await adminAuth.deleteUser(uid);

    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to delete account.");
  }
}
