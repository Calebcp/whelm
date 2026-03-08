import type { Metadata } from "next";

import styles from "./page.module.css";

const LAST_UPDATED = "March 8, 2026";
const CONTACT_EMAIL = "smalltek317@gmail.com";

export const metadata: Metadata = {
  title: "Terms of Use | Whelm Productivity",
  description: "Terms of Use for Whelm Productivity.",
};

export default function TermsPage() {
  return (
    <main className={styles.pageShell}>
      <article className={styles.card}>
        <p className={styles.kicker}>WHELM PRODUCTIVITY</p>
        <h1 className={styles.title}>Terms of Use</h1>
        <p className={styles.updated}>Last updated: {LAST_UPDATED}</p>

        <p>
          These Terms of Use (&quot;Terms&quot;) govern your use of Whelm
          Productivity (&quot;Whelm,&quot; &quot;we,&quot; &quot;our,&quot; or
          &quot;us&quot;). By using Whelm, you agree to these Terms.
        </p>

        <h2>Use of the App</h2>
        <p>
          Whelm provides productivity tools for personal use. You agree to use
          the app lawfully and not to interfere with the app&apos;s operation or
          security.
        </p>

        <h2>Accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account
          credentials and for activity under your account.
        </p>

        <h2>User Content</h2>
        <p>
          You retain ownership of the content you create in Whelm, including
          notes and session data. You grant us a limited right to process and
          store that content solely to operate and improve the service.
        </p>

        <h2>Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the app for illegal or fraudulent activity</li>
          <li>Attempt unauthorized access to systems or accounts</li>
          <li>Upload malicious code or disrupt app functionality</li>
        </ul>

        <h2>Third-Party Services</h2>
        <p>
          Whelm uses third-party providers (including Firebase, Resend, and
          Netlify) to deliver core functionality. Your use of those services may
          also be subject to their terms and policies.
        </p>

        <h2>Service Availability</h2>
        <p>
          We may modify, suspend, or discontinue parts of the app at any time.
          We do not guarantee uninterrupted availability.
        </p>

        <h2>Disclaimers</h2>
        <p>
          Whelm is provided &quot;as is&quot; and &quot;as available&quot; to the
          fullest extent permitted by law, without warranties of any kind.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, Whelm and its operators are not
          liable for indirect, incidental, special, consequential, or punitive
          damages, or any loss of data, profits, or business opportunities.
        </p>

        <h2>Termination</h2>
        <p>
          We may suspend or terminate access if these Terms are violated or if
          needed to protect users or the service.
        </p>

        <h2>Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. Continued use after
          changes become effective means you accept the updated Terms.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these Terms can be sent to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </article>
    </main>
  );
}
