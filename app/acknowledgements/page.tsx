import type { Metadata } from "next";

import styles from "../privacy/page.module.css";

export const metadata: Metadata = {
  title: "Acknowledgements | Whelm Productivity",
  description: "Acknowledgements for Whelm Productivity.",
};

const ACKNOWLEDGEMENTS = [
  {
    name: "Next.js",
    body: "The application framework used to build the Whelm web app.",
  },
  {
    name: "React",
    body: "The UI library powering Whelm’s interactive interface.",
  },
  {
    name: "Firebase",
    body: "Authentication, storage, and sync infrastructure for Whelm accounts and data.",
  },
  {
    name: "Capacitor",
    body: "The bridge used to package and run Whelm as a mobile app.",
  },
  {
    name: "RevenueCat",
    body: "Subscription management and entitlement infrastructure for Whelm Pro.",
  },
  {
    name: "Resend",
    body: "Email delivery for support and feedback flows.",
  },
];

export default function AcknowledgementsPage() {
  return (
    <main className={styles.pageShell}>
      <article className={styles.card}>
        <p className={styles.kicker}>WHELM PRODUCTIVITY</p>
        <h1 className={styles.title}>Acknowledgements</h1>
        <p className={styles.updated}>
          Whelm is built on the work of tools and platforms that make the product possible.
        </p>

        {ACKNOWLEDGEMENTS.map((item) => (
          <section key={item.name}>
            <h2>{item.name}</h2>
            <p>{item.body}</p>
          </section>
        ))}
      </article>
    </main>
  );
}
