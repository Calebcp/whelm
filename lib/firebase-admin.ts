import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { resolveFirestoreDatabaseId } from "@/lib/firestore-database";

const adminProjectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
  "";
const adminClientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() || "";
const adminPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n") || "";

export function hasFirebaseAdmin() {
  return Boolean(adminProjectId && adminClientEmail && adminPrivateKey);
}

function getAdminApp() {
  if (!hasFirebaseAdmin()) return null;
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp({
    credential: cert({
      projectId: adminProjectId,
      clientEmail: adminClientEmail,
      privateKey: adminPrivateKey,
    }),
  });
}

export function getAdminDb() {
  const app = getAdminApp();
  if (!app) return null;
  return getFirestore(app, resolveFirestoreDatabaseId());
}

export function getAdminAuth() {
  const app = getAdminApp();
  if (!app) return null;
  return getAuth(app);
}
