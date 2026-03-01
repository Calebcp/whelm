"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  onAuthStateChanged,
} from "firebase/auth";

import { auth } from "@/lib/firebase";
import styles from "./page.module.css";

const EMAIL_STORAGE_KEY = "whelm_email_for_signin";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) router.push("/");
    });

    const href = window.location.href;
    if (!isSignInWithEmailLink(auth, href)) return () => unsub();

    let storedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY) ?? "";
    if (!storedEmail) {
      storedEmail = window.prompt("Confirm your email to finish sign-in:") ?? "";
    }
    if (!storedEmail) return () => unsub();

    setStatus("Signing you in...");

    void signInWithEmailLink(auth, storedEmail, href)
      .then(() => {
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
        router.push("/");
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Sign-in failed.";
        setStatus(message);
      });

    return () => unsub();
  }, [router]);

  async function sendLink() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setStatus("Enter your email first.");
      return;
    }

    setStatus("");
    setSending(true);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const actionCodeSettings = {
      url: `${appUrl}/login`,
      handleCodeInApp: true,
    };

    try {
      await sendSignInLinkToEmail(auth, trimmedEmail, actionCodeSettings);
      window.localStorage.setItem(EMAIL_STORAGE_KEY, trimmedEmail);
      setStatus("Magic link sent. Check your inbox.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to send link.";
      setStatus(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className={styles.pageShell}>
      <div className={styles.heroCard}>
        <div className={styles.brandBlock}>
          <p className={styles.kicker}>WHELM</p>
          <h1 className={styles.title}>Underwhelm the overwhelm.</h1>
          <p className={styles.subtitle}>
            One email. One timer. One completed focus block.
          </p>
        </div>

        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Sign in with a magic link</h2>
            <p className={styles.formCopy}>
              We send one link to your inbox. No password to remember.
            </p>
          </div>

          <div className={styles.fieldBlock}>
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

            <button onClick={sendLink} className={styles.submitButton} disabled={sending}>
              {sending ? "Sending..." : "Send Magic Link"}
            </button>

            <div className={styles.helperText}>
              Open the link on the same device if possible.
            </div>

            {status && <div className={styles.statusBox}>{status}</div>}
          </div>
        </div>
      </div>
    </main>
  );
}
