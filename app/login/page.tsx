"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";

import { auth } from "@/lib/firebase";
import styles from "./page.module.css";

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
      if (user) router.push("/");
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
      if (mode === "signup") {
        const credentials = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          password,
        );

        await updateProfile(credentials.user, {
          displayName: trimmedUsername,
        });
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }

      router.push("/");
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
      <div className={styles.heroCard}>
        <div className={styles.brandBlock}>
          <p className={styles.kicker}>WHELM</p>
          <h1 className={styles.title}>Underwhelm the overwhelm.</h1>
          <p className={styles.subtitle}>
            Real accounts. Saved sessions. Come back later and find your work.
          </p>
        </div>

        <div className={styles.formCard}>
          <div className={styles.formHeader}>
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
              {mode === "signup" ? "Create your account" : "Log in to your account"}
            </h2>
            <p className={styles.formCopy}>
              {mode === "signup"
                ? "Use a username, email, and password so your WHELM data stays attached to you."
                : "Sign in with the same email and password you used when creating the account."}
            </p>
          </div>

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
              placeholder="At least 6 characters"
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
                  ? "Create Account"
                  : "Log In"}
            </button>

            <div className={styles.helperText}>
              {mode === "signup"
                ? "After you create the account, you can log in from any browser later."
                : "Your sessions are tied to your account and loaded after login."}
            </div>

            {status && <div className={styles.statusBox}>{status}</div>}
          </div>
        </div>
      </div>
    </main>
  );
}
