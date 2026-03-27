"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytesResumable } from "firebase/storage";
import { auth, storage } from "@/lib/firebase";
import {
  loadNotes,
  mergeNotesPreferNewest,
  readLocalNotes,
  retryNotesSync,
  saveNotes,
  saveNotesLocally,
  type NoteAttachment,
  type WorkspaceNote,
} from "@/lib/notes-store";
import { createCard, loadCards, saveCards } from "@/lib/cards-store";
import { dayKeyLocal, addDaysLocal, countWords } from "@/lib/date-utils";
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
const PRO_HISTORY_FREE_DAYS = 14;

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
  window.localStorage.setItem(
    noteDraftStorageKey(uid, noteId),
    JSON.stringify({ body, updatedAtISO } satisfies LocalNoteDraft),
  );
}

function clearLocalNoteDraft(uid: string, noteId: string) {
  window.localStorage.removeItem(noteDraftStorageKey(uid, noteId));
}

function normalizeBodyForEditor(body: string) {
  if (!body) return "";
  const hasHtmlTags = /<[a-z!/]/i.test(body);
  if (!hasHtmlTags) {
    return body.replaceAll("\n", "<br/>");
  }
  return body;
}

function isEffectivelyEmptyEditorHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, "")
    .replace(/<[^>]*>/g, "")
    .trim().length === 0;
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
  return JSON.stringify(a) === JSON.stringify(b);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNotes({ isPro, onNavigateToNotes }: UseNotesOptions) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState<WorkspaceNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [notesSurface, setNotesSurface] = useState<"notes" | "cards">("notes");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [shellColorPickerOpen, setShellColorPickerOpen] = useState(false);
  const [textColorPickerOpen, setTextColorPickerOpen] = useState(false);
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);
  const [editorBodyDraft, setEditorBodyDraft] = useState("");
  const [notesSyncStatus, setNotesSyncStatus] = useState<"synced" | "local-only" | "syncing">("syncing");
  const [notesSyncMessage, setNotesSyncMessage] = useState("");
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
  const notesRef = useRef<WorkspaceNote[]>([]);
  const selectedNoteIdRef = useRef<string | null>(null);
  const notesSectionRef = useRef<HTMLElement | null>(null);
  const notesStartRef = useRef<HTMLElement | null>(null);
  const notesRecentRef = useRef<HTMLElement | null>(null);
  const notesEditorRef = useRef<HTMLElement | null>(null);

  // ── Derived state ──────────────────────────────────────────────────────────
  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  );

  const selectedNoteSurfaceColor = isPro ? selectedNote?.shellColor : undefined;
  const selectedNotePageColor = isPro ? selectedNote?.color : undefined;
  const selectedNoteWordCount = selectedNote
    ? countWords(editorBodyDraft || selectedNote.body)
    : 0;

  const orderedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return a.updatedAtISO < b.updatedAtISO ? 1 : -1;
      }),
    [notes],
  );

  const visibleNotes = useMemo(
    () =>
      isPro
        ? orderedNotes
        : orderedNotes.filter((note) =>
            isDateKeyWithinRecentWindow(dayKeyLocal(note.updatedAtISO), PRO_HISTORY_FREE_DAYS),
          ),
    [isPro, orderedNotes],
  );

  const hasLockedNotesHistory = useMemo(
    () =>
      !isPro &&
      orderedNotes.some(
        (note) => !isDateKeyWithinRecentWindow(dayKeyLocal(note.updatedAtISO), PRO_HISTORY_FREE_DAYS),
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
    for (const note of notes) {
      const dateKey = dayKeyLocal(note.updatedAtISO);
      map.set(dateKey, (map.get(dateKey) ?? 0) + countWords(note.body));
    }
    return map;
  }, [notes]);

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
    let nextHtml = selectedNote ? normalizeBodyForEditor(selectedNote.body) : "";

    if (currentUser && selectedNote) {
      const localDraft = readLocalNoteDraft(currentUser.uid, selectedNote.id);
      if (localDraft && localDraft.updatedAtISO >= selectedNote.updatedAtISO) {
        nextHtml = normalizeBodyForEditor(localDraft.body);
      }
    }

    setEditorBodyDraft(nextHtml);
  }, [selectedNote, selectedNoteId]);

  // ── Sync editorBodyDraft → editor.innerHTML ────────────────────────────────
  useEffect(() => {
    if (!editorRef.current) return;
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

  // ── 1-second debounce autosave ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedNote || !bodyDirtyRef.current) return;

    const timeoutId = window.setTimeout(() => {
      bodyDirtyRef.current = false;
      console.log("[whelm] autosave body:", {
        noteId: selectedNote.id,
        bodyLength: editorBodyDraft.length,
        preview: editorBodyDraft.slice(0, 80),
      });
      void updateSelectedNote({ body: editorBodyDraft });
    }, 1000);

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

    const result = await loadNotes(currentUser);
    setNotes(result.notes);
    setSelectedNoteId((current) => current ?? result.notes[0]?.id ?? null);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }, []);

  const handleUserSignedIn = useCallback((uid: string) => {
    try {
      const raw = window.localStorage.getItem(`whelm:notes:${uid}`);
      const local = raw ? (JSON.parse(raw) as WorkspaceNote[]) : [];
      if (local.length > 0) {
        setNotes(local);
        setSelectedNoteId((current) => current ?? local[0]?.id ?? null);
      }
    } catch {
      // keep going; Firestore refresh below is the source of truth
    }

    void refreshNotes(uid).catch(() => {
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
    const localNotes = uid ? readLocalNotes(uid) : [];
    const inMemoryNotes = notesRef.current;
    const newestLocalNotes = mergeNotesPreferNewest(localNotes, inMemoryNotes);
    const mergedNotes = mergeNotesPreferNewest(newestLocalNotes, remoteNotes);
    const selectedCandidateId = selectedNoteIdRef.current;
    const selectedStillExists = selectedCandidateId
      ? mergedNotes.some((note) => note.id === selectedCandidateId)
      : false;
    const remoteWasStale = !notesMatch(mergedNotes, remoteNotes);

    notesRef.current = mergedNotes;
    setNotes(mergedNotes);
    setSelectedNoteId(selectedStillExists ? selectedCandidateId : (mergedNotes[0]?.id ?? null));
    setNotesSyncStatus(remoteWasStale ? "syncing" : "synced");
    setNotesSyncMessage(
      remoteWasStale ? "Recovered newer local notes and syncing them to your account." : "",
    );

    if (!uid) return;

    saveNotesLocally(uid, mergedNotes);

    if (!currentUser || !remoteWasStale || syncInFlightRef.current) return;

    syncInFlightRef.current = true;
    void retryNotesSync(currentUser, mergedNotes)
      .then((result) => {
        setNotesSyncStatus(result.synced ? "synced" : "local-only");
        setNotesSyncMessage(
          result.synced
            ? ""
            : (result.message ?? "Saved locally only. Sync needed for other devices."),
        );
      })
      .finally(() => {
        syncInFlightRef.current = false;
      });
  }, []);

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
    onNavigateToNotes?.();
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
    const result = await saveNotes(currentUser, nextNotes);
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

    const now = new Date().toISOString();
    const nextNotes = notesRef.current.map((note) =>
      note.id === noteId ? { ...note, ...patch, updatedAtISO: now } : note,
    );
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
    const result = await saveNotes(currentUser, nextNotes);
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

    await updateNoteById(currentSelectedNoteId, patch);
  }

  async function flushSelectedNoteDraft() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const currentSelectedNoteId = selectedNoteIdRef.current;
    if (!currentSelectedNoteId) return;

    const currentNote = notesRef.current.find((note) => note.id === currentSelectedNoteId);
    if (!currentNote) return;

    const editorHtml = editorRef.current?.innerHTML ?? "";
    const draftBody = editorBodyDraft;
    const currentBody = currentNote.body;
    const nextBody =
      isEffectivelyEmptyEditorHtml(editorHtml) &&
      !isEffectivelyEmptyEditorHtml(draftBody) &&
      !isEffectivelyEmptyEditorHtml(currentBody)
        ? draftBody
        : editorHtml || draftBody;

    if (nextBody === currentNote.body && !bodyDirtyRef.current) return;

    const countWordsInline = (html: string) =>
      html.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
    const prevWordCount = countWordsInline(currentNote.body);
    const nextWordCount = countWordsInline(nextBody);
    if (prevWordCount < XP_WRITING_ENTRY_THRESHOLD && nextWordCount >= XP_WRITING_ENTRY_THRESHOLD) {
      setPendingXpPop({
        id: `note-xp-${currentSelectedNoteId}-${Date.now()}`,
        amount: 5,
      });
    }

    const now = new Date().toISOString();
    bodyDirtyRef.current = false;
    const nextNotes = notesRef.current.map((note) =>
      note.id === currentSelectedNoteId ? { ...note, body: nextBody, updatedAtISO: now } : note,
    );
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    writeLocalNoteDraft(currentUser.uid, currentSelectedNoteId, nextBody, now);
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
    console.log("[whelm] flush body to Firestore:", { noteId: currentSelectedNoteId, bodyLength: nextBody.length });
    const result = await saveNotes(currentUser, nextNotes);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }

  async function togglePinned(noteId: string) {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const target = notesRef.current.find((note) => note.id === noteId);
    if (!target) return;

    const now = new Date().toISOString();
    const nextNotes = notesRef.current.map((note) =>
      note.id === noteId
        ? { ...note, isPinned: !note.isPinned, updatedAtISO: now }
        : note,
    );
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
    const result = await saveNotes(currentUser, nextNotes);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
  }

  function captureEditorDraft() {
    if (!editorRef.current) return;
    const nextBody = editorRef.current.innerHTML;
    setEditorBodyDraft(nextBody);

    const currentUser = auth.currentUser;
    const currentSelectedNoteId = selectedNoteIdRef.current;
    if (!currentUser || !currentSelectedNoteId) return;

    const currentNote = notesRef.current.find((note) => note.id === currentSelectedNoteId);
    if (!currentNote || currentNote.body === nextBody) return;

    const now = new Date().toISOString();
    bodyDirtyRef.current = true;
    const nextNotes = notesRef.current.map((note) =>
      note.id === currentSelectedNoteId ? { ...note, body: nextBody, updatedAtISO: now } : note,
    );
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    writeLocalNoteDraft(currentUser.uid, currentSelectedNoteId, nextBody, now);
    saveNotesLocally(currentUser.uid, nextNotes);
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
    const newCard = createCard(selectedNoteId ?? "notes-tab", trimmedFront, trimmedBack);
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
    const nextNotes = notesRef.current.filter((note) => note.id !== noteId);
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    setSelectedNoteId((current) => (current === noteId ? nextNotes[0]?.id ?? null : current));
    clearLocalNoteDraft(currentUser.uid, noteId);
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
    const result = await saveNotes(currentUser, nextNotes);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
    setNoteUndoItem(deleted);
    window.setTimeout(() => setNoteUndoItem(null), 5000);
  }

  async function undoDeleteNote() {
    const currentUser = auth.currentUser;
    if (!currentUser || !noteUndoItem) return;
    const restored = [noteUndoItem, ...notesRef.current];
    notesRef.current = restored;
    setNotes(restored);
    setSelectedNoteId(noteUndoItem.id);
    setNotesSyncStatus("syncing");
    setNotesSyncMessage("");
    const result = await saveNotes(currentUser, restored);
    setNotesSyncStatus(result.synced ? "synced" : "local-only");
    setNotesSyncMessage(result.message ?? "");
    setNoteUndoItem(null);
  }

  async function handleRetrySync() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setNotesSyncStatus("syncing");
    const result = await retryNotesSync(currentUser, notesRef.current);

    if (result.synced) {
    setNotesSyncStatus("synced");
    setNotesSyncMessage("");
    } else {
      setNotesSyncStatus("local-only");
      setNotesSyncMessage(result.message ?? "Retry failed.");
    }
  }

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

    if (!currentUser || !selectedNote || files.length === 0) return;

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
          const storagePath = `users/${currentUser.uid}/notes/${selectedNote.id}/${attachmentId}-${safeName}`;
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

          const latestTargetNote = notesRef.current.find((note) => note.id === selectedNote.id);
          const existingAttachments = latestTargetNote?.attachments ?? [];
          const dedupedAttachments = [uploadedAttachment, ...existingAttachments].filter(
            (attachment, dedupeIndex, all) =>
              all.findIndex((item) => item.id === attachment.id) === dedupeIndex,
          );

          await updateNoteById(selectedNote.id, { attachments: dedupedAttachments });
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
    if (!currentUser || !selectedNote) return;

    setNoteAttachmentBusy(true);
    setNoteAttachmentStatus(`Removing ${attachment.name}...`);

    try {
      await deleteObject(storageRef(storage, attachment.storagePath)).catch(() => undefined);
      const latestTargetNote = notesRef.current.find((note) => note.id === selectedNote.id);
      await updateNoteById(selectedNote.id, {
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
