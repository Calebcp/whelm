"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import Timer from "@/components/Timer";
import { auth, db } from "@/lib/firebase";
import { computeStreak, type SessionDoc } from "@/lib/streak";
import styles from "./page.module.css";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [error, setError] = useState("");
  const streak = computeStreak(sessions);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setSessions([]);
        setAuthChecked(true);
        router.push("/login");
        return;
      }

      setUser(nextUser);
      try {
        await refreshSessions(nextUser.uid);
        setError("");
      } catch (nextError: unknown) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to load sessions.",
        );
      } finally {
        setAuthChecked(true);
      }
    });

    return () => unsub();
  }, [router]);

  async function refreshSessions(uid: string) {
    const sessionsQuery = query(
      collection(db, "sessions"),
      where("uid", "==", uid),
    );
    const snap = await getDocs(sessionsQuery);
    const nextSessions = snap.docs
      .map((doc) => doc.data() as SessionDoc)
      .sort((a, b) => (a.completedAtISO < b.completedAtISO ? 1 : -1));

    setSessions(nextSessions);
  }

  async function completeSession() {
    if (!user) return;

    const session: SessionDoc = {
      uid: user.uid,
      completedAtISO: new Date().toISOString(),
      minutes: 25,
    };

    setError("");

    try {
      await addDoc(collection(db, "sessions"), session);
      await refreshSessions(user.uid);
    } catch (nextError: unknown) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to save session.",
      );
      throw nextError;
    }
  }

  if (!authChecked) {
    return (
      <main className={styles.pageShell}>
        <div className={styles.loadingCard}>
          <p className={styles.loadingLabel}>Preparing your WHELM session...</p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const lastSession = sessions[0];

  return (
    <main className={styles.pageShell}>
      <div className={styles.pageFrame}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>WHELM</p>
            <h1 className={styles.title}>Focus. Don&apos;t drown.</h1>
            <p className={styles.subtitle}>
              A stripped-down focus session for one thing at a time.
            </p>
          </div>

          <button onClick={() => signOut(auth)} className={styles.signOutButton}>
            Sign out
          </button>
        </header>

        <section className={styles.statsGrid}>
          <article className={styles.statCard}>
            <span className={styles.statLabel}>Current streak</span>
            <strong className={styles.statValue}>
              {streak} day{streak === 1 ? "" : "s"}
            </strong>
          </article>

          <article className={styles.statCard}>
            <span className={styles.statLabel}>Completed sessions</span>
            <strong className={styles.statValue}>{sessions.length}</strong>
          </article>

          <article className={styles.statCard}>
            <span className={styles.statLabel}>Last session</span>
            <strong className={styles.statValueSmall}>
              {lastSession
                ? new Date(lastSession.completedAtISO).toLocaleString()
                : "Not yet started"}
            </strong>
          </article>
        </section>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <section className={styles.mainGrid}>
          <Timer minutes={25} onComplete={completeSession} />

          <aside className={styles.sessionsCard}>
            <div>
              <p className={styles.sectionLabel}>Your account</p>
              <p className={styles.email}>{user.email}</p>
            </div>

            <div className={styles.sessionsBlock}>
              <div className={styles.sessionsHeadingRow}>
                <h2 className={styles.sessionsHeading}>Recent sessions</h2>
                <span className={styles.sessionsHint}>Latest 5</span>
              </div>

              <div className={styles.sessionList}>
                {sessions.slice(0, 5).map((session, index) => (
                  <div
                    key={`${session.completedAtISO}-${index}`}
                    className={styles.sessionItem}
                  >
                    <div>
                      <div className={styles.sessionPrimary}>
                        {new Date(session.completedAtISO).toLocaleString()}
                      </div>
                      <div className={styles.sessionSecondary}>Focused session</div>
                    </div>
                    <div className={styles.sessionMinutes}>{session.minutes}m</div>
                  </div>
                ))}

                {sessions.length === 0 && (
                  <div className={styles.emptyState}>
                    No sessions yet. Start your first WHELM cycle and complete it to
                    begin the streak.
                  </div>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
