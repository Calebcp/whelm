"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";

import Timer from "@/components/Timer";
import { auth } from "@/lib/firebase";
import {
  loadNotes,
  retryNotesSync,
  saveNotes,
  type WorkspaceNote,
} from "@/lib/notes-store";
import { loadSessions, saveSession } from "@/lib/session-store";
import { computeStreak, type SessionDoc } from "@/lib/streak";
import styles from "./page.module.css";

const FOCUS_TIMER = {
  title: "Multipurpose focus timer",
  subtitle: "Use countdown or stopwatch for any work",
  actionLabel: "Save Session",
  badgeLabel: "Focus",
  theme: {
    accent: "#145da0",
    accentSoft: "#e7f1fc",
    accentStrong: "#0d3b66",
    ring: "rgba(20, 93, 160, 0.18)",
  },
};

const NOTE_COLORS: Array<{ label: string; value: string }> = [
  { label: "Cherry", value: "#fecaca" },
  { label: "Rose", value: "#fda4af" },
  { label: "Tangerine", value: "#fed7aa" },
  { label: "Amber", value: "#fcd34d" },
  { label: "Sun", value: "#fef08a" },
  { label: "Lime", value: "#d9f99d" },
  { label: "Mint", value: "#bbf7d0" },
  { label: "Emerald", value: "#6ee7b7" },
  { label: "Aqua", value: "#a5f3fc" },
  { label: "Sky", value: "#bae6fd" },
  { label: "Blue", value: "#bfdbfe" },
  { label: "Indigo", value: "#c7d2fe" },
  { label: "Violet", value: "#ddd6fe" },
  { label: "Purple", value: "#e9d5ff" },
  { label: "Fuchsia", value: "#f5d0fe" },
  { label: "Pink", value: "#fbcfe8" },
  { label: "Stone", value: "#e7e5e4" },
  { label: "Slate", value: "#cbd5e1" },
  { label: "Cloud", value: "#f1f5f9" },
  { label: "Paper", value: "#f8fafc" },
];

type FeedbackCategory = "bug" | "feature" | "other";
type WorkspaceView = "focus" | "notes";

function createNote(): WorkspaceNote {
  const now = new Date().toISOString();
  return {
    id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`,
    title: "Untitled note",
    body: "",
    color: "#e7e5e4",
    fontFamily: "Avenir Next",
    fontSizePx: 16,
    createdAtISO: now,
    updatedAtISO: now,
  };
}

function decodeHtmlEntities(value: string) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function normalizeBodyForEditor(body: string) {
  if (!body) return "";

  let next = body;
  const hasHtmlTags = /<[a-z!/]/i.test(next);
  if (!hasHtmlTags) {
    next = next.replaceAll("\n", "<br/>");
  }

  // Migrate legacy notes that ended up double-escaped (e.g. "&amp;nbsp;").
  for (let i = 0; i < 3; i += 1) {
    const decoded = decodeHtmlEntities(next);
    if (decoded === next) break;
    next = decoded;
  }

  return next;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [notes, setNotes] = useState<WorkspaceNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [editorBodyDraft, setEditorBodyDraft] = useState("");
  const [notesSyncStatus, setNotesSyncStatus] = useState<
    "synced" | "local-only" | "syncing"
  >("syncing");
  const [notesSyncMessage, setNotesSyncMessage] = useState("");
  const [activeView, setActiveView] = useState<WorkspaceView>("focus");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const streak = computeStreak(sessions);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setSessions([]);
        setNotes([]);
        setSelectedNoteId(null);
        setAuthChecked(true);
        router.push("/login");
        return;
      }

      setUser(nextUser);
      try {
        await Promise.all([refreshSessions(nextUser.uid), refreshNotes(nextUser.uid)]);
      } finally {
        setAuthChecked(true);
      }
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    function onOnline() {
      if (!user || notes.length === 0) return;
      void handleRetrySync();
    }

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [notes, user]);

  useEffect(() => {
    setColorPickerOpen(false);
  }, [selectedNoteId]);

  useEffect(() => {
    const nextHtml = selectedNote ? normalizeBodyForEditor(selectedNote.body) : "";
    setEditorBodyDraft(nextHtml);
  }, [selectedNote, selectedNoteId]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (document.activeElement === editorRef.current) return;

    if (editorRef.current.innerHTML !== editorBodyDraft) {
      editorRef.current.innerHTML = editorBodyDraft;
    }
  }, [editorBodyDraft, selectedNoteId]);

  async function refreshSessions(uid: string) {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== uid) {
      throw new Error("Your login session is missing. Sign in again.");
    }

    setSessions(await loadSessions(currentUser));
  }

  async function refreshNotes(uid: string) {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== uid) {
      throw new Error("Your login session is missing. Sign in again.");
    }

    const result = await loadNotes(currentUser);
    setNotes(result.notes);
    setSelectedNoteId((current) => current ?? result.notes[0]?.id ?? null);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }

  async function completeSession(note: string, minutesSpent: number) {
    if (!user) return;

    const now = new Date().toISOString();
    const session: SessionDoc = {
      uid: user.uid,
      completedAtISO: now,
      minutes: minutesSpent,
      category: "misc",
      note: note.trim(),
      noteSavedAtISO: now,
    };

    const nextSessions = await saveSession(user, session);
    setSessions(nextSessions);
  }

  async function createWorkspaceNote() {
    if (!user) return;

    const nextNote = createNote();
    const nextNotes = [nextNote, ...notes];
    setNotes(nextNotes);
    setSelectedNoteId(nextNote.id);
    setActiveView("notes");
    const result = await saveNotes(user, nextNotes);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }

  async function updateSelectedNote(
    patch: Partial<
      Pick<WorkspaceNote, "title" | "body" | "color" | "fontFamily" | "fontSizePx">
    >,
  ) {
    if (!user || !selectedNote) return;

    const now = new Date().toISOString();
    const nextNotes = notes.map((note) =>
      note.id === selectedNote.id ? { ...note, ...patch, updatedAtISO: now } : note,
    );
    setNotes(nextNotes);
    const result = await saveNotes(user, nextNotes);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }

  useEffect(() => {
    if (!selectedNote) return;
    if (editorBodyDraft === selectedNote.body) return;

    const timeoutId = window.setTimeout(() => {
      void updateSelectedNote({ body: editorBodyDraft });
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [editorBodyDraft, selectedNote]);

  function captureEditorDraft() {
    if (!editorRef.current) return;
    setEditorBodyDraft(editorRef.current.innerHTML);
  }

  function saveEditorSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
      return;
    }

    savedSelectionRef.current = range.cloneRange();
  }

  function restoreEditorSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const savedRange = savedSelectionRef.current;
    if (!editor || !selection || !savedRange) return false;
    if (!editor.contains(savedRange.startContainer) || !editor.contains(savedRange.endContainer)) {
      return false;
    }

    editor.focus();
    selection.removeAllRanges();
    selection.addRange(savedRange);
    return true;
  }

  function applyEditorCommand(command: string, value?: string) {
    if (!selectedNote) return;
    if (!restoreEditorSelection()) {
      editorRef.current?.focus();
    }
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);
    saveEditorSelection();
    captureEditorDraft();
  }

  async function deleteNote(noteId: string) {
    if (!user) return;

    const nextNotes = notes.filter((note) => note.id !== noteId);
    setNotes(nextNotes);
    setSelectedNoteId((current) => (current === noteId ? nextNotes[0]?.id ?? null : current));
    const result = await saveNotes(user, nextNotes);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }

  async function handleRetrySync() {
    if (!user) return;
    setNotesSyncStatus("syncing");
    const result = await retryNotesSync(user, notes);

    if (result.synced) {
      setNotesSyncStatus("synced");
      setNotesSyncMessage("");
    } else {
      setNotesSyncStatus("local-only");
      setNotesSyncMessage(result.message ?? "Retry failed.");
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
            <h1 className={styles.title}>
              {activeView === "focus" ? "Focus. No Distractions." : "Capture. Stay Sharp."}
            </h1>
            <p className={styles.subtitle}>
              {activeView === "focus"
                ? "One task. Full attention."
                : "Think clearly. Keep your notes ready."}
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.menuButton}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              ☰
            </button>
            <button onClick={() => signOut(auth)} className={styles.signOutButton}>
              Sign out
            </button>
          </div>
        </header>

        <nav className={`${styles.topNav} ${mobileMenuOpen ? styles.topNavOpen : ""}`}>
          <button
            type="button"
            className={`${styles.topNavButton} ${
              activeView === "focus" ? styles.topNavButtonActive : ""
            }`}
            onClick={() => {
              setActiveView("focus");
              setMobileMenuOpen(false);
            }}
          >
            Focus
          </button>
          <button
            type="button"
            className={`${styles.topNavButton} ${
              activeView === "notes" ? styles.topNavButtonActive : ""
            }`}
            onClick={() => {
              setActiveView("notes");
              setMobileMenuOpen(false);
            }}
          >
            Notes
          </button>
          <button type="button" className={styles.topNavAction} onClick={createWorkspaceNote}>
            + Add Note
          </button>
        </nav>

        {activeView === "focus" ? (
          <>
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
                        FOCUS_TIMER.badgeLabel
                      }`
                    : "Not yet started"}
                </strong>
              </article>
            </section>

            <section className={styles.mainGrid}>
              <div className={styles.timersGrid}>
                <Timer
                  minutes={25}
                  title={FOCUS_TIMER.title}
                  subtitle={FOCUS_TIMER.subtitle}
                  actionLabel={FOCUS_TIMER.actionLabel}
                  theme={FOCUS_TIMER.theme}
                  onComplete={(note, minutesSpent) => completeSession(note, minutesSpent)}
                />
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
                      <div
                        key={`${session.completedAtISO}-${index}`}
                        className={styles.sessionItem}
                      >
                        <div>
                          <div className={styles.sessionPrimary}>
                            {new Date(session.completedAtISO).toLocaleString()}
                          </div>
                          <div className={styles.sessionSecondary}>
                            <span
                              className={styles.categoryBadge}
                              style={{
                                backgroundColor: FOCUS_TIMER.theme.accentSoft,
                                color: FOCUS_TIMER.theme.accentStrong,
                              }}
                            >
                              {FOCUS_TIMER.badgeLabel}
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
                        No sessions yet. Start your timer and save your first focus block.
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </section>
          </>
        ) : (
          <section className={styles.notesWorkspace}>
            <aside className={styles.notesSidebar}>
              <button
                type="button"
                className={styles.newNoteButton}
                onClick={createWorkspaceNote}
              >
                + Add Note
              </button>

              <div className={styles.noteList}>
                {notes.map((note) => (
                  <button
                    type="button"
                    key={note.id}
                    className={`${styles.noteListItem} ${
                      selectedNoteId === note.id ? styles.noteListItemActive : ""
                    }`}
                    style={{ backgroundColor: note.color || "#f8fafc" }}
                    onClick={() => setSelectedNoteId(note.id)}
                  >
                    <span className={styles.noteListTitle}>{note.title || "Untitled note"}</span>
                    <span className={styles.noteListMeta}>
                      {new Date(note.updatedAtISO).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <article className={styles.notesEditorCard}>
              {!selectedNote ? (
                <div className={styles.notesEmptyEditor}>
                  <p>Start by creating your first note.</p>
                </div>
              ) : (
                <>
                  <div className={styles.noteColorRow}>
                    <button
                      type="button"
                      className={styles.noteColorPickerTrigger}
                      onClick={() => setColorPickerOpen((open) => !open)}
                    >
                      <span
                        className={styles.noteColorPickerPreview}
                        style={{ backgroundColor: selectedNote.color || "#e7e5e4" }}
                      />
                      Note color
                    </button>

                    {colorPickerOpen && (
                      <div className={styles.noteColorPickerPopover}>
                        {NOTE_COLORS.map((color) => (
                          <button
                            type="button"
                            key={color.value}
                            className={`${styles.noteColorSwatch} ${
                              selectedNote.color === color.value
                                ? styles.noteColorSwatchActive
                                : ""
                            }`}
                            style={{ backgroundColor: color.value }}
                            title={color.label}
                            onClick={() => {
                              void updateSelectedNote({ color: color.value });
                              setColorPickerOpen(false);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.noteEditorToolbar}>
                    <button
                      type="button"
                      className={styles.noteToolButton}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        saveEditorSelection();
                      }}
                      onClick={() => applyEditorCommand("bold")}
                    >
                      Bold
                    </button>
                    <button
                      type="button"
                      className={styles.noteToolButton}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        saveEditorSelection();
                      }}
                      onClick={() => applyEditorCommand("italic")}
                    >
                      Italic
                    </button>
                    <button
                      type="button"
                      className={styles.noteToolButton}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        saveEditorSelection();
                      }}
                      onClick={() => applyEditorCommand("underline")}
                    >
                      Underline
                    </button>
                    <button
                      type="button"
                      className={styles.noteToolButton}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        saveEditorSelection();
                      }}
                      onClick={() => applyEditorCommand("insertUnorderedList")}
                    >
                      List
                    </button>

                    <select
                      className={styles.noteToolSelect}
                      value={selectedNote.fontFamily}
                      onMouseDown={() => saveEditorSelection()}
                      onChange={(event) => {
                        const nextFont = event.target.value;
                        applyEditorCommand("fontName", nextFont);
                        void updateSelectedNote({ fontFamily: nextFont });
                      }}
                    >
                      <option value="Avenir Next">Avenir</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Trebuchet MS">Trebuchet</option>
                      <option value="Courier New">Courier</option>
                    </select>

                    <select
                      className={styles.noteToolSelect}
                      value={String(selectedNote.fontSizePx)}
                      onMouseDown={() => saveEditorSelection()}
                      onChange={(event) => {
                        const nextSize = Number(event.target.value);
                        const sizeMap: Record<number, string> = {
                          14: "3",
                          16: "4",
                          18: "5",
                          22: "6",
                        };
                        applyEditorCommand("fontSize", sizeMap[nextSize] ?? "4");
                        void updateSelectedNote({ fontSizePx: nextSize });
                      }}
                    >
                      <option value="14">Small</option>
                      <option value="16">Normal</option>
                      <option value="18">Large</option>
                      <option value="22">XL</option>
                    </select>

                    <label className={styles.noteToolColor}>
                      Text
                      <input
                        type="color"
                        defaultValue="#111827"
                        onMouseDown={() => saveEditorSelection()}
                        onChange={(event) =>
                          applyEditorCommand("foreColor", event.target.value)
                        }
                      />
                    </label>

                    <label className={styles.noteToolColor}>
                      Highlight
                      <input
                        type="color"
                        defaultValue="#fff59d"
                        onMouseDown={() => saveEditorSelection()}
                        onChange={(event) => {
                          applyEditorCommand("hiliteColor", event.target.value);
                          applyEditorCommand("backColor", event.target.value);
                        }}
                      />
                    </label>
                  </div>

                  <input
                    value={selectedNote.title}
                    onChange={(event) => {
                      void updateSelectedNote({ title: event.target.value });
                    }}
                    placeholder="Note title"
                    className={styles.noteTitleInput}
                  />

                  <div
                    ref={editorRef}
                    className={styles.noteBodyInput}
                    contentEditable
                    suppressContentEditableWarning
                    style={{
                      fontFamily: selectedNote.fontFamily,
                      fontSize: `${selectedNote.fontSizePx}px`,
                    }}
                    onInput={() => {
                      captureEditorDraft();
                      saveEditorSelection();
                    }}
                    onBlur={() => {
                      captureEditorDraft();
                    }}
                    onMouseUp={() => saveEditorSelection()}
                    onKeyUp={() => saveEditorSelection()}
                    onFocus={() => saveEditorSelection()}
                  />

                  <div className={styles.noteEditorFooter}>
                    <span>
                      {notesSyncStatus === "synced"
                        ? "Synced to your account."
                        : notesSyncStatus === "syncing"
                          ? "Syncing notes..."
                          : "Saved locally only. Sync needed for other devices."}
                      {notesSyncMessage ? ` ${notesSyncMessage}` : ""}
                    </span>
                    {notesSyncStatus !== "synced" && (
                      <button
                        type="button"
                        className={styles.retrySyncButton}
                        onClick={() => void handleRetrySync()}
                      >
                        Retry sync
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.deleteNoteButton}
                      onClick={() => void deleteNote(selectedNote.id)}
                    >
                      Delete note
                    </button>
                  </div>
                </>
              )}
            </article>
          </section>
        )}
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
              {feedbackStatus && <p className={styles.feedbackStatus}>{feedbackStatus}</p>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
