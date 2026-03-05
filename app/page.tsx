"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";

import Timer from "@/components/Timer";
import { auth } from "@/lib/firebase";
import { loadSessions, saveSession } from "@/lib/session-store";
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

type FeedbackCategory = "bug" | "feature" | "other";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
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
      } finally {
        setAuthChecked(true);
      }
    });

    return () => unsub();
  }, [router]);

  async function refreshSessions(uid: string) {
    const currentUser = auth.currentUser;

    if (!currentUser || currentUser.uid !== uid) {
      throw new Error("Your login session is missing. Sign in again.");
    }

    setSessions(await loadSessions(currentUser));
  }

  async function completeSession(category: SessionCategory, note: string) {
    if (!user) return;

    const now = new Date().toISOString();
    const session: SessionDoc = {
      uid: user.uid,
      completedAtISO: now,
      minutes: 25,
      category,
      note: note.trim(),
      noteSavedAtISO: now,
    };

    try {
      await saveSession(user, session);
      setSessions((current) =>
        [session, ...current].sort((a, b) => (a.completedAtISO < b.completedAtISO ? 1 : -1)),
      );
    } catch {
      // Local storage writes are expected to succeed in normal browser contexts.
    }
  }

  async function submitFeedback() {
    if (!user || feedbackSubmitting) return;

    const message = feedbackMessage.trim();
    if (!message) {
      setFeedbackStatus("Please write a short message before sending.");
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackStatus("");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email ?? "",
          displayName: user.displayName ?? "",
          category: feedbackCategory,
          message,
          pagePath: window.location.pathname,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(body?.error || "Failed to submit feedback.");
      }

      setFeedbackMessage("");
      setFeedbackStatus("Thanks. Feedback submitted.");
      window.setTimeout(() => {
        setFeedbackOpen(false);
        setFeedbackStatus("");
      }, 900);
    } catch (error: unknown) {
      setFeedbackStatus(
        error instanceof Error ? error.message : "Failed to submit feedback.",
      );
    } finally {
      setFeedbackSubmitting(false);
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
                onComplete={(note) => completeSession(config.category, note)}
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
                        {session.noteSavedAtISO && (
                          <span className={styles.noteTimestamp}>
                            {new Date(session.noteSavedAtISO).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {session.note && <div className={styles.sessionNote}>{session.note}</div>}
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

      <button
        type="button"
        className={styles.feedbackButton}
        onClick={() => {
          setFeedbackOpen(true);
          setFeedbackStatus("");
        }}
      >
        Feedback
      </button>

      {feedbackOpen && (
        <div
          className={styles.feedbackOverlay}
          onClick={() => {
            if (!feedbackSubmitting) {
              setFeedbackOpen(false);
              setFeedbackStatus("");
            }
          }}
        >
          <div
            className={styles.feedbackModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.feedbackHeader}>
              <h2 className={styles.feedbackTitle}>Send feedback</h2>
              <button
                type="button"
                className={styles.feedbackClose}
                disabled={feedbackSubmitting}
                onClick={() => {
                  setFeedbackOpen(false);
                  setFeedbackStatus("");
                }}
              >
                Close
              </button>
            </div>

            <div className={styles.feedbackMeta}>
              <span>{user.email || "Unknown email"}</span>
            </div>

            <label className={styles.feedbackLabel} htmlFor="feedback-category">
              Category
            </label>
            <select
              id="feedback-category"
              value={feedbackCategory}
              onChange={(event) =>
                setFeedbackCategory(event.target.value as FeedbackCategory)
              }
              className={styles.feedbackSelect}
              disabled={feedbackSubmitting}
            >
              <option value="bug">Bug</option>
              <option value="feature">Feature</option>
              <option value="other">Other</option>
            </select>

            <label className={styles.feedbackLabel} htmlFor="feedback-message">
              Message
            </label>
            <textarea
              id="feedback-message"
              value={feedbackMessage}
              onChange={(event) => setFeedbackMessage(event.target.value)}
              className={styles.feedbackTextarea}
              placeholder="What happened? What should change?"
              maxLength={2000}
              disabled={feedbackSubmitting}
            />

            <div className={styles.feedbackFooter}>
              <button
                type="button"
                className={styles.feedbackSubmit}
                onClick={submitFeedback}
                disabled={feedbackSubmitting}
              >
                {feedbackSubmitting ? "Sending..." : "Send feedback"}
              </button>
              {feedbackStatus && (
                <p className={styles.feedbackStatus}>{feedbackStatus}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
