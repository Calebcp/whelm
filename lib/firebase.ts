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
    // VPNs, proxies, and some hosted/browser environments can break Firestore's
    // default transport stack. Forced long polling is slower, but substantially
    // more reliable for this app's small payloads.
    experimentalForceLongPolling: true,
  },
  resolveFirestoreDatabaseId(),
);
export const storage = getStorage(app);
