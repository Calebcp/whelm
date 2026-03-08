import type { Metadata } from "next";

import styles from "./page.module.css";

const LAST_UPDATED = "March 8, 2026";
const CONTACT_EMAIL = "smalltek317@gmail.com";

export const metadata: Metadata = {
  title: "Privacy Policy | Whelm Productivity",
  description: "Privacy Policy for Whelm Productivity.",
};

export default function PrivacyPage() {
  return (
    <main className={styles.pageShell}>
      <article className={styles.card}>
        <p className={styles.kicker}>WHELM PRODUCTIVITY</p>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.updated}>Last updated: {LAST_UPDATED}</p>

        <p>
          Whelm Productivity (&quot;Whelm,&quot; &quot;we,&quot; &quot;our,&quot; or
          &quot; us&quot;) respects your privacy. This Privacy Policy explains what
          information we collect, how we use it, and your choices.
        </p>

        <h2>Information We Collect</h2>
        <p>We may collect:</p>
        <ul>
          <li>Name (such as display name)</li>
          <li>Email address</li>
          <li>User ID (account identifier)</li>
          <li>User content (such as notes and session data you create in the app)</li>
          <li>Customer support content (such as feedback messages you send)</li>
        </ul>

        <h2>How We Use Information</h2>
        <p>We use this data to:</p>
        <ul>
          <li>Provide and operate app features</li>
          <li>Authenticate users and secure accounts</li>
          <li>Save and sync your content</li>
          <li>Respond to support and feedback requests</li>
          <li>Maintain and improve app reliability</li>
        </ul>

        <h2>Tracking and Advertising</h2>
        <p>
          Whelm does not use your data for cross-app tracking or third-party
          advertising.
        </p>

        <h2>Third-Party Services</h2>
        <p>We use trusted providers to operate the app, including:</p>
        <ul>
          <li>Firebase (authentication and data storage)</li>
          <li>Resend (support and feedback email delivery)</li>
          <li>Netlify (hosting and infrastructure)</li>
        </ul>
        <p>
          These providers may process data only as needed to provide their
          services.
        </p>

        <h2>Data Retention</h2>
        <p>
          We retain data for as long as needed to provide the service and meet
          legal obligations.
        </p>

        <h2>Data Security</h2>
        <p>
          We use reasonable technical and organizational measures to protect your
          data.
        </p>

        <h2>Children&apos;s Privacy</h2>
        <p>Whelm is not directed to children under 13.</p>

        <h2>Your Choices</h2>
        <p>You may contact us to request account or data-related help.</p>

        <h2>Contact</h2>
        <p>
          If you have privacy questions, contact{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </article>
    </main>
  );
}
