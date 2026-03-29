import { initializeApp, getApps } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
} from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { resolveFirestoreDatabaseId } from "@/lib/firestore-database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

function shouldForceFirestoreLongPolling() {
  const explicitOverride = process.env.NEXT_PUBLIC_FIREBASE_FORCE_LONG_POLLING?.trim();
  if (explicitOverride === "true") return true;
  if (explicitOverride === "false") return false;

  if (typeof window === "undefined") return false;
  const protocol = typeof window.location?.protocol === "string" ? window.location.protocol : "";
  return protocol === "capacitor:" || protocol === "ionic:" || protocol === "file:";
}

function createAuth() {
  try {
    return initializeAuth(app, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
      ],
    });
  } catch {
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = initializeFirestore(
  app,
  {
    // Use the default transport on the website. Force long polling only for
    // native/webview protocols or when explicitly enabled via env.
    experimentalForceLongPolling: shouldForceFirestoreLongPolling(),
  },
  resolveFirestoreDatabaseId(),
);
export const storage = getStorage(app);
