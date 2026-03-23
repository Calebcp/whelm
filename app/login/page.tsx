"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";

import SenseiFigure from "@/components/SenseiFigure";
import WhelmRitualScene from "@/components/WhelmRitualScene";
import { auth } from "@/lib/firebase";
import styles from "./page.module.css";

const AUTH_REQUEST_TIMEOUT_MS = 15000;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) router.replace("/");
    });

    return () => unsub();
  }, [router]);

  async function handleSubmit() {
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();

    if (!trimmedEmail) {
      setStatus("Enter your email.");
      return;
    }

    if (mode === "signup" && !trimmedUsername) {
      setStatus("Choose a username.");
      return;
    }

    if (!password.trim()) {
      setStatus("Enter your password.");
      return;
    }

    if (password.length < 6) {
      setStatus("Password must be at least 6 characters.");
      return;
    }

    setStatus("");
    setSubmitting(true);

    try {
      setStatus(mode === "signup" ? "Creating account..." : "Logging in...");

      const authRequest =
        mode === "signup"
          ? (async () => {
              const credentials = await createUserWithEmailAndPassword(
                auth,
                trimmedEmail,
                password,
              );

              await updateProfile(credentials.user, {
                displayName: trimmedUsername,
              });
            })()
          : signInWithEmailAndPassword(auth, trimmedEmail, password);

      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(() => {
          reject(
            new Error(
              "Authentication timed out. Check connection and confirm the deployed site is live.",
            ),
          );
        }, AUTH_REQUEST_TIMEOUT_MS);
      });

      await Promise.race([authRequest, timeoutPromise]);

      setStatus("Opening your workspace...");
      router.replace("/");
      window.setTimeout(() => {
        if (window.location.pathname !== "/") {
          window.location.assign("/");
        }
      }, 500);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Authentication failed.";
      setStatus(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.pageShell}>
      <div className={styles.pageAura} aria-hidden="true" />
      <div className={styles.loginFrame}>
        <section className={styles.storyPanel}>
          <div className={styles.storyBackdrop}>
            <WhelmRitualScene variant="orb" />
          </div>
          <div className={styles.storyInner}>
            <div className={styles.storyCopy}>
              <p className={styles.kicker}>WHELM</p>
              <h1 className={styles.title}>Build a calmer operating system for your focus.</h1>
              <p className={styles.subtitle}>
                Whelm is where productivity becomes a standard, not a mood. Notes, sessions,
                rhythm, and accountability stay attached to your account so the system stays
                consistent every time you return.
              </p>
            </div>

            <div className={styles.senseiStage}>
              <div className={styles.senseiHalo} aria-hidden="true" />
              <SenseiFigure
                variant="wave"
                size="hero"
                align="left"
                message="Your system should feel clear before the day gets loud."
                className={styles.senseiFigure}
              />
            </div>

            <div className={styles.storyGrid}>
              <article className={styles.storyCard}>
                <p className={styles.storyLabel}>Return with context</p>
                <p className={styles.storyBody}>Your saved sessions, notes, and momentum stay with you.</p>
              </article>
              <article className={styles.storyCard}>
                <p className={styles.storyLabel}>Train consistency</p>
                <p className={styles.storyBody}>Whelm turns scattered effort into a visible discipline loop.</p>
              </article>
              <article className={styles.storyCard}>
                <p className={styles.storyLabel}>Grow into Pro</p>
                <p className={styles.storyBody}>Whelm Pro expands the system with deeper reports, longer memory, and stronger personalization.</p>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.formPanel}>
          <div
            className={`${styles.formShell} ${
              mode === "signup" ? styles.signupMode : styles.loginMode
            }`}
          >
            <div className={styles.mobileAppChrome}>
              <div>
                <p className={styles.mobileAppEyebrow}>Whelm</p>
                <strong className={styles.mobileAppTitle}>
                  {mode === "signup" ? "Create account" : "Log in"}
                </strong>
              </div>
              <span className={styles.mobileAppBadge}>
                {mode === "signup" ? "Productivity elevated" : "Welcome back"}
              </span>
            </div>

            <div className={styles.mobileWelcomeCard}>
              <div className={styles.mobileWelcomeFigure}>
                <SenseiFigure
                  variant="wave"
                  size="inline"
                  align="left"
                  className={styles.mobileWelcomeSensei}
                />
              </div>
              <div className={styles.mobileWelcomeCopy}>
                <p className={styles.kicker}>WHELM</p>
                <h2 className={styles.mobileWelcomeTitle}>
                  {mode === "signup" ? "Start your Whelm journey." : "Welcome back."}
                </h2>
                <p className={styles.mobileWelcomeBody}>
                  {mode === "signup"
                    ? "Productivity on another level. Build your system with notes, streaks, XP, and identity that stay with you."
                    : "Your notes, streaks, XP, and rhythm should be right where you left them."}
                </p>
              </div>
            </div>

            <div className={styles.formHeader}>
              <p className={styles.formEyebrow}>
                {mode === "signup" ? "Start your Whelm journey" : "Log in"}
              </p>
              <div className={styles.modeSwitch}>
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setStatus("");
                  }}
                  className={`${styles.modeButton} ${
                    mode === "login" ? styles.modeButtonActive : ""
                  }`}
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setStatus("");
                  }}
                  className={`${styles.modeButton} ${
                    mode === "signup" ? styles.modeButtonActive : ""
                  }`}
                >
                  Create account
                </button>
              </div>

              <h2 className={styles.formTitle}>
                {mode === "signup" ? "Productivity on another level" : "Log in to Whelm"}
              </h2>
              <p className={styles.formCopy}>
                {mode === "signup"
                  ? "Create your account and keep your progress, notes, streaks, and momentum attached from day one."
                  : "Use the same email and password you used before. Whelm will restore your saved work after sign-in."}
              </p>
            </div>

            <div className={styles.authCard}>
              <div className={styles.fieldBlock}>
              {mode === "signup" && (
                <>
                  <label className={styles.label} htmlFor="username">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="yourname"
                    className={styles.input}
                    autoComplete="username"
                  />
                </>
              )}

              <label className={styles.label} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className={styles.input}
                autoComplete="email"
              />

              <label className={styles.label} htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                className={styles.input}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />

              <button
                onClick={handleSubmit}
                className={styles.submitButton}
                disabled={submitting}
              >
                {submitting
                  ? mode === "signup"
                    ? "Creating account..."
                    : "Logging in..."
                  : mode === "signup"
                    ? "Create account"
                    : "Log in"}
              </button>

              <div className={styles.helperText}>
                {mode === "signup"
                  ? "You can sign in later from another browser and pick up where you left off."
                  : "Your notes, sessions, and discipline history load after login."}
              </div>

              {status && <div className={styles.statusBox}>{status}</div>}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
