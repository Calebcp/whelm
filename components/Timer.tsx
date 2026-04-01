"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import styles from "./Timer.module.css";

type TimerTheme = {
  accent: string;
  accentSoft: string;
  accentStrong: string;
  ring: string;
};

type FocusIdentity = "timer" | "language" | "school" | "work";

export type TimerSessionContext = {
  sessionId: string;
  sessionType: "focus" | "stopwatch";
  subjectMode: "language" | "school" | "work" | "general";
  targetMinutes: number | null;
  interruptionCount: number;
};

type PersistedTimerState = {
  mode: "countdown" | "stopwatch";
  configuredMinutes: number;
  secondsLeft: number;
  secondsElapsed: number;
  focusIdentity: FocusIdentity;
  note: string;
  sessionContext: TimerSessionContext | null;
  persistedAt: number;
};

const TIMER_PERSISTENCE_KEY = "whelm:active-timer";

const FOCUS_IDENTITIES: Record<
  FocusIdentity,
  {
    label: string;
    entryLabel: string;
    descriptor?: string;
    accent: string;
    accentSoft: string;
    accentStrong: string;
    ring: string;
    glow: string;
    surfaceTop: string;
    surfaceBottom: string;
    pulse: string;
  }
> = {
  timer: {
    label: "Timer",
    entryLabel: "TIMER",
    descriptor: "Default",
    accent: "#6c5ce7",
    accentSoft: "#e2dcff",
    accentStrong: "#342a7a",
    ring: "rgba(129, 140, 248, 0.18)",
    glow: "rgba(129, 140, 248, 0.32)",
    surfaceTop: "rgba(32, 31, 72, 0.96)",
    surfaceBottom: "rgba(17, 18, 44, 0.96)",
    pulse: "rgba(165, 180, 252, 0.95)",
  },
  language: {
    label: "Language",
    entryLabel: "LANGUAGE",
    accent: "#d8a125",
    accentSoft: "#f7ecd0",
    accentStrong: "#8f5b0d",
    ring: "rgba(244, 191, 78, 0.18)",
    glow: "rgba(245, 196, 93, 0.34)",
    surfaceTop: "rgba(46, 34, 16, 0.96)",
    surfaceBottom: "rgba(24, 18, 8, 0.96)",
    pulse: "rgba(252, 211, 77, 0.95)",
  },
  school: {
    label: "School",
    entryLabel: "SCHOOL",
    accent: "#4d8eff",
    accentSoft: "#dce9ff",
    accentStrong: "#1e4ea8",
    ring: "rgba(96, 165, 250, 0.18)",
    glow: "rgba(96, 165, 250, 0.3)",
    surfaceTop: "rgba(18, 34, 62, 0.96)",
    surfaceBottom: "rgba(11, 20, 40, 0.96)",
    pulse: "rgba(96, 165, 250, 0.95)",
  },
  work: {
    label: "Work",
    entryLabel: "WORK",
    accent: "#d35555",
    accentSoft: "#f9d7d7",
    accentStrong: "#8d2424",
    ring: "rgba(248, 113, 113, 0.18)",
    glow: "rgba(239, 68, 68, 0.28)",
    surfaceTop: "rgba(56, 19, 23, 0.97)",
    surfaceBottom: "rgba(28, 10, 14, 0.97)",
    pulse: "rgba(248, 113, 113, 0.95)",
  },
};

const TIMER_WHELM_ROTATION = [
  {
    src: "/timer-whelms/yellow_whelm_leaning_watch-removebg-preview.png",
    alt: "Whelm leaning with a stopwatch",
  },
  {
    src: "/timer-whelms/yellow_whelm_looking_at_watch-removebg-preview.png",
    alt: "Whelm looking at a stopwatch",
  },
  {
    src: "/timer-whelms/yellow_whelm_lifting_watch-removebg-preview.png",
    alt: "Whelm lifting a stopwatch",
  },
  {
    src: "/timer-whelms/yellow_whelm_running_watch-removebg-preview.png",
    alt: "Whelm running with a stopwatch",
  },
  {
    src: "/timer-whelms/yellow_whelm_flying_watch-removebg-preview.png",
    alt: "Whelm flying with a stopwatch",
  },
] as const;

export default function Timer({
  minutes = 30,
  title,
  subtitle,
  actionLabel,
  theme,
  appearance = "dark",
  onComplete,
  onSessionStart,
  onSessionAbandon,
  sessionNoteCount = 0,
  onOpenSessionNotes,
  streakMinimumMinutes = 30,
  isPro = false,
  showHeaderCopy = true,
  showStreakHint = true,
}: {
  minutes?: number;
  title: string;
  subtitle?: string;
  actionLabel: string;
  theme: TimerTheme;
  appearance?: "dark" | "light";
  onComplete: (
    note: string,
    minutesSpent: number,
    sessionContext?: TimerSessionContext,
  ) => Promise<void> | void;
  onSessionStart?: (context: TimerSessionContext) => Promise<void> | void;
  onSessionAbandon?: (
    context: TimerSessionContext & {
      elapsedMinutes: number;
      abandonReason: "reset" | "route_change" | "component_unmount" | "unknown";
    },
  ) => Promise<void> | void;
  sessionNoteCount?: number;
  onOpenSessionNotes?: () => void;
  streakMinimumMinutes?: number;
  isPro?: boolean;
  showHeaderCopy?: boolean;
  showStreakHint?: boolean;
}) {
  const [mode, setMode] = useState<"countdown" | "stopwatch">("countdown");
  const [configuredMinutes, setConfiguredMinutes] = useState(minutes);
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showNotebook, setShowNotebook] = useState(false);
  const [showNotebookMenu, setShowNotebookMenu] = useState(false);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const [note, setNote] = useState("");
  const [focusIdentity, setFocusIdentity] = useState<FocusIdentity>("timer");
  const [entryModeLabel, setEntryModeLabel] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const [pauseNotice, setPauseNotice] = useState<string | null>(null);
  const [activeWhelmIndex, setActiveWhelmIndex] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const entryTimeoutRef = useRef<number | null>(null);
  const sessionContextRef = useRef<TimerSessionContext | null>(null);
  const runningRef = useRef(running);
  const modeRef = useRef(mode);
  const configuredMinutesRef = useRef(configuredMinutes);
  const secondsLeftRef = useRef(secondsLeft);
  const secondsElapsedRef = useRef(secondsElapsed);
  const focusIdentityRef = useRef(focusIdentity);
  const noteRef = useRef(note);
  const shouldPersistOnUnmountRef = useRef(true);
  const isRestoringPersistedTimerRef = useRef(false);

  const identityTheme = FOCUS_IDENTITIES[focusIdentity];

  function clearPersistedTimer() {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(TIMER_PERSISTENCE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }

  function persistActiveTimer() {
    if (typeof window === "undefined" || !runningRef.current) return;
    try {
      const snapshot: PersistedTimerState = {
        mode: modeRef.current,
        configuredMinutes: configuredMinutesRef.current,
        secondsLeft: secondsLeftRef.current,
        secondsElapsed: secondsElapsedRef.current,
        focusIdentity: focusIdentityRef.current,
        note: noteRef.current,
        sessionContext: sessionContextRef.current,
        persistedAt: Date.now(),
      };
      window.sessionStorage.setItem(TIMER_PERSISTENCE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore storage failures.
    }
  }

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    configuredMinutesRef.current = configuredMinutes;
  }, [configuredMinutes]);

  useEffect(() => {
    secondsLeftRef.current = secondsLeft;
  }, [secondsLeft]);

  useEffect(() => {
    secondsElapsedRef.current = secondsElapsed;
  }, [secondsElapsed]);

  useEffect(() => {
    focusIdentityRef.current = focusIdentity;
  }, [focusIdentity]);

  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.sessionStorage.getItem(TIMER_PERSISTENCE_KEY);
      if (!raw) return;
      const snapshot = JSON.parse(raw) as PersistedTimerState;
      if (!snapshot || typeof snapshot.persistedAt !== "number") return;

      const elapsedSincePersistSeconds = Math.max(0, Math.floor((Date.now() - snapshot.persistedAt) / 1000));
      const restoredSecondsLeft =
        snapshot.mode === "countdown"
          ? Math.max(0, snapshot.secondsLeft - elapsedSincePersistSeconds)
          : snapshot.secondsLeft;
      const restoredSecondsElapsed =
        snapshot.mode === "stopwatch"
          ? snapshot.secondsElapsed + elapsedSincePersistSeconds
          : snapshot.secondsElapsed;

      setMode(snapshot.mode);
      setConfiguredMinutes(snapshot.configuredMinutes);
      setSecondsLeft(restoredSecondsLeft);
      setSecondsElapsed(restoredSecondsElapsed);
      setFocusIdentity(snapshot.focusIdentity);
      setNote(snapshot.note);
      sessionContextRef.current = snapshot.sessionContext;
      setDone(snapshot.mode === "countdown" && restoredSecondsLeft === 0);
      isRestoringPersistedTimerRef.current = true;
      setRunning(snapshot.mode === "countdown" ? restoredSecondsLeft > 0 : true);
      setPauseNotice(null);
    } catch {
      // Ignore malformed snapshots and start clean.
    } finally {
      clearPersistedTimer();
    }
  }, []);

  useEffect(() => {
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    setIsVisible(typeof document === "undefined" ? true : document.visibilityState === "visible");

    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    function handleVisibilityChange() {
      const nextVisible = document.visibilityState === "visible";
      shouldPersistOnUnmountRef.current = nextVisible;
      setIsVisible(nextVisible);
    }

    function handlePageHide() {
      shouldPersistOnUnmountRef.current = false;
      clearPersistedTimer();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  useEffect(() => {
    if (isRestoringPersistedTimerRef.current) {
      isRestoringPersistedTimerRef.current = false;
      return;
    }
    if (mode === "countdown") {
      setSecondsLeft(configuredMinutes * 60);
    } else {
      setSecondsElapsed(0);
    }
    setRunning(false);
    setDone(false);
  }, [configuredMinutes, mode]);

  useEffect(() => {
    if (!running) {
      clearPersistedTimer();
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      if (mode === "countdown") {
        setSecondsLeft((previous) => {
          if (previous <= 1) {
            setRunning(false);
            setDone(true);
            return 0;
          }

          return previous - 1;
        });
      } else {
        setSecondsElapsed((previous) => previous + 1);
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [mode, running]);

  useEffect(() => {
    if (!running) return;
    if (isOnline && isVisible) return;

    clearPersistedTimer();
    setRunning(false);
    setPauseNotice(
      !isOnline
        ? "Timer paused because the app went offline."
        : "Timer paused because the app left the foreground.",
    );
    if (sessionContextRef.current) {
      sessionContextRef.current = {
        ...sessionContextRef.current,
        interruptionCount: sessionContextRef.current.interruptionCount + 1,
      };
    }
  }, [isOnline, isVisible, running]);

  useEffect(() => {
    return () => {
      if (entryTimeoutRef.current) {
        window.clearTimeout(entryTimeoutRef.current);
      }
      const activeSession = sessionContextRef.current;
      const canPersistAcrossUnmount =
        runningRef.current &&
        shouldPersistOnUnmountRef.current &&
        typeof document !== "undefined" &&
        document.visibilityState === "visible";
      if (canPersistAcrossUnmount) {
        persistActiveTimer();
        return;
      }
      clearPersistedTimer();
      if (activeSession) {
        void onSessionAbandon?.({
          ...activeSession,
          elapsedMinutes: calculateMinutesSpent(),
          abandonReason: "component_unmount",
        });
      }
    };
  }, [onSessionAbandon]);

  useEffect(() => {
    if (!running || !isPro) {
      setActiveWhelmIndex(0);
      return;
    }

    const syncRotation = () => {
      const bucket = Math.floor(Date.now() / 300000);
      setActiveWhelmIndex(bucket % TIMER_WHELM_ROTATION.length);
    };

    syncRotation();
    const delayToBoundary = 300000 - (Date.now() % 300000);
    let rotationId: number | null = null;
    const timeoutId = window.setTimeout(() => {
      syncRotation();
      rotationId = window.setInterval(syncRotation, 300000);
    }, delayToBoundary);

    return () => {
      window.clearTimeout(timeoutId);
      if (rotationId) window.clearInterval(rotationId);
    };
  }, [isPro, running]);

  const displaySeconds = mode === "countdown" ? secondsLeft : secondsElapsed;
  const mm = Math.floor(displaySeconds / 60);
  const ss = displaySeconds % 60;
  const totalCountdownSeconds = configuredMinutes * 60;
  const progress =
    mode === "countdown"
      ? totalCountdownSeconds === 0
        ? 0
        : (totalCountdownSeconds - secondsLeft) / totalCountdownSeconds
      : (secondsElapsed % 60) / 60;

  function reset() {
    clearPersistedTimer();
    const activeSession = sessionContextRef.current;
    if (activeSession && (running || done)) {
      void onSessionAbandon?.({
        ...activeSession,
        elapsedMinutes: calculateMinutesSpent(),
        abandonReason: "reset",
      });
    }

    setRunning(false);
    setDone(false);
    if (mode === "countdown") {
      setSecondsLeft(configuredMinutes * 60);
    } else {
      setSecondsElapsed(0);
    }
    setShowNotebook(false);
    setShowNotebookMenu(false);
    setShowTimerSettings(false);
    setNote("");
    setPauseNotice(null);
    sessionContextRef.current = null;
  }

  function calculateMinutesSpent() {
    const elapsedSeconds =
      modeRef.current === "countdown"
        ? configuredMinutesRef.current * 60 - secondsLeftRef.current
        : secondsElapsedRef.current;

    return Math.max(1, Math.ceil(elapsedSeconds / 60));
  }

  async function handleComplete() {
    clearPersistedTimer();
    setSubmitting(true);

    try {
      await onComplete(note.trim(), calculateMinutesSpent(), sessionContextRef.current ?? undefined);
      sessionContextRef.current = null;
      reset();
    } finally {
      setSubmitting(false);
    }
  }

  function openNotebook() {
    setRunning(false);
    setShowNotebookMenu(false);
    setShowNotebook(true);
  }

  function openNotebookMenu() {
    setRunning(false);
    setShowNotebookMenu((current) => !current);
  }

  function startSession() {
    if (!isOnline) {
      setPauseNotice("Timer works only while you are online.");
      return;
    }
    if (!isVisible) {
      setPauseNotice("Bring the app back into view to run the timer.");
      return;
    }
    if (entryTimeoutRef.current) {
      window.clearTimeout(entryTimeoutRef.current);
    }

    const existingSession = sessionContextRef.current;
    const sessionContext =
      existingSession && !done
        ? existingSession
        : ({
            sessionId:
              typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `${Date.now()}`,
            sessionType: mode === "countdown" ? "focus" : "stopwatch",
            subjectMode: focusIdentity === "timer" ? "general" : focusIdentity,
            targetMinutes: mode === "countdown" ? configuredMinutes : null,
            interruptionCount: 0,
          } satisfies TimerSessionContext);

    sessionContextRef.current = sessionContext;
    shouldPersistOnUnmountRef.current = true;
    setEntryModeLabel(identityTheme.entryLabel);
    setPauseNotice(null);
    setRunning(true);
    clearPersistedTimer();
    if (!existingSession || done) {
      void onSessionStart?.(sessionContext);
    }
    entryTimeoutRef.current = window.setTimeout(() => {
      setEntryModeLabel(null);
      entryTimeoutRef.current = null;
    }, 650);
  }

  const timerFaceLabel = mode === "countdown" ? "Countdown" : "Stopwatch";
  const timerFigure = isPro ? TIMER_WHELM_ROTATION[activeWhelmIndex] : TIMER_WHELM_ROTATION[0];

  const themeVars = {
    "--timer-accent": identityTheme.accent ?? theme.accent,
    "--timer-accent-soft": identityTheme.accentSoft ?? theme.accentSoft,
    "--timer-accent-strong": identityTheme.accentStrong ?? theme.accentStrong,
    "--timer-ring": identityTheme.ring ?? theme.ring,
    "--timer-glow": identityTheme.glow,
    "--timer-surface-top": identityTheme.surfaceTop,
    "--timer-surface-bottom": identityTheme.surfaceBottom,
    "--timer-pulse": identityTheme.pulse,
    "--timer-progress": `${Math.max(0, Math.min(1, progress))}`,
    "--timer-progress-turn": `${Math.max(0, Math.min(1, progress))}turn`,
  } as CSSProperties;

  return (
    <section
      className={styles.card}
      data-tour="today-timer"
      style={themeVars}
      data-appearance={appearance}
      data-focus-mode={focusIdentity}
    >
      <div className={styles.header}>
        <div>
          {showHeaderCopy ? <p className={styles.kicker}>Whelm Focus Modes</p> : null}
          <h2 className={styles.title}>{title}</h2>
          {showStreakHint && !running && !done && mode === "countdown" && (
            <p className={styles.streakHint}>{streakMinimumMinutes}m protects today&apos;s streak.</p>
          )}
        </div>
      </div>

      <div className={styles.modeRow}>
        <div className={styles.modeTabs}>
          <button
            type="button"
            onClick={() => setMode("countdown")}
            className={`${styles.modeTab} ${
              mode === "countdown" ? styles.modeTabActive : ""
            }`}
          >
            Countdown
          </button>
          <button
            type="button"
            onClick={() => setMode("stopwatch")}
            className={`${styles.modeTab} ${
              mode === "stopwatch" ? styles.modeTabActive : ""
            }`}
          >
            Stopwatch
          </button>
        </div>
      </div>

      <div className={styles.timerFace} data-focus-mode={focusIdentity}>
        <div className={styles.faceSettingsWrap}>
          <button
            type="button"
            className={styles.faceSettingsButton}
            onClick={() => setShowTimerSettings((current) => !current)}
            disabled={running || submitting}
            aria-label="Open timer settings"
            aria-expanded={showTimerSettings}
          >
            <span />
            <span />
            <span />
          </button>

          {showTimerSettings && (
            <div className={styles.faceSettingsMenu}>
              {mode === "countdown" && (
                <label className={styles.faceMinutesPicker}>
                  <span>Minutes</span>
                  <input
                    type="number"
                    min={1}
                    max={480}
                    value={configuredMinutes}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (Number.isFinite(next)) {
                        setConfiguredMinutes(Math.min(480, Math.max(1, next)));
                      }
                    }}
                    disabled={running}
                  />
                </label>
              )}

              <div className={styles.faceIdentityGroup}>
                <p className={styles.faceSettingsLabel}>Focus Mode</p>
                <div className={styles.faceIdentityOptions}>
                  {(
                    Object.entries(FOCUS_IDENTITIES) as Array<
                      [FocusIdentity, (typeof FOCUS_IDENTITIES)[FocusIdentity]]
                    >
                  ).map(([identityKey, identity]) => (
                    <button
                      key={identityKey}
                      type="button"
                      className={`${styles.settingsMenuButton} ${
                        focusIdentity === identityKey ? styles.settingsMenuButtonActive : ""
                      }`}
                      onClick={() => {
                        setFocusIdentity(identityKey);
                        setShowTimerSettings(false);
                      }}
                    >
                      <span>{identity.label}</span>
                      {identity.descriptor ? <span>{identity.descriptor}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className={styles.faceAura} aria-hidden="true" />
        <div className={styles.faceGrid} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className={styles.faceHalo} aria-hidden="true" />
        <div className={styles.ringTrack} aria-hidden="true" />
        <div className={styles.ringProgress} aria-hidden="true" />
        <div className={styles.ringPulse} aria-hidden="true" />
        {entryModeLabel && (
          <div className={styles.entryOverlay}>
            <span className={styles.entryEyebrow}>Entering</span>
            <strong className={styles.entryMode}>{entryModeLabel} mode</strong>
          </div>
        )}
        <div className={styles.faceInner}>
          <p className={styles.faceLabel}>{timerFaceLabel}</p>
          <p className={styles.identityAnchor}>{identityTheme.entryLabel}</p>
          <div className={styles.time}>
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </div>
          <div className={styles.faceWhelm}>
            {isPro ? (
              <div className={`${styles.faceWhelmFigure} ${running ? styles.faceWhelmFigurePulse : ""}`}>
                <img src={timerFigure.src} alt={timerFigure.alt} className={styles.faceWhelmImage} />
              </div>
            ) : (
              <div className={styles.faceWhelmFigure}>
                <img src={timerFigure.src} alt={timerFigure.alt} className={styles.faceWhelmImage} />
              </div>
            )}
          </div>
          {!running && isPro ? (
            <p className={styles.whelmRotationHint}>Every five minutes: a new Whelm stays with you.</p>
          ) : null}
        </div>
        <div className={styles.faceDock}>
          {!running && !done ? (
            <button onClick={startSession} className={styles.faceDockPrimaryButton}>
              {sessionContextRef.current ? "Resume" : "Start"}
            </button>
          ) : running ? (
            <button
              onClick={() => {
                clearPersistedTimer();
                setRunning(false);
                if (sessionContextRef.current) {
                  sessionContextRef.current = {
                    ...sessionContextRef.current,
                    interruptionCount: sessionContextRef.current.interruptionCount + 1,
                  };
                }
              }}
              className={styles.faceDockPrimaryButton}
            >
              Pause
            </button>
          ) : (
            <button onClick={handleComplete} className={styles.faceDockPrimaryButton} disabled={submitting}>
              {submitting ? "Saving..." : actionLabel}
            </button>
          )}

          <button onClick={reset} className={styles.faceDockButton}>
            Reset
          </button>

          <div className={styles.faceDockNoteWrap}>
            <button
              onClick={openNotebookMenu}
              className={styles.faceDockButton}
              disabled={submitting}
            >
              Session note
              {sessionNoteCount > 0 && <span className={styles.faceDockBadge}>{sessionNoteCount}</span>}
            </button>
            {showNotebookMenu && (
              <div className={styles.faceDockMenu}>
                <button type="button" className={styles.faceDockMenuButton} onClick={openNotebook}>
                  New note
                </button>
                <button
                  type="button"
                  className={styles.faceDockMenuButton}
                  onClick={() => {
                    setShowNotebookMenu(false);
                    onOpenSessionNotes?.();
                  }}
                >
                  See notes
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {(done || showNotebook) && (
        <div className={styles.notebook}>
          <div className={styles.notebookHeader}>
            <h3 className={styles.notebookTitle}>Session notebook</h3>
            <p className={styles.notebookCopy}>
              Write what this focus block was for. It will be saved with a timestamp.
            </p>
          </div>

          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What did you work on? What mattered in this session?"
            className={styles.notebookInput}
            rows={4}
          />

          <div className={styles.notebookActions}>
            <button
              onClick={handleComplete}
              className={styles.completeButton}
              disabled={submitting}
            >
              {submitting ? "Saving..." : actionLabel}
            </button>
            <button
              onClick={() => setShowNotebook(false)}
              className={styles.secondaryButton}
              disabled={submitting}
            >
              Keep editing later
            </button>
          </div>
        </div>
      )}

    </section>
  );
}
