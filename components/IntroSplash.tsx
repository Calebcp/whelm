"use client";

import styles from "@/app/page.module.css";

export default function IntroSplash({ onComplete }: { onComplete: () => void }) {
  return (
    <main className={styles.splashScreen}>
      <div className={styles.splashOrb} aria-hidden="true" />
      <div className={styles.splashFrame}>
        <div className={styles.splashAnimationShell}>
          <div className={styles.splashAnimation}>
            <video
              className={styles.splashVideo}
              autoPlay
              muted
              playsInline
              preload="auto"
              aria-label="Whelm intro animation"
              onEnded={onComplete}
            >
              <source src="/intro/twosecappicon.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
        <p className={styles.splashWordmark}>WHELM</p>
        <p className={styles.splashCaption}>Build momentum before the day gets loud.</p>
      </div>
    </main>
  );
}
