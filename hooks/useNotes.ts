"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytesResumable } from "firebase/storage";
import { auth, storage } from "@/lib/firebase";
import {
  deleteNoteFromFirestore,
  clearPendingDeletedNoteId,
  filterNotesAgainstPendingDeletes,
  loadNotes,
  mergeNotesPreferNewest,
  migrateNotesFromJson,
  readLocalNotes,
  registerPendingDeletedNoteId,
  retryNotesSync,
  saveNoteRevisionSnapshot,
  saveNotePatchToFirestore,
  saveNoteToFirestore,
  saveNotesLocally,
  type NoteAttachment,
  type WorkspaceNote,
} from "@/lib/notes-store";
import { createCard, loadCards, saveCards } from "@/lib/cards-store";
import { dayKeyLocal, addDaysLocal, countWords } from "@/lib/date-utils";
import { resolveStandardNoteColor, WHELM_STANDARD_HISTORY_DAYS } from "@/lib/whelm-plans";
import { XP_WRITING_ENTRY_THRESHOLD } from "@/lib/xp-engine";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NoteCategory = "personal" | "school" | "work";

type LocalNoteDraft = {
  body: string;
  updatedAtISO: string;
};

export type PendingNoteAttachment = {
  id: string;
  name: string;
  kind: NoteAttachment["kind"];
  progress: number;
};

type UseNotesOptions = {
  isPro: boolean;
  /** Called when a new note is created so the shell can navigate to the notes tab */
  onNavigateToNotes?: () => void;
};

type PendingNotesXpPop = {
  id: string;
  amount: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const NOTE_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
const NOTE_ATTACHMENT_UPLOAD_IDLE_TIMEOUT_MS = 15000;
const NOTE_ATTACHMENT_UPLOAD_TOTAL_TIMEOUT_MS = 120000;
const NOTE_TITLE_SYNC_DEBOUNCE_MS = 240;
const NOTE_BODY_AUTOSAVE_DEBOUNCE_MS = 400;
// ── Helpers ───────────────────────────────────────────────────────────────────

function createNote(): WorkspaceNote {
  const now = new Date().toISOString();
  return {
    id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`,
    title: "Untitled note",
    body: "",
    attachments: [],
    color: "#e7e5e4",
    shellColor: "#fff7d6",
    surfaceStyle: "solid",
    isPinned: false,
    fontFamily: "Avenir Next",
    fontSizePx: 16,
    category: "personal",
    reminderAtISO: "",
    createdAtISO: now,
    updatedAtISO: now,
  };
}

function noteAttachmentKind(mimeType: string, fileName: string): NoteAttachment["kind"] {
  const normalizedMime = mimeType.toLowerCase();
  const extension = fileName.toLowerCase().split(".").pop() || "";

  if (normalizedMime.startsWith("image/")) return "image";
  if (
    normalizedMime.includes("pdf") ||
    normalizedMime.includes("word") ||
    normalizedMime.includes("document") ||
    ["pdf", "doc", "docx", "pages", "rtf"].includes(extension)
  ) {
    return "document";
  }
  if (
    normalizedMime.includes("spreadsheet") ||
    normalizedMime.includes("excel") ||
    ["xls", "xlsx", "csv", "numbers"].includes(extension)
  ) {
    return "spreadsheet";
  }
  if (
    normalizedMime.includes("presentation") ||
    normalizedMime.includes("powerpoint") ||
    ["ppt", "pptx", "key"].includes(extension)
  ) {
    return "presentation";
  }
  if (normalizedMime.startsWith("text/") || ["txt", "md"].includes(extension)) {
    return "text";
  }
  if (
    normalizedMime.includes("zip") ||
    normalizedMime.includes("compressed") ||
    ["zip"].includes(extension)
  ) {
    return "archive";
  }
  return "other";
}

function noteDraftStorageKey(uid: string, noteId: string) {
  return `whelm:note-draft:${uid}:${noteId}`;
}

function readLocalNoteDraft(uid: string, noteId: string) {
  try {
    const raw = window.localStorage.getItem(noteDraftStorageKey(uid, noteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalNoteDraft;
    if (!parsed || typeof parsed.body !== "string" || typeof parsed.updatedAtISO !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalNoteDraft(uid: string, noteId: string, body: string, updatedAtISO: string) {
  try {
    window.localStorage.setItem(
      noteDraftStorageKey(uid, noteId),
      JSON.stringify({ body, updatedAtISO } satisfies LocalNoteDraft),
    );
  } catch {
    // localStorage can be unavailable in private browsing; rely on in-memory draft state.
  }
}

function clearLocalNoteDraft(uid: string, noteId: string) {
  try {
    window.localStorage.removeItem(noteDraftStorageKey(uid, noteId));
  } catch {
    // Ignore storage cleanup failures.
  }
}

function normalizeBodyForEditor(body: string) {
  if (!body) return "";
  const hasHtmlTags = /<[a-z!/]/i.test(body);
  if (!hasHtmlTags) {
    return body.replaceAll("\n", "<br/>");
  }
  if (typeof document === "undefined") return body;

  const template = document.createElement("template");
  template.innerHTML = body;
  const allowedTags = new Set([
    "A",
    "B",
    "BLOCKQUOTE",
    "BR",
    "DIV",
    "EM",
    "H1",
    "H2",
    "H3",
    "HR",
    "I",
    "LI",
    "MARK",
    "OL",
    "P",
    "SPAN",
    "STRONG",
    "U",
    "UL",
  ]);

  const sanitizeNode = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;

    if (!allowedTags.has(element.tagName)) {
      const parent = element.parentNode;
      if (!parent) return;
      const promotedChildren = [...element.childNodes];
      for (const child of promotedChildren) {
        parent.insertBefore(child, element);
      }
      parent.removeChild(element);
      for (const child of promotedChildren) {
        sanitizeNode(child);
      }
      return;
    }

    for (const attribute of [...element.attributes]) {
      const keepHref = element.tagName === "A" && attribute.name === "href";
      if (!keepHref) {
        element.removeAttribute(attribute.name);
      }
    }

    for (const child of [...element.childNodes]) {
      sanitizeNode(child);
    }
  };

  for (const child of [...template.content.childNodes]) {
    sanitizeNode(child);
  }

  return template.innerHTML;
}

function isEffectivelyEmptyEditorHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, "")
    .replace(/<[^>]*>/g, "")
    .trim().length === 0;
}

function resolvePreferredEditorHtml(
  uid: string | null,
  note: WorkspaceNote | null,
  _fallbackHtml: string,
) {
  if (!note) return "";

  let nextHtml = normalizeBodyForEditor(note.body || "");
  if (!uid) return nextHtml;

  const localDraft = readLocalNoteDraft(uid, note.id);
  if (localDraft && localDraft.updatedAtISO >= note.updatedAtISO) {
    const localDraftHtml = normalizeBodyForEditor(localDraft.body);
    const syncedNoteHasContent = !isEffectivelyEmptyEditorHtml(nextHtml);
    const localDraftIsBlank = isEffectivelyEmptyEditorHtml(localDraftHtml);

    if (!(localDraftIsBlank && syncedNoteHasContent)) {
      nextHtml = localDraftHtml;
    }
  }

  return nextHtml;
}

function withPreferredDraftBody(uid: string | null, note: WorkspaceNote): WorkspaceNote {
  const preferredBody = resolvePreferredEditorHtml(uid, note, note.body);
  return preferredBody === note.body ? note : { ...note, body: preferredBody };
}

function shouldClearLocalDraft(note: WorkspaceNote, uid: string) {
  const localDraft = readLocalNoteDraft(uid, note.id);
  if (!localDraft) return false;

  if (localDraft.body === note.body) return true;

  const syncedNoteHasContent = !isEffectivelyEmptyEditorHtml(normalizeBodyForEditor(note.body));
  const localDraftIsBlank = isEffectivelyEmptyEditorHtml(normalizeBodyForEditor(localDraft.body));
  return localDraftIsBlank && syncedNoteHasContent;
}

function resolveFirebaseStorageBucket() {
  return typeof storage.app.options.storageBucket === "string"
    ? storage.app.options.storageBucket.trim()
    : "";
}

function describeAttachmentUploadError(error: unknown, bucketName: string) {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";

  switch (code) {
    case "storage/unauthorized":
      return "Firebase Storage rejected the upload. Check Storage rules for authenticated writes to users/{uid}/notes/**.";
    case "storage/bucket-not-found":
      return `Firebase Storage bucket "${bucketName}" was not found. Check NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET and confirm Storage is enabled for this project.`;
    case "storage/project-not-found":
      return "Firebase Storage could not find this Firebase project. Check the deployed Firebase project configuration.";
    case "storage/quota-exceeded":
      return "Firebase Storage quota was exceeded. The upload was rejected by the bucket.";
    case "storage/retry-limit-exceeded":
      return `Firebase Storage stopped retrying the upload for bucket "${bucketName}". Check the bucket, Storage rules, and browser network access.`;
    case "storage/canceled":
      return error instanceof Error && error.message
        ? error.message
        : "Attachment upload was canceled.";
    default:
      return error instanceof Error && error.message
        ? error.message
        : "Attachment upload failed.";
  }
}

function isDateKeyWithinRecentWindow(dateKey: string, days: number) {
  const cutoff = dayKeyLocal(addDaysLocal(new Date(), -(Math.max(1, days) - 1)));
  return dateKey >= cutoff;
}

function notesMatch(a: WorkspaceNote[], b: WorkspaceNote[]) {
  return JSON.stringify(mergeNotesPreferNewest([], a)) === JSON.stringify(mergeNotesPreferNewest([], b));
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNotes({ isPro, onNavigateToNotes }: UseNotesOptions) {
  const initialUser = typeof window !== "undefined" ? auth.currentUser : null;
  const initialLocalNotes = initialUser ? readLocalNotes(initialUser.uid) : [];

  // ── State ──────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState<WorkspaceNote[]>(initialLocalNotes);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(initialLocalNotes[0]?.id ?? null);
  const [notesSurface, setNotesSurface] = useState<"notes" | "cards">("notes");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [shellColorPickerOpen, setShellColorPickerOpen] = useState(false);
  const [textColorPickerOpen, setTextColorPickerOpen] = useState(false);
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);
  const [editorBodyDraft, setEditorBodyDraft] = useState("");
  const [notesSyncStatus, setNotesSyncStatus] = useState<"synced" | "local-only" | "syncing">(
    initialLocalNotes.length > 0 ? "local-only" : "syncing",
  );
  const [notesSyncMessage, setNotesSyncMessage] = useState(
    initialLocalNotes.length > 0 ? "Opening your local notes first while cloud sync catches up." : "",
  );
  const [noteAttachmentBusy, setNoteAttachmentBusy] = useState(false);
  const [noteAttachmentStatus, setNoteAttachmentStatus] = useState("");
  const [pendingNoteAttachments, setPendingNoteAttachments] = useState<PendingNoteAttachment[]>([]);
  const [noteUndoItem, setNoteUndoItem] = useState<WorkspaceNote | null>(null);
  const [mobileNotesRecentOpen, setMobileNotesRecentOpen] = useState(false);
  const [mobileNotesEditorOpen, setMobileNotesEditorOpen] = useState(false);
  const [selectionPopup, setSelectionPopup] = useState<{ text: string; x: number; y: number } | null>(null);
  const [quickCardForm, setQuickCardForm] = useState<{ front: string; back: string } | null>(null);
  const [mobileNotesToolsOpen, setMobileNotesToolsOpen] = useState<"format" | "type" | "color" | null>(null);
  const [notesSearch, setNotesSearch] = useState("");
  const [notesCategoryFilter, setNotesCategoryFilter] = useState<"all" | NoteCategory>("all");
  const [editorBandanaCaret, setEditorBandanaCaret] = useState<{
    left: number;
    top: number;
    visible: boolean;
  }>({ left: 0, top: 0, visible: false });
  const [pendingXpPop, setPendingXpPop] = useState<PendingNotesXpPop | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const editorRef = useRef<HTMLDivElement | null>(null);
  const noteBodyShellRef = useRef<HTMLDivElement | null>(null);
  const noteAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const syncInFlightRef = useRef(false);
  const bodyDirtyRef = useRef(false);
  const bodyDirtyNoteIdRef = useRef<string | null>(null);
  const noteTitleSyncTimeoutRef = useRef<number | null>(null);
  const noteTitleSyncPayloadRef = useRef<{
    noteId: string;
    title: string;
    updatedAtISO: string;
  } | null>(null);
  const noteDraftMirrorTimeoutRef = useRef<number | null>(null);
  const notesRef = useRef<WorkspaceNote[]>([]);
  const selectedNoteIdRef = useRef<string | null>(null);
  const notesSectionRef = useRef<HTMLElement | null>(null);
  const notesStartRef = useRef<HTMLElement | null>(null);
  const notesRecentRef = useRef<HTMLElement | null>(null);
  const notesEditorRef = useRef<HTMLElement | null>(null);

  // ── Derived state ──────────────────────────────────────────────────────────
  const currentUid = auth.currentUser?.uid ?? null;
  const draftAwareNotes = useMemo(
    () => notes.map((note) => withPreferredDraftBody(currentUid, note)),
    [currentUid, notes],
  );

  const selectedNote = useMemo(
    () => draftAwareNotes.find((note) => note.id === selectedNoteId) ?? null,
    [draftAwareNotes, selectedNoteId],
  );

  const selectedNoteSurfaceColor = isPro ? selectedNote?.shellColor : undefined;
  const selectedNotePageColor = isPro
    ? selectedNote?.color
    : resolveStandardNoteColor(selectedNote?.color);
  const selectedNoteWordCount = selectedNote
    ? countWords(selectedNote.body)
    : 0;

  const orderedNotes = useMemo(
    () =>
      [...draftAwareNotes].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return a.updatedAtISO < b.updatedAtISO ? 1 : -1;
      }),
    [draftAwareNotes],
  );

  const visibleNotes = useMemo(
    () =>
      isPro
        ? orderedNotes
        : orderedNotes.filter((note) =>
            isDateKeyWithinRecentWindow(dayKeyLocal(note.updatedAtISO), WHELM_STANDARD_HISTORY_DAYS),
          ),
    [isPro, orderedNotes],
  );

  const hasLockedNotesHistory = useMemo(
    () =>
      !isPro &&
      orderedNotes.some(
        (note) => !isDateKeyWithinRecentWindow(dayKeyLocal(note.updatedAtISO), WHELM_STANDARD_HISTORY_DAYS),
      ),
    [isPro, orderedNotes],
  );

  const filteredNotes = useMemo(() => {
    const query = notesSearch.trim().toLowerCase();
    return visibleNotes.filter((note) => {
      const categoryMatch =
        notesCategoryFilter === "all" || (note.category || "personal") === notesCategoryFilter;
      const textMatch =
        query.length === 0 ||
        note.title.toLowerCase().includes(query) ||
        note.body.toLowerCase().includes(query);
      return categoryMatch && textMatch;
    });
  }, [notesCategoryFilter, notesSearch, visibleNotes]);

  const dueReminderNotes = useMemo(() => {
    const todayKey = dayKeyLocal(new Date());
    return visibleNotes.filter((note) => {
      if (!note.reminderAtISO) return false;
      return dayKeyLocal(note.reminderAtISO) === todayKey;
    });
  }, [visibleNotes]);

  const noteWordsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const note of draftAwareNotes) {
      const dateKey = dayKeyLocal(note.updatedAtISO);
      map.set(dateKey, (map.get(dateKey) ?? 0) + countWords(note.body));
    }
    return map;
  }, [draftAwareNotes]);

  const syncEditorDraftFromNote = useCallback((note: WorkspaceNote | null, uid: string | null) => {
    if (!note) {
      if (editorBodyDraft !== "") setEditorBodyDraft("");
      if (editorRef.current && editorRef.current.innerHTML !== "") {
        editorRef.current.innerHTML = "";
      }
      return;
    }

    if (bodyDirtyRef.current && bodyDirtyNoteIdRef.current === note.id) return;
    if (typeof document !== "undefined" && document.activeElement === editorRef.current) return;

    const resolvedEditorHtml = resolvePreferredEditorHtml(
      uid,
      note,
      editorRef.current?.innerHTML ?? editorBodyDraft,
    );

    if (resolvedEditorHtml !== editorBodyDraft) {
      setEditorBodyDraft(resolvedEditorHtml);
    }
    if (editorRef.current && editorRef.current.innerHTML !== resolvedEditorHtml) {
      editorRef.current.innerHTML = resolvedEditorHtml;
    }
  }, [editorBodyDraft]);

  // ── Sync refs ──────────────────────────────────────────────────────────────
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    selectedNoteIdRef.current = selectedNoteId;
  }, [selectedNoteId]);

  // ── Clear selectedNoteId if note is no longer visible ──────────────────────
  useEffect(() => {
    if (selectedNoteId && !visibleNotes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(visibleNotes[0]?.id ?? null);
    }
  }, [selectedNoteId, visibleNotes]);

  // ── Load editor body when selected note changes ────────────────────────────
  useEffect(() => {
    const currentUser = auth.currentUser;
    syncEditorDraftFromNote(selectedNote, currentUser?.uid ?? null);
  }, [selectedNote, syncEditorDraftFromNote]);

  // ── Sync editorBodyDraft → editor.innerHTML ────────────────────────────────
  useEffect(() => {
    if (!editorRef.current) return;
    const editorNeedsHydration =
      isEffectivelyEmptyEditorHtml(editorRef.current.innerHTML) &&
      !isEffectivelyEmptyEditorHtml(editorBodyDraft);
    const editorIsFocused =
      typeof document !== "undefined" && document.activeElement === editorRef.current;

    if (
      bodyDirtyRef.current &&
      bodyDirtyNoteIdRef.current === selectedNoteId &&
      !editorNeedsHydration
    ) {
      return;
    }
    if (editorIsFocused && !editorNeedsHydration) return;
    if (editorRef.current.innerHTML !== editorBodyDraft) {
      editorRef.current.innerHTML = editorBodyDraft;
    }
  }, [editorBodyDraft, selectedNoteId, mobileNotesEditorOpen]);

  // ── Selectionchange → bandana caret ───────────────────────────────────────
  useEffect(() => {
    if (!selectedNote) {
      setEditorBandanaCaret((current) => (current.visible ? { ...current, visible: false } : current));
      return;
    }

    const handleSelectionChange = () => {
      if (document.activeElement !== editorRef.current) {
        setEditorBandanaCaret((current) => (current.visible ? { ...current, visible: false } : current));
        return;
      }
      updateEditorBandanaCaret();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
    // updateEditorBandanaCaret is stable (reads refs only), so it's safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNote, selectedNoteId]);

  // ── Reset pickers when selected note changes ───────────────────────────────
  useEffect(() => {
    setColorPickerOpen(false);
    setTextColorPickerOpen(false);
    setHighlightPickerOpen(false);
    setNoteAttachmentStatus("");
    setPendingNoteAttachments([]);
  }, [selectedNoteId]);

  // ── Fast debounce autosave ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedNote || !bodyDirtyRef.current) return;

    const timeoutId = window.setTimeout(() => {
      bodyDirtyRef.current = false;
      bodyDirtyNoteIdRef.current = null;
      console.log("[whelm] autosave body:", {
        noteId: selectedNote.id,
        bodyLength: editorBodyDraft.length,
        preview: editorBodyDraft.slice(0, 80),
      });
      void updateSelectedNote({ body: editorBodyDraft });
    }, NOTE_BODY_AUTOSAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
    // updateSelectedNote is a stable local function; editorBodyDraft and selectedNote are the real deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorBodyDraft, selectedNote]);

  // ── Functions ──────────────────────────────────────────────────────────────

  const refreshNotes = useCallback(async (uid: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== uid) {
      throw new Error("Your login session is missing. Sign in again.");
    }

    const refreshStartedAt = performance.now();
    const result = await loadNotes(currentUser);
    console.info("[whelm:notes] refresh complete", {
      uid,
      noteCount: result.notes.length,
      synced: result.synced,
      durationMs: Math.round(performance.now() - refreshStartedAt),
      message: result.message ?? "",
      online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
    });
    result.notes.forEach((note) => {
      if (shouldClearLocalDraft(note, uid)) {
        clearLocalNoteDraft(uid, note.id);
      }
    });
    setNotes(result.notes);
    const nextSelectedNoteId = selectedNoteIdRef.current ?? result.notes[0]?.id ?? null;
    setSelectedNoteId(nextSelectedNoteId);
    syncEditorDraftFromNote(
      result.notes.find((note) => note.id === nextSelectedNoteId) ?? null,
      uid,
    );
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }, [syncEditorDraftFromNote]);

  const handleUserSignedIn = useCallback((uid: string) => {
    try {
      const local = readLocalNotes(uid);
      if (local.length > 0) {
        setNotes(local);
        setSelectedNoteId((current) => current ?? local[0]?.id ?? null);
        setNotesSyncStatus("local-only");
        setNotesSyncMessage("Opening your local notes first while cloud sync catches up.");
      } else {
        setNotesSyncStatus("syncing");
        setNotesSyncMessage("Loading your notes from your account...");
      }
    } catch {
      // keep going; Firestore refresh below is the source of truth
      setNotesSyncStatus("syncing");
      setNotesSyncMessage("Loading your notes from your account...");
    }

    // One-time migration: move any notes from the legacy notesJson blob into
    // individual subcollection documents. Gated by a notesMigrated flag so it
    // runs exactly once and is otherwise a no-op.
    void migrateNotesFromJson(uid).catch(() => { /* non-critical — notes are still in localStorage */ });

    void refreshNotes(uid).catch((error) => {
      console.warn("[whelm:notes] refresh failed after sign-in", {
        uid,
        message: error instanceof Error ? error.message : "Unknown error",
        online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
      });
      // keep locally seeded notes visible if refresh fails
    });
  }, [refreshNotes]);

  const handleUserSignedOut = useCallback(() => {
    setNotes([]);
    setSelectedNoteId(null);
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
    setEditorBodyDraft("");
    setPendingNoteAttachments([]);
    setNoteAttachmentStatus("");
    setNoteUndoItem(null);
    setSelectionPopup(null);
    setQuickCardForm(null);
  }, []);

  const applyNotesSnapshot = useCallback((remoteNotes: WorkspaceNote[]) => {
    const currentUser = auth.currentUser;
    const uid = currentUser?.uid;
    const localNotes = uid ? filterNotesAgainstPendingDeletes(uid, readLocalNotes(uid)) : [];
    const inMemoryNotes = notesRef.current;
    const newestLocalNotes = uid
      ? filterNotesAgainstPendingDeletes(uid, mergeNotesPreferNewest(localNotes, inMemoryNotes))
      : mergeNotesPreferNewest(localNotes, inMemoryNotes);
    const filteredRemoteNotes = uid ? filterNotesAgainstPendingDeletes(uid, remoteNotes) : remoteNotes;
    const mergedNotes = uid
      ? filterNotesAgainstPendingDeletes(uid, mergeNotesPreferNewest(newestLocalNotes, filteredRemoteNotes))
      : mergeNotesPreferNewest(newestLocalNotes, filteredRemoteNotes);
    const selectedCandidateId = selectedNoteIdRef.current;
    const selectedStillExists = selectedCandidateId
      ? mergedNotes.some((note) => note.id === selectedCandidateId)
      : false;
    const remoteWasStale = !notesMatch(mergedNotes, remoteNotes);

    notesRef.current = mergedNotes;
    setNotes(mergedNotes);
    const nextSelectedNoteId = selectedStillExists ? selectedCandidateId : (mergedNotes[0]?.id ?? null);
    setSelectedNoteId(nextSelectedNoteId);
    syncEditorDraftFromNote(
      mergedNotes.find((note) => note.id === nextSelectedNoteId) ?? null,
      uid ?? null,
    );
    setNotesSyncStatus(remoteWasStale ? "syncing" : "synced");
    setNotesSyncMessage(
      remoteWasStale ? "Recovered newer local notes and syncing them to your account." : "",
    );

    if (!uid) return;

    saveNotesLocally(uid, mergedNotes);
    mergedNotes.forEach((note) => {
      if (shouldClearLocalDraft(note, uid)) {
        clearLocalNoteDraft(uid, note.id);
      }
    });

    if (!currentUser || !remoteWasStale || syncInFlightRef.current) return;

    syncInFlightRef.current = true;
    void retryNotesSync(currentUser, mergedNotes)
      .then((result) => {
        setNotesSyncStatus(result.synced ? "synced" : "local-only");
        setNotesSyncMessage(
          result.synced
            ? ""
            : (result.message ?? "Saved locally. Cloud sync is currently pending."),
        );
      })
      .finally(() => {
        syncInFlightRef.current = false;
      });
  }, [syncEditorDraftFromNote]);

  const clearPendingXpPop = useCallback(() => {
    setPendingXpPop(null);
  }, []);

  async function createWorkspaceNote() {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;

    const nextNote = createNote();
    const nextNotes = [nextNote, ...notesRef.current];
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    setSelectedNoteId(nextNote.id);
    saveNotesLocally(currentUser.uid, nextNotes);
    onNavigateToNotes?.();
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
    const result = await saveNoteToFirestore(currentUser.uid, nextNote);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
    return nextNote.id;
  }

  async function updateNoteById(
    noteId: string,
    patch: Partial<
      Pick<
        WorkspaceNote,
        | "title"
        | "body"
        | "color"
        | "shellColor"
        | "surfaceStyle"
        | "isPinned"
        | "fontFamily"
        | "fontSizePx"
        | "category"
        | "reminderAtISO"
        | "attachments"
      >
    >,
  ) {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const previousNote = notesRef.current.find((note) => note.id === noteId) ?? null;
    if (
      previousNote &&
      typeof patch.body === "string" &&
      patch.body !== previousNote.body &&
      !isEffectivelyEmptyEditorHtml(normalizeBodyForEditor(previousNote.body))
    ) {
      saveNoteRevisionSnapshot(currentUser.uid, previousNote, "body-update");
    }

    const now = new Date().toISOString();
    const nextNotes = notesRef.current.map((note) =>
      note.id === noteId ? { ...note, ...patch, updatedAtISO: now } : note,
    );
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    saveNotesLocally(currentUser.uid, nextNotes);
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
    const updatedNote = nextNotes.find((n) => n.id === noteId);
    const result = updatedNote
      ? await saveNotePatchToFirestore(currentUser.uid, noteId, { ...patch, updatedAtISO: now })
      : { synced: false, notes: [], message: "Note not found." };
    if (result.synced) {
      const syncedNote = nextNotes.find((note) => note.id === noteId);
      if (syncedNote && shouldClearLocalDraft(syncedNote, currentUser.uid)) {
        clearLocalNoteDraft(currentUser.uid, noteId);
      }
    }
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }

  function scheduleTitleSync(noteId: string, title: string, updatedAtISO: string) {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    noteTitleSyncPayloadRef.current = { noteId, title, updatedAtISO };
    if (noteTitleSyncTimeoutRef.current) {
      window.clearTimeout(noteTitleSyncTimeoutRef.current);
    }

    noteTitleSyncTimeoutRef.current = window.setTimeout(() => {
      const pending = noteTitleSyncPayloadRef.current;
      noteTitleSyncTimeoutRef.current = null;
      noteTitleSyncPayloadRef.current = null;
      if (!pending) return;

      void (async () => {
        const result = await saveNotePatchToFirestore(currentUser.uid, pending.noteId, {
          title: pending.title,
          updatedAtISO: pending.updatedAtISO,
        });
        setNotesSyncStatus(result.synced ? "synced" : "local-only");
        setNotesSyncMessage(result.message ?? "");
      })();
    }, NOTE_TITLE_SYNC_DEBOUNCE_MS);
  }

  async function flushPendingTitleSync() {
    const currentUser = auth.currentUser;
    const pending = noteTitleSyncPayloadRef.current;
    if (!currentUser || !pending) return;

    if (noteTitleSyncTimeoutRef.current) {
      window.clearTimeout(noteTitleSyncTimeoutRef.current);
      noteTitleSyncTimeoutRef.current = null;
    }
    noteTitleSyncPayloadRef.current = null;

    const result = await saveNotePatchToFirestore(currentUser.uid, pending.noteId, {
      title: pending.title,
      updatedAtISO: pending.updatedAtISO,
    });
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }

  async function updateSelectedNote(
    patch: Partial<
      Pick<
        WorkspaceNote,
        | "title"
        | "body"
        | "color"
        | "shellColor"
        | "surfaceStyle"
        | "isPinned"
        | "fontFamily"
        | "fontSizePx"
        | "category"
        | "reminderAtISO"
        | "attachments"
      >
    >,
  ) {
    const currentSelectedNoteId = selectedNoteIdRef.current;
    if (!currentSelectedNoteId) return;

    const patchKeys = Object.keys(patch);
    if (patchKeys.length === 1 && patchKeys[0] === "title") {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const nextTitle = typeof patch.title === "string" ? patch.title : "";
      const now = new Date().toISOString();
      const nextNotes = notesRef.current.map((note) =>
        note.id === currentSelectedNoteId ? { ...note, title: nextTitle, updatedAtISO: now } : note,
      );
      notesRef.current = nextNotes;
      setNotes(nextNotes);
      saveNotesLocally(currentUser.uid, nextNotes);
      setNotesSyncStatus("syncing");
      setNotesSyncMessage("");
      scheduleTitleSync(currentSelectedNoteId, nextTitle, now);
      return;
    }

    await updateNoteById(currentSelectedNoteId, patch);
  }

  async function flushSelectedNoteDraft() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const currentSelectedNoteId = selectedNoteIdRef.current;
    if (!currentSelectedNoteId) return;

    const currentNote = notesRef.current.find((note) => note.id === currentSelectedNoteId);
    if (!currentNote) return;

    const editorHtml = normalizeBodyForEditor(editorRef.current?.innerHTML ?? "");
    const draftBody = normalizeBodyForEditor(editorBodyDraft);
    const currentBody = currentNote.body;
    const nextBody =
      isEffectivelyEmptyEditorHtml(editorHtml) &&
      !isEffectivelyEmptyEditorHtml(draftBody) &&
      !isEffectivelyEmptyEditorHtml(currentBody)
        ? draftBody
        : editorHtml || draftBody;

    if (nextBody === currentNote.body && !bodyDirtyRef.current) return;
    if (!isEffectivelyEmptyEditorHtml(normalizeBodyForEditor(currentNote.body)) && nextBody !== currentNote.body) {
      saveNoteRevisionSnapshot(currentUser.uid, currentNote, "body-update");
    }

    const prevWordCount = countWords(currentNote.body);
    const nextWordCount = countWords(nextBody);
    if (prevWordCount < XP_WRITING_ENTRY_THRESHOLD && nextWordCount >= XP_WRITING_ENTRY_THRESHOLD) {
      setPendingXpPop({
        id: `note-xp-${currentSelectedNoteId}-${Date.now()}`,
        amount: 5,
      });
    }

    const now = new Date().toISOString();
    if (noteDraftMirrorTimeoutRef.current) {
      window.clearTimeout(noteDraftMirrorTimeoutRef.current);
      noteDraftMirrorTimeoutRef.current = null;
    }
    bodyDirtyRef.current = false;
    bodyDirtyNoteIdRef.current = null;
    const nextNotes = notesRef.current.map((note) =>
      note.id === currentSelectedNoteId ? { ...note, body: nextBody, updatedAtISO: now } : note,
    );
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    writeLocalNoteDraft(currentUser.uid, currentSelectedNoteId, nextBody, now);
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
    console.log("[whelm] flush body to Firestore:", { noteId: currentSelectedNoteId, bodyLength: nextBody.length });
    const result = await saveNotePatchToFirestore(currentUser.uid, currentSelectedNoteId, {
      body: nextBody,
      updatedAtISO: now,
    });
    if (result.synced) {
      const syncedNote = nextNotes.find((note) => note.id === currentSelectedNoteId);
      if (syncedNote && shouldClearLocalDraft(syncedNote, currentUser.uid)) {
        clearLocalNoteDraft(currentUser.uid, currentSelectedNoteId);
      }
    }
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }

  async function togglePinned(noteId: string) {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const target = notesRef.current.find((note) => note.id === noteId);
    if (!target) return;
    await updateNoteById(noteId, { isPinned: !target.isPinned });
  }

  function captureEditorDraft() {
    if (!editorRef.current) return;
    const nextBody = normalizeBodyForEditor(editorRef.current.innerHTML);
    setEditorBodyDraft(nextBody);

    const currentUser = auth.currentUser;
    const currentSelectedNoteId = selectedNoteIdRef.current;
    if (!currentUser || !currentSelectedNoteId) return;

    const currentNote = notesRef.current.find((note) => note.id === currentSelectedNoteId);
    if (!currentNote || currentNote.body === nextBody) return;

    const now = new Date().toISOString();
    bodyDirtyRef.current = true;
    bodyDirtyNoteIdRef.current = currentSelectedNoteId;
    writeLocalNoteDraft(currentUser.uid, currentSelectedNoteId, nextBody, now);
    if (noteDraftMirrorTimeoutRef.current) {
      window.clearTimeout(noteDraftMirrorTimeoutRef.current);
      noteDraftMirrorTimeoutRef.current = null;
    }
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

  function checkEditorSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.isCollapsed || selection.rangeCount === 0) {
      setSelectionPopup(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
      setSelectionPopup(null);
      return;
    }
    const text = selection.toString().trim();
    if (text.length < 2) {
      setSelectionPopup(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    setSelectionPopup({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  }

  async function handleQuickCardSave() {
    const currentUser = auth.currentUser;
    if (!currentUser || !quickCardForm) return;
    const trimmedFront = quickCardForm.front.trim();
    const trimmedBack = quickCardForm.back.trim();
    if (!trimmedFront || !trimmedBack) return;
    const currentSelectedNoteId = selectedNoteIdRef.current ?? selectedNoteId ?? "notes-tab";
    const newCard = createCard(currentSelectedNoteId, trimmedFront, trimmedBack);
    const existing = await loadCards(currentUser.uid);
    await saveCards(currentUser.uid, [...existing, newCard]);
    setQuickCardForm(null);
    setSelectionPopup(null);
  }

  function updateEditorBandanaCaret() {
    const editor = editorRef.current;
    const shell = noteBodyShellRef.current;
    const selection = window.getSelection();
    if (!editor || !shell || !selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      setEditorBandanaCaret((current) => (current.visible ? { ...current, visible: false } : current));
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
      setEditorBandanaCaret((current) => (current.visible ? { ...current, visible: false } : current));
      return;
    }

    const measuredRange = range.cloneRange();
    const marker = document.createElement("span");
    marker.textContent = "\u200b";
    marker.style.position = "relative";
    marker.style.display = "inline-block";
    marker.style.width = "1px";
    marker.style.height = "1em";
    marker.style.pointerEvents = "none";

    measuredRange.insertNode(marker);
    const rect = marker.getBoundingClientRect();
    marker.parentNode?.removeChild(marker);
    selection.removeAllRanges();
    selection.addRange(range);

    const shellRect = shell.getBoundingClientRect();
    const top = rect.top - shellRect.top - 2;
    const left = rect.left - shellRect.left - 2;

    setEditorBandanaCaret({
      left: Number.isFinite(left) ? left : 0,
      top: Number.isFinite(top) ? top : 0,
      visible: true,
    });
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
    updateEditorBandanaCaret();
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
    updateEditorBandanaCaret();
    captureEditorDraft();
  }

  function applyHighlightColor(value: string) {
    if (!selectedNote) return;
    if (!restoreEditorSelection()) {
      editorRef.current?.focus();
    }
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("hiliteColor", false, value);
    document.execCommand("backColor", false, value);
    saveEditorSelection();
    captureEditorDraft();
  }

  async function deleteNote(noteId: string) {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const deleted = notesRef.current.find((note) => note.id === noteId) || null;
    if (deleted) {
      saveNoteRevisionSnapshot(currentUser.uid, deleted, "delete");
    }
    const nextNotes = notesRef.current.filter((note) => note.id !== noteId);
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    setSelectedNoteId((current) => (current === noteId ? nextNotes[0]?.id ?? null : current));
    clearLocalNoteDraft(currentUser.uid, noteId);
    registerPendingDeletedNoteId(currentUser.uid, noteId);
    saveNotesLocally(currentUser.uid, nextNotes);
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
    try {
      await deleteNoteFromFirestore(currentUser.uid, noteId);
      clearPendingDeletedNoteId(currentUser.uid, noteId);
      setNotesSyncStatus("synced");
      setNotesSyncMessage("");
    } catch {
      setNotesSyncStatus("local-only");
      setNotesSyncMessage("Deleted locally. Cloud sync is currently pending.");
    }
    setNoteUndoItem(deleted);
    window.setTimeout(() => setNoteUndoItem(null), 5000);
  }

  async function undoDeleteNote() {
    const currentUser = auth.currentUser;
    if (!currentUser || !noteUndoItem) return;
    clearPendingDeletedNoteId(currentUser.uid, noteUndoItem.id);
    const restored = [noteUndoItem, ...notesRef.current];
    notesRef.current = restored;
    setNotes(restored);
    setSelectedNoteId(noteUndoItem.id);
    saveNotesLocally(currentUser.uid, restored);
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
    const result = await saveNoteToFirestore(currentUser.uid, noteUndoItem);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
    setNoteUndoItem(null);
  }

  async function handleRetrySync() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    await flushSelectedNoteDraft();
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("Force syncing your notes, refetching cloud data, and repairing local text if needed...");
    const result = await retryNotesSync(currentUser, notesRef.current);

    if (result.notes.length > 0) {
      result.notes.forEach((note) => {
        if (shouldClearLocalDraft(note, currentUser.uid)) {
          clearLocalNoteDraft(currentUser.uid, note.id);
        }
      });
      notesRef.current = result.notes;
      setNotes(result.notes);
      const nextSelectedNoteId =
        selectedNoteIdRef.current && result.notes.some((note) => note.id === selectedNoteIdRef.current)
          ? selectedNoteIdRef.current
          : (result.notes[0]?.id ?? null);
      setSelectedNoteId(nextSelectedNoteId);

      const selectedAfterRetry =
        result.notes.find((note) => note.id === nextSelectedNoteId) ?? null;
      const repairedEditorHtml = resolvePreferredEditorHtml(
        currentUser.uid,
        selectedAfterRetry,
        editorRef.current?.innerHTML ?? editorBodyDraft,
      );

      if (selectedAfterRetry && repairedEditorHtml !== editorBodyDraft) {
        setEditorBodyDraft(repairedEditorHtml);
        if (editorRef.current && editorRef.current.innerHTML !== repairedEditorHtml) {
          editorRef.current.innerHTML = repairedEditorHtml;
        }
      }
    }

    if (result.synced) {
      setNotesSyncStatus("synced");
      setNotesSyncMessage("");
    } else {
      setNotesSyncStatus("local-only");
      setNotesSyncMessage(result.message ?? "Retry failed.");
    }
  }

  useEffect(() => {
    return () => {
      const pendingTitleSync = noteTitleSyncPayloadRef.current;
      if (noteTitleSyncTimeoutRef.current) {
        window.clearTimeout(noteTitleSyncTimeoutRef.current);
      }
      if (pendingTitleSync && auth.currentUser) {
        void saveNotePatchToFirestore(auth.currentUser.uid, pendingTitleSync.noteId, {
          title: pendingTitleSync.title,
          updatedAtISO: pendingTitleSync.updatedAtISO,
        });
      }
      if (noteDraftMirrorTimeoutRef.current) {
        window.clearTimeout(noteDraftMirrorTimeoutRef.current);
      }
    };
  }, []);

  function openNoteAttachmentPicker() {
    if (!selectedNote) return;
    noteAttachmentInputRef.current?.click();
  }

  function openNoteAttachment(attachment: NoteAttachment) {
    window.open(attachment.downloadUrl, "_blank", "noopener,noreferrer");
  }

  async function handleNoteAttachmentInput(event: ChangeEvent<HTMLInputElement>) {
    const currentUser = auth.currentUser;
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    const targetNoteId = selectedNoteIdRef.current;

    if (!currentUser || !targetNoteId || files.length === 0) return;

    const oversized = files.find((file) => file.size > NOTE_ATTACHMENT_MAX_BYTES);
    if (oversized) {
      setNoteAttachmentStatus(`${oversized.name} is too large. Keep each file under 20 MB.`);
      return;
    }

    const bucketName = resolveFirebaseStorageBucket();
    if (!bucketName) {
      setNoteAttachmentStatus(
        "Attachment uploads are unavailable because NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is missing.",
      );
      return;
    }

    setNoteAttachmentBusy(true);
    setNoteAttachmentStatus(
      files.length === 1 ? `Adding ${files[0].name}...` : `Adding ${files.length} files...`,
    );
    const pendingEntries = files.map((file) => ({
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      kind: noteAttachmentKind(file.type, file.name),
      progress: 0,
    }));
    setPendingNoteAttachments(pendingEntries);

    try {
      const uploadedAttachments = await Promise.all(
        files.map(async (file, index) => {
          const attachmentId = pendingEntries[index].id;
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "file";
          const storagePath = `users/${currentUser.uid}/notes/${targetNoteId}/${attachmentId}-${safeName}`;
          const attachmentRef = storageRef(storage, storagePath);
          const uploadTask = uploadBytesResumable(attachmentRef, file, {
            contentType: file.type || "application/octet-stream",
          });
          await new Promise<void>((resolve, reject) => {
            let settled = false;
            let idleTimeoutId = 0;
            let totalTimeoutId = 0;
            let unsubscribe: () => void = () => undefined;

            const clearTimers = () => {
              window.clearTimeout(idleTimeoutId);
              window.clearTimeout(totalTimeoutId);
            };

            const failWithMessage = (message: string) => {
              if (settled) return;
              settled = true;
              clearTimers();
              unsubscribe();
              uploadTask.cancel();
              reject(new Error(message));
            };

            const refreshIdleTimeout = () => {
              window.clearTimeout(idleTimeoutId);
              idleTimeoutId = window.setTimeout(() => {
                failWithMessage(
                  `Upload stalled for ${file.name}. Check Firebase Storage bucket "${bucketName}" and confirm Storage rules allow writes to users/${currentUser.uid}/notes/**.`,
                );
              }, NOTE_ATTACHMENT_UPLOAD_IDLE_TIMEOUT_MS);
            };

            totalTimeoutId = window.setTimeout(() => {
              failWithMessage(
                `Upload timed out for ${file.name}. Check your connection or Firebase Storage bucket "${bucketName}".`,
              );
            }, NOTE_ATTACHMENT_UPLOAD_TOTAL_TIMEOUT_MS);

            refreshIdleTimeout();

            unsubscribe = uploadTask.on(
              "state_changed",
              (snapshot) => {
                if (settled) return;
                refreshIdleTimeout();
                const progress =
                  snapshot.totalBytes > 0
                    ? (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                    : 0;
                setPendingNoteAttachments((current) =>
                  current.map((item) =>
                    item.id === attachmentId ? { ...item, progress } : item,
                  ),
                );
              },
              (error) => {
                if (settled) return;
                settled = true;
                clearTimers();
                unsubscribe();
                reject(error);
              },
              () => {
                if (settled) return;
                settled = true;
                clearTimers();
                unsubscribe();
                resolve();
              },
            );
          });

          const downloadUrl = await getDownloadURL(attachmentRef);
          const uploadedAtISO = new Date().toISOString();
          const uploadedAttachment = {
            id: attachmentId,
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            kind: noteAttachmentKind(file.type, file.name),
            storagePath,
            downloadUrl,
            uploadedAtISO,
          } satisfies NoteAttachment;

          const latestTargetNote = notesRef.current.find((note) => note.id === targetNoteId);
          const existingAttachments = latestTargetNote?.attachments ?? [];
          const dedupedAttachments = [uploadedAttachment, ...existingAttachments].filter(
            (attachment, dedupeIndex, all) =>
              all.findIndex((item) => item.id === attachment.id) === dedupeIndex,
          );

          await updateNoteById(targetNoteId, { attachments: dedupedAttachments });
          setPendingNoteAttachments((current) => current.filter((item) => item.id !== attachmentId));
          setNoteAttachmentStatus(`${file.name} attached.`);
          return uploadedAttachment;
        }),
      );
      setNoteAttachmentStatus(
        uploadedAttachments.length === 1
          ? `${uploadedAttachments[0].name} attached.`
          : `${uploadedAttachments.length} files attached.`,
      );
    } catch (error: unknown) {
      setPendingNoteAttachments([]);
      setNoteAttachmentStatus(describeAttachmentUploadError(error, bucketName));
    } finally {
      setNoteAttachmentBusy(false);
    }
  }

  async function removeNoteAttachment(attachment: NoteAttachment) {
    const currentUser = auth.currentUser;
    const targetNoteId = selectedNoteIdRef.current;
    if (!currentUser || !targetNoteId) return;

    setNoteAttachmentBusy(true);
    setNoteAttachmentStatus(`Removing ${attachment.name}...`);

    try {
      await deleteObject(storageRef(storage, attachment.storagePath)).catch(() => undefined);
      const latestTargetNote = notesRef.current.find((note) => note.id === targetNoteId);
      await updateNoteById(targetNoteId, {
        attachments: (latestTargetNote?.attachments ?? []).filter((item) => item.id !== attachment.id),
      });
      setNoteAttachmentStatus(`${attachment.name} removed.`);
    } catch (error: unknown) {
      setNoteAttachmentStatus(
        error instanceof Error ? error.message : "Attachment removal failed.",
      );
    } finally {
      setNoteAttachmentBusy(false);
    }
  }

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    // Notes data
    notes,
    setNotes,
    selectedNoteId,
    setSelectedNoteId,
    selectedNote,
    orderedNotes,
    visibleNotes,
    filteredNotes,
    dueReminderNotes,
    hasLockedNotesHistory,
    // Computed values
    noteWordsByDay,
    pendingXpPop,
    clearPendingXpPop,
    selectedNoteSurfaceColor,
    selectedNotePageColor,
    selectedNoteWordCount,
    // Sync state
    notesSyncStatus,
    setNotesSyncStatus,
    notesSyncMessage,
    setNotesSyncMessage,
    // Refs (for subscribeToUserData callbacks)
    notesRef,
    selectedNoteIdRef,
    bodyDirtyRef,
    syncInFlightRef,
    // DOM refs
    editorRef,
    noteBodyShellRef,
    noteAttachmentInputRef,
    notesSectionRef,
    notesStartRef,
    notesRecentRef,
    notesEditorRef,
    // UI state
    notesSurface,
    setNotesSurface,
    colorPickerOpen,
    setColorPickerOpen,
    shellColorPickerOpen,
    setShellColorPickerOpen,
    textColorPickerOpen,
    setTextColorPickerOpen,
    highlightPickerOpen,
    setHighlightPickerOpen,
    editorBodyDraft,
    setEditorBodyDraft,
    editorBandanaCaret,
    setEditorBandanaCaret,
    notesSearch,
    setNotesSearch,
    notesCategoryFilter,
    setNotesCategoryFilter,
    noteUndoItem,
    setNoteUndoItem,
    mobileNotesRecentOpen,
    setMobileNotesRecentOpen,
    mobileNotesEditorOpen,
    setMobileNotesEditorOpen,
    mobileNotesToolsOpen,
    setMobileNotesToolsOpen,
    selectionPopup,
    setSelectionPopup,
    quickCardForm,
    setQuickCardForm,
    // Attachment state
    noteAttachmentBusy,
    noteAttachmentStatus,
    pendingNoteAttachments,
    setPendingNoteAttachments,
    // Functions
    refreshNotes,
    handleUserSignedIn,
    handleUserSignedOut,
    applyNotesSnapshot,
    createWorkspaceNote,
    updateNoteById,
    updateSelectedNote,
    flushPendingTitleSync,
    flushSelectedNoteDraft,
    togglePinned,
    captureEditorDraft,
    saveEditorSelection,
    checkEditorSelection,
    handleQuickCardSave,
    updateEditorBandanaCaret,
    restoreEditorSelection,
    applyEditorCommand,
    applyHighlightColor,
    deleteNote,
    undoDeleteNote,
    handleRetrySync,
    openNoteAttachmentPicker,
    openNoteAttachment,
    handleNoteAttachmentInput,
    removeNoteAttachment,
  };
}
