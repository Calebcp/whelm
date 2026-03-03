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
import {
  computeStreak,
  type SessionCategory,
  type SessionDoc,
} from "@/lib/streak";
import styles from "./page.module.css";

const TIMER_CONFIGS: Array<{
  category: SessionCategory;
  title: string;
  subtitle: string;
  actionLabel: string;
  badgeLabel: string;
  theme: {
    accent: string;
    accentSoft: string;
    accentStrong: string;
    ring: string;
  };
}> = [
  {
    category: "misc",
    title: "Miscellaneous tasks",
    subtitle: "Reset the chaos",
    actionLabel: "Complete Misc Session",
    badgeLabel: "Misc",
    theme: {
      accent: "#9b5de5",
      accentSoft: "#f4ebff",
      accentStrong: "#5b2e91",
      ring: "rgba(155, 93, 229, 0.18)",
    },
  },
  {
    category: "language",
    title: "Language study",
    subtitle: "Words, listening, memory",
    actionLabel: "Complete Language Session",
    badgeLabel: "Language",
    theme: {
      accent: "#ff8c42",
      accentSoft: "#fff1e5",
      accentStrong: "#a64900",
      ring: "rgba(255, 140, 66, 0.2)",
    },
  },
  {
    category: "software",
    title: "Software projects",
    subtitle: "Ship something real",
    actionLabel: "Complete Build Session",
    badgeLabel: "Software",
    theme: {
      accent: "#00a896",
      accentSoft: "#e6fbf7",
      accentStrong: "#0f5c54",
      ring: "rgba(0, 168, 150, 0.18)",
    },
  },
];

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

  async function completeSession(category: SessionCategory) {
    if (!user) return;

    const session: SessionDoc = {
      uid: user.uid,
      completedAtISO: new Date().toISOString(),
      minutes: 25,
      category,
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
                ? `${new Date(lastSession.completedAtISO).toLocaleString()} · ${
                    TIMER_CONFIGS.find(
                      (config) => config.category === (lastSession.category ?? "misc"),
                    )?.badgeLabel ?? "Misc"
                  }`
                : "Not yet started"}
            </strong>
          </article>
        </section>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <section className={styles.mainGrid}>
          <div className={styles.timersGrid}>
            {TIMER_CONFIGS.map((config) => (
              <Timer
                key={config.category}
                minutes={25}
                title={config.title}
                subtitle={config.subtitle}
                actionLabel={config.actionLabel}
                theme={config.theme}
                onComplete={() => completeSession(config.category)}
              />
            ))}
          </div>

          <aside className={styles.sessionsCard}>
            <div>
              <p className={styles.sectionLabel}>Your account</p>
              <p className={styles.email}>
                {user.displayName || user.email?.split("@")[0] || "WHELM user"}
              </p>
              <p className={styles.accountMeta}>{user.email}</p>
            </div>

            <div className={styles.sessionsBlock}>
              <div className={styles.sessionsHeadingRow}>
                <h2 className={styles.sessionsHeading}>Recent sessions</h2>
                <span className={styles.sessionsHint}>Latest 5</span>
              </div>

              <div className={styles.sessionList}>
                {sessions.slice(0, 5).map((session, index) => (
                  <div key={`${session.completedAtISO}-${index}`} className={styles.sessionItem}>
                    <div>
                      <div className={styles.sessionPrimary}>
                        {new Date(session.completedAtISO).toLocaleString()}
                      </div>
                      <div className={styles.sessionSecondary}>
                        <span
                          className={styles.categoryBadge}
                          style={{
                            backgroundColor:
                              TIMER_CONFIGS.find(
                                (config) =>
                                  config.category === (session.category ?? "misc"),
                              )?.theme.accentSoft,
                            color:
                              TIMER_CONFIGS.find(
                                (config) =>
                                  config.category === (session.category ?? "misc"),
                              )?.theme.accentStrong,
                          }}
                        >
                          {TIMER_CONFIGS.find(
                            (config) => config.category === (session.category ?? "misc"),
                          )?.badgeLabel ?? "Misc"}
                        </span>
                      </div>
                    </div>
                    <div className={styles.sessionMinutes}>{session.minutes}m</div>
                  </div>
                ))}

                {sessions.length === 0 && (
                  <div className={styles.emptyState}>
                    No sessions yet. Pick a lane: miscellaneous, language study, or
                    software projects.
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
