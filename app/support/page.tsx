import type { Metadata } from "next";

import styles from "../privacy/page.module.css";

const CONTACT_EMAIL = "smalltek317@gmail.com";
const LAST_UPDATED = "April 23, 2026";

export const metadata: Metadata = {
  title: "Support | Whelm Productivity",
  description: "Support information for Whelm Productivity.",
};

export default function SupportPage() {
  return (
    <main className={styles.pageShell}>
      <article className={styles.card}>
        <p className={styles.kicker}>WHELM PRODUCTIVITY</p>
        <h1 className={styles.title}>Support</h1>
        <p className={styles.updated}>Last updated: {LAST_UPDATED}</p>

        <p>
          If you need help with Whelm Productivity, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>What to Include</h2>
        <ul>
          <li>The email address on your Whelm account</li>
          <li>Your device model and iOS version</li>
          <li>A short description of the issue or question</li>
          <li>Screenshots if something looks incorrect</li>
        </ul>

        <h2>Common Help Topics</h2>
        <ul>
          <li>Account sign-in or access issues</li>
          <li>Subscription questions, restores, and billing guidance</li>
          <li>Notes, sessions, or history behavior</li>
          <li>Bug reports and feature feedback</li>
        </ul>

        <h2>Policy Links</h2>
        <p>
          Privacy Policy: <a href="/privacy">whelmproductivity.com/privacy</a>
        </p>
        <p>
          Terms of Use: <a href="/terms">whelmproductivity.com/terms</a>
        </p>
      </article>
    </main>
  );
}
