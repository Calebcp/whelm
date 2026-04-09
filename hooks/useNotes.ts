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
  readLocalNoteRevisions,
  type NoteAttachment,
  type WorkspaceNote,
} from "@/lib/notes-store";
import { createCard, loadCards, saveCards } from "@/lib/cards-store";
import { dayKeyLocal, addDaysLocal, countWords } from "@/lib/date-utils";
import { buildNoteWordsByDayFromHistory } from "@/lib/note-word-history";
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
  isMobileViewport: boolean;
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
const NOTE_DRAFT_MIRROR_DEBOUNCE_MS = 120;
const PLAIN_TEXT_NOTE_PREFIX = "__whelm_plain_text__:";
// ── Helpers ───────────────────────────────────────────────────────────────────

function createNote(): WorkspaceNote {
  const now = new Date().toISOString();
  return {
    id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`,
    title: "Untitled note",
    body: "",
    attachments: [],
    color: "#f7fbff",
    shellColor: "#eef5ff",
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

function normalizeEditorText(value: string) {
  return value.replace(/\r\n?/g, "\n");
}

function editorTextToStoredBody(value: string) {
  if (!value) return "";
  return `${PLAIN_TEXT_NOTE_PREFIX}${normalizeEditorText(value)}`;
}

function decodeStoredBodyEntities(body: string) {
  return body
    .replace(/&lt;br\s*\/?&gt;/gi, "<br/>")
    .replace(/&lt;\/?(div|p|li|blockquote|h1|h2|h3)&gt;/gi, (match) =>
      match.startsWith("&lt;/") ? "\n" : "",
    );
}

function storedBodyToEditorText(body: string) {
  if (!body) return "";
  if (body.startsWith(PLAIN_TEXT_NOTE_PREFIX)) {
    return normalizeEditorText(body.slice(PLAIN_TEXT_NOTE_PREFIX.length));
  }
  const normalizedBody = decodeStoredBodyEntities(body);
  const looksLikeLegacyHtml =
    /<\/(p|div|li|blockquote|h1|h2|h3|strong|em|b|i|u|mark|ul|ol|a|span)>/i.test(normalizedBody) ||
    /^\s*<(p|div|li|blockquote|h1|h2|h3|strong|em|b|i|u|mark|ul|ol|a|span|hr)(?=[\s/>])/i.test(normalizedBody) ||
    /(^|[^\w])<br\s*\/?>([^\w]|$)/i.test(normalizedBody) ||
    /&lt;(br|\/?(p|div|li|blockquote|h1|h2|h3))\s*\/?&gt;/i.test(body) ||
    /&nbsp;/i.test(normalizedBody);
  if (!looksLikeLegacyHtml) {
    return normalizeEditorText(normalizedBody);
  }
  if (typeof document === "undefined") {
    return normalizeEditorText(
      normalizedBody
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|blockquote|h1|h2|h3)>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">"),
    );
  }

  const template = document.createElement("template");
  template.innerHTML = normalizedBody
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|blockquote|h1|h2|h3)>/gi, "\n");
  const blockSelectors = "p,div,li,blockquote,h1,h2,h3";
  template.content.querySelectorAll(blockSelectors).forEach((element) => {
    if (element.nextSibling) {
      element.insertAdjacentText("afterend", "\n");
    }
  });
  return normalizeEditorText((template.content.textContent ?? "").replace(/\u00a0/g, " "));
}

function prefixLines(value: string, prefix: string) {
  return value
    .split("\n")
    .map((line) => (line.length > 0 ? `${prefix}${line}` : prefix.trimEnd()))
    .join("\n");
}

function stripSimpleFormatting(value: string) {
  return value
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^-\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/==(.*?)==/g, "$1")
    .replace(/\n---\n/g, "\n");
}

function isEffectivelyEmptyNoteText(value: string) {
  return storedBodyToEditorText(value).trim().length === 0;
}

function resolvePreferredEditorText(
  uid: string | null,
  note: WorkspaceNote | null,
  _fallbackText: string,
) {
  if (!note) return "";

  let nextText = storedBodyToEditorText(note.body || "");
  if (!uid) return nextText;

  const localDraft = readLocalNoteDraft(uid, note.id);
  if (localDraft && localDraft.updatedAtISO >= note.updatedAtISO) {
    const localDraftText = storedBodyToEditorText(localDraft.body);
    const syncedNoteHasContent = nextText.trim().length > 0;
    const localDraftIsBlank = localDraftText.trim().length === 0;

    if (!(localDraftIsBlank && syncedNoteHasContent)) {
      nextText = localDraftText;
    }
  }

  return nextText;
}

function withPreferredDraftBody(uid: string | null, note: WorkspaceNote): WorkspaceNote {
  const preferredBody = uid
    ? readLocalNoteDraft(uid, note.id)?.body ?? note.body
    : note.body;
  const editorBody = storedBodyToEditorText(preferredBody);
  return editorBody === note.body ? note : { ...note, body: editorBody };
}

function shouldClearLocalDraft(note: WorkspaceNote, uid: string) {
  const localDraft = readLocalNoteDraft(uid, note.id);
  if (!localDraft) return false;

  if (localDraft.body === note.body) return true;

  const syncedNoteHasContent = !isEffectivelyEmptyNoteText(note.body);
  const localDraftIsBlank = isEffectivelyEmptyNoteText(localDraft.body);
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

export const __notesEditorInterop = {
  editorTextToStoredBody,
  storedBodyToEditorText,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNotes({ isPro, isMobileViewport, onNavigateToNotes }: UseNotesOptions) {
  const initialUser = typeof window !== "undefined" ? auth.currentUser : null;
  const initialLocalNotes = initialUser ? readLocalNotes(initialUser.uid) : [];

  // ── State ──────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState<WorkspaceNote[]>(initialLocalNotes);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
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
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const noteBodyShellRef = useRef<HTMLDivElement | null>(null);
  const noteAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const savedSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const syncInFlightRef = useRef(false);
  const bodyDirtyRef = useRef(false);
  const bodyDirtyNoteIdRef = useRef<string | null>(null);
  const noteTitleSyncTimeoutRef = useRef<number | null>(null);
  const noteTitleSyncPayloadRef = useRef<{
    noteId: string;
    title: string;
    updatedAtISO: string;
  } | null>(null);
  const noteTitleOverrideRef = useRef<Map<string, { title: string; updatedAtISO: string }>>(new Map());
  const noteDraftMirrorTimeoutRef = useRef<number | null>(null);
  const bodyAutosaveTimeoutRef = useRef<number | null>(null);
  const notesRef = useRef<WorkspaceNote[]>([]);
  const editorBodyDraftRef = useRef(editorBodyDraft);
  const notesSyncStatusRef = useRef<"synced" | "local-only" | "syncing">(
    initialLocalNotes.length > 0 ? "local-only" : "syncing",
  );
  const notesSyncMessageRef = useRef(
    initialLocalNotes.length > 0 ? "Opening your local notes first while cloud sync catches up." : "",
  );
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
    if (!currentUid) {
      return buildNoteWordsByDayFromHistory({ notes: draftAwareNotes });
    }

    return buildNoteWordsByDayFromHistory({
      notes: draftAwareNotes,
      getRevisions: (noteId) => readLocalNoteRevisions(currentUid, noteId),
    });
  }, [currentUid, draftAwareNotes]);

  const syncEditorDraftFromNote = useCallback((note: WorkspaceNote | null, uid: string | null) => {
    if (!note) {
      editorBodyDraftRef.current = "";
      if (editorBodyDraft !== "") setEditorBodyDraft("");
      if (editorRef.current && editorRef.current.value !== "") {
        editorRef.current.value = "";
      }
      return;
    }

    if (bodyDirtyRef.current && bodyDirtyNoteIdRef.current === note.id) return;
    if (typeof document !== "undefined" && document.activeElement === editorRef.current) return;

    const resolvedEditorText = resolvePreferredEditorText(
      uid,
      note,
      editorRef.current?.value ?? editorBodyDraft,
    );

    if (resolvedEditorText !== editorBodyDraft) {
      editorBodyDraftRef.current = resolvedEditorText;
      setEditorBodyDraft(resolvedEditorText);
    }
    if (editorRef.current && editorRef.current.value !== resolvedEditorText) {
      editorRef.current.value = resolvedEditorText;
    }
  }, [editorBodyDraft]);

  const applyPendingTitleOverrides = useCallback((incomingNotes: WorkspaceNote[]) => {
    if (noteTitleOverrideRef.current.size === 0) return incomingNotes;

    let changed = false;
    const nextNotes = incomingNotes.map((note) => {
      const override = noteTitleOverrideRef.current.get(note.id);
      if (!override) return note;

      if (note.title === override.title) {
        noteTitleOverrideRef.current.delete(note.id);
        return note;
      }

      changed = true;
      return {
        ...note,
        title: override.title,
        updatedAtISO: override.updatedAtISO >= note.updatedAtISO ? override.updatedAtISO : note.updatedAtISO,
      };
    });

    return changed ? nextNotes : incomingNotes;
  }, []);

  // ── Sync refs ──────────────────────────────────────────────────────────────
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    editorBodyDraftRef.current = editorBodyDraft;
  }, [editorBodyDraft]);

  useEffect(() => {
    selectedNoteIdRef.current = selectedNoteId;
  }, [selectedNoteId]);

  const setNotesSyncUi = useCallback(
    (status: "synced" | "local-only" | "syncing", message: string) => {
      if (notesSyncStatusRef.current !== status) {
        notesSyncStatusRef.current = status;
        setNotesSyncStatus(status);
      }
      if (notesSyncMessageRef.current !== message) {
        notesSyncMessageRef.current = message;
        setNotesSyncMessage(message);
      }
    },
    [],
  );

  const queueDraftMirror = useCallback((uid: string, noteId: string, body: string, updatedAtISO: string) => {
    editorBodyDraftRef.current = body;
    if (noteDraftMirrorTimeoutRef.current) {
      window.clearTimeout(noteDraftMirrorTimeoutRef.current);
    }
    noteDraftMirrorTimeoutRef.current = window.setTimeout(() => {
      noteDraftMirrorTimeoutRef.current = null;
      writeLocalNoteDraft(uid, noteId, body, updatedAtISO);
    }, NOTE_DRAFT_MIRROR_DEBOUNCE_MS);
  }, []);

  // ── Clear selectedNoteId if note is no longer visible ──────────────────────
  useEffect(() => {
    if (selectedNoteId && !visibleNotes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(null);
    }
  }, [selectedNoteId, visibleNotes]);

  // ── Load editor body when selected note changes ────────────────────────────
  useEffect(() => {
    const currentUser = auth.currentUser;
    syncEditorDraftFromNote(selectedNote, currentUser?.uid ?? null);
  }, [selectedNote, syncEditorDraftFromNote]);

  // ── Sync editorBodyDraft → editor.value ────────────────────────────────────
  useEffect(() => {
    if (!editorRef.current) return;
    const editorNeedsHydration =
      editorRef.current.value.trim().length === 0 &&
      editorBodyDraft.trim().length > 0;
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
    if (editorRef.current.value !== editorBodyDraft) {
      editorRef.current.value = editorBodyDraft;
    }
  }, [editorBodyDraft, selectedNoteId, mobileNotesEditorOpen]);

  // ── Selectionchange → bandana caret ───────────────────────────────────────
  useEffect(() => {
    if (!selectedNote) {
      setEditorBandanaCaret((current) => (current.visible ? { ...current, visible: false } : current));
      return;
    }
    if (isMobileViewport) {
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
  }, [isMobileViewport, selectedNote, selectedNoteId]);

  // ── Reset pickers when selected note changes ───────────────────────────────
  useEffect(() => {
    setColorPickerOpen(false);
    setTextColorPickerOpen(false);
    setHighlightPickerOpen(false);
    setNoteAttachmentStatus("");
    setPendingNoteAttachments([]);
  }, [selectedNoteId]);

  // ── Functions ──────────────────────────────────────────────────────────────

  const refreshNotes = useCallback(async (uid: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== uid) {
      throw new Error("Your login session is missing. Sign in again.");
    }

    const refreshStartedAt = performance.now();
    const result = await loadNotes(currentUser);
    const repairedNotes = applyPendingTitleOverrides(result.notes);
    console.info("[whelm:notes] refresh complete", {
      uid,
      noteCount: repairedNotes.length,
      synced: result.synced,
      durationMs: Math.round(performance.now() - refreshStartedAt),
      message: result.message ?? "",
      online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
    });
    repairedNotes.forEach((note) => {
      if (shouldClearLocalDraft(note, uid)) {
        clearLocalNoteDraft(uid, note.id);
      }
    });
    setNotes(repairedNotes);
    const nextSelectedNoteId =
      selectedNoteIdRef.current && repairedNotes.some((note) => note.id === selectedNoteIdRef.current)
        ? selectedNoteIdRef.current
        : null;
    setSelectedNoteId(nextSelectedNoteId);
    syncEditorDraftFromNote(
      repairedNotes.find((note) => note.id === nextSelectedNoteId) ?? null,
      uid,
    );
    setNotesSyncUi(result.synced ? "synced" : "local-only", result.message ?? "");
  }, [applyPendingTitleOverrides, setNotesSyncUi, syncEditorDraftFromNote]);

  const handleUserSignedIn = useCallback((uid: string) => {
    try {
      const local = readLocalNotes(uid);
      if (local.length > 0) {
        setNotes(local);
        setNotesSyncUi("local-only", "Opening your local notes first while cloud sync catches up.");
      } else {
        setNotesSyncUi("syncing", "Loading your notes from your account...");
      }
    } catch {
      // keep going; Firestore refresh below is the source of truth
      setNotesSyncUi("syncing", "Loading your notes from your account...");
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
  }, [refreshNotes, setNotesSyncUi]);

  const handleUserSignedOut = useCallback(() => {
    setNotes([]);
    setSelectedNoteId(null);
    setNotesSyncUi("syncing", "");
    setEditorBodyDraft("");
    setPendingNoteAttachments([]);
    setNoteAttachmentStatus("");
    setNoteUndoItem(null);
    setSelectionPopup(null);
    setQuickCardForm(null);
  }, [setNotesSyncUi]);

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
    const repairedMergedNotes = applyPendingTitleOverrides(mergedNotes);
    const selectedCandidateId = selectedNoteIdRef.current;
    const selectedStillExists = selectedCandidateId
      ? repairedMergedNotes.some((note) => note.id === selectedCandidateId)
      : false;
    const remoteWasStale = !notesMatch(repairedMergedNotes, remoteNotes);
    const mergedMatchesCurrent = notesMatch(repairedMergedNotes, inMemoryNotes);
    const nextSelectedNoteId = selectedStillExists ? selectedCandidateId : null;
    const selectedChanged = nextSelectedNoteId !== selectedNoteIdRef.current;

    if (!mergedMatchesCurrent) {
      notesRef.current = repairedMergedNotes;
      setNotes(repairedMergedNotes);
    }
    if (selectedChanged) {
      setSelectedNoteId(nextSelectedNoteId);
    }
    if (!mergedMatchesCurrent || selectedChanged) {
      syncEditorDraftFromNote(
        repairedMergedNotes.find((note) => note.id === nextSelectedNoteId) ?? null,
        uid ?? null,
      );
    }
    setNotesSyncUi(
      remoteWasStale ? "syncing" : "synced",
      remoteWasStale ? "Recovered newer local notes and syncing them to your account." : "",
    );

    if (!uid) return;

    saveNotesLocally(uid, repairedMergedNotes);
    repairedMergedNotes.forEach((note) => {
      if (shouldClearLocalDraft(note, uid)) {
        clearLocalNoteDraft(uid, note.id);
      }
    });

    if (!currentUser || !remoteWasStale || syncInFlightRef.current) return;

    syncInFlightRef.current = true;
    void retryNotesSync(currentUser, repairedMergedNotes)
      .then((result) => {
        setNotesSyncUi(
          result.synced ? "synced" : "local-only",
          result.synced
            ? ""
            : (result.message ?? "Saved locally. Cloud sync is currently pending."),
        );
      })
      .finally(() => {
        syncInFlightRef.current = false;
      });
  }, [applyPendingTitleOverrides, setNotesSyncUi, syncEditorDraftFromNote]);

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
    setNotesSyncUi("syncing", "");
    const result = await saveNoteToFirestore(currentUser.uid, nextNote);
    setNotesSyncUi(result.synced ? "synced" : "local-only", result.message ?? "");
    return nextNote.id;
  }

  async function createWorkspaceNoteFromDraft(input: {
    title?: string;
    body: string;
    category?: NoteCategory;
  }) {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;

    const body = input.body.trim();
    if (!body) return null;

    const nextNote = {
      ...createNote(),
      title: input.title?.trim() || "Session note",
      body: editorTextToStoredBody(body),
      category: input.category ?? "personal",
    } satisfies WorkspaceNote;
    const nextNotes = [nextNote, ...notesRef.current];
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    saveNotesLocally(currentUser.uid, nextNotes);
    setNotesSyncUi("syncing", "");
    const result = await saveNoteToFirestore(currentUser.uid, nextNote);
    setNotesSyncUi(result.synced ? "synced" : "local-only", result.message ?? "");
    return nextNote.id;
  }

  const persistSelectedNoteBody = useCallback(async (
    noteId: string,
    nextEditorText: string,
    options?: { publishToState?: boolean; captureRevision?: boolean },
  ) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const currentNote = notesRef.current.find((note) => note.id === noteId);
    if (!currentNote) return;
    const nextBody = editorTextToStoredBody(nextEditorText);
    if (nextBody === currentNote.body && !bodyDirtyRef.current && bodyDirtyNoteIdRef.current !== noteId) {
      return;
    }

    if (
      options?.captureRevision &&
      !isEffectivelyEmptyNoteText(currentNote.body) &&
      nextBody !== currentNote.body
    ) {
      saveNoteRevisionSnapshot(currentUser.uid, currentNote, "body-update");
    }

    const prevWordCount = countWords(currentNote.body);
    const nextWordCount = countWords(nextBody);
    if (prevWordCount < XP_WRITING_ENTRY_THRESHOLD && nextWordCount >= XP_WRITING_ENTRY_THRESHOLD) {
      setPendingXpPop({
        id: `note-xp-${noteId}-${Date.now()}`,
        amount: 5,
      });
    }

    const now = new Date().toISOString();
    const pendingTitleOverride = noteTitleOverrideRef.current.get(noteId);
    const pendingTitlePayload = noteTitleSyncPayloadRef.current;
    const bodyTitlePatch =
      pendingTitlePayload?.noteId === noteId
        ? { title: pendingTitlePayload.title }
        : pendingTitleOverride
          ? { title: pendingTitleOverride.title }
          : {};

    if (noteDraftMirrorTimeoutRef.current) {
      window.clearTimeout(noteDraftMirrorTimeoutRef.current);
      noteDraftMirrorTimeoutRef.current = null;
    }
    if (bodyAutosaveTimeoutRef.current) {
      window.clearTimeout(bodyAutosaveTimeoutRef.current);
      bodyAutosaveTimeoutRef.current = null;
    }

    bodyDirtyRef.current = false;
    bodyDirtyNoteIdRef.current = null;
    editorBodyDraftRef.current = nextEditorText;

    const nextNotes = notesRef.current.map((note) =>
      note.id === noteId ? { ...note, ...bodyTitlePatch, body: nextBody, updatedAtISO: now } : note,
    );
    notesRef.current = nextNotes;

    if (options?.publishToState) {
      setNotes(nextNotes);
      setEditorBodyDraft((current) => (current === nextEditorText ? current : nextEditorText));
      saveNotesLocally(currentUser.uid, nextNotes);
    }

    writeLocalNoteDraft(currentUser.uid, noteId, nextBody, now);

    if (notesSyncStatusRef.current !== "local-only") {
      setNotesSyncUi("syncing", "");
    }

    const result = await saveNotePatchToFirestore(currentUser.uid, noteId, {
      ...bodyTitlePatch,
      body: nextBody,
      updatedAtISO: now,
    });
    if (result.synced) {
      const syncedNote = nextNotes.find((note) => note.id === noteId);
      if (syncedNote && shouldClearLocalDraft(syncedNote, currentUser.uid)) {
        clearLocalNoteDraft(currentUser.uid, noteId);
      }
    }
    setNotesSyncUi(result.synced ? "synced" : "local-only", result.message ?? "");
  }, [setNotesSyncUi]);

  const queueBodyAutosave = useCallback((noteId: string, body: string) => {
    if (bodyAutosaveTimeoutRef.current) {
      window.clearTimeout(bodyAutosaveTimeoutRef.current);
    }
    bodyAutosaveTimeoutRef.current = window.setTimeout(() => {
      bodyAutosaveTimeoutRef.current = null;
      if (!bodyDirtyRef.current || bodyDirtyNoteIdRef.current !== noteId) return;
      void persistSelectedNoteBody(noteId, body, { publishToState: false, captureRevision: false });
    }, NOTE_BODY_AUTOSAVE_DEBOUNCE_MS);
  }, [persistSelectedNoteBody]);

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
    const patchKeys = Object.keys(patch);
    const isDirectBodyAutosave = patchKeys.length === 1 && patchKeys[0] === "body" && typeof patch.body === "string";
    const pendingTitleOverride = noteTitleOverrideRef.current.get(noteId);
    const pendingTitlePayload = noteTitleSyncPayloadRef.current;
    const shouldApplyPendingTitle =
      typeof patch.title !== "string" &&
      (Boolean(pendingTitleOverride) || pendingTitlePayload?.noteId === noteId);
    const titlePatch =
      shouldApplyPendingTitle
        ? {
            title:
              pendingTitlePayload?.noteId === noteId
                ? pendingTitlePayload.title
                : (pendingTitleOverride?.title ?? ""),
          }
        : {};
    const previousNote = notesRef.current.find((note) => note.id === noteId) ?? null;
    if (
      !isDirectBodyAutosave &&
      previousNote &&
      typeof patch.body === "string" &&
      patch.body !== previousNote.body &&
      !isEffectivelyEmptyNoteText(previousNote.body)
    ) {
      saveNoteRevisionSnapshot(currentUser.uid, previousNote, "body-update");
    }

    const now = new Date().toISOString();
    const nextNotes = notesRef.current.map((note) =>
      note.id === noteId ? { ...note, ...patch, ...titlePatch, updatedAtISO: now } : note,
    );
    notesRef.current = nextNotes;
    setNotes(nextNotes);
    if (!isDirectBodyAutosave) {
      saveNotesLocally(currentUser.uid, nextNotes);
    }
    if (notesSyncStatusRef.current !== "local-only") {
      setNotesSyncUi("syncing", "");
    }
    const updatedNote = nextNotes.find((n) => n.id === noteId);
    const result = updatedNote
      ? await saveNotePatchToFirestore(currentUser.uid, noteId, { ...patch, ...titlePatch, updatedAtISO: now })
      : { synced: false, notes: [], message: "Note not found." };
    if (result.synced) {
      const syncedNote = nextNotes.find((note) => note.id === noteId);
      if (syncedNote && shouldClearLocalDraft(syncedNote, currentUser.uid)) {
        clearLocalNoteDraft(currentUser.uid, noteId);
      }
    }
    setNotesSyncUi(result.synced ? "synced" : "local-only", result.message ?? "");
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
        setNotesSyncUi(result.synced ? "synced" : "local-only", result.message ?? "");
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
    setNotesSyncUi(result.synced ? "synced" : "local-only", result.message ?? "");
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
      noteTitleOverrideRef.current.set(currentSelectedNoteId, {
        title: nextTitle,
        updatedAtISO: now,
      });
      const nextNotes = notesRef.current.map((note) =>
        note.id === currentSelectedNoteId ? { ...note, title: nextTitle, updatedAtISO: now } : note,
      );
      notesRef.current = nextNotes;
      setNotes(nextNotes);
      saveNotesLocally(currentUser.uid, nextNotes);
      scheduleTitleSync(currentSelectedNoteId, nextTitle, now);
      return;
    }

    await updateNoteById(currentSelectedNoteId, patch);
  }

  const flushSelectedNoteDraft = useCallback(async () => {
    if (!auth.currentUser) return;

    const currentSelectedNoteId = selectedNoteIdRef.current;
    if (!currentSelectedNoteId) return;

    const currentNote = notesRef.current.find((note) => note.id === currentSelectedNoteId);
    if (!currentNote) return;

    const editorText = editorRef.current?.value ?? "";
    const draftText = editorBodyDraftRef.current;
    const currentText = storedBodyToEditorText(currentNote.body);
    const nextEditorText =
      editorText.trim().length === 0 &&
      draftText.trim().length > 0 &&
      currentText.trim().length > 0
        ? draftText
        : editorText || draftText;

    if (editorText !== nextEditorText && editorRef.current) {
      editorRef.current.value = nextEditorText;
    }

    if (editorTextToStoredBody(nextEditorText) === currentNote.body && !bodyDirtyRef.current) return;
    await persistSelectedNoteBody(currentSelectedNoteId, nextEditorText, {
      publishToState: true,
      captureRevision: true,
    });
  }, [persistSelectedNoteBody]);

  async function togglePinned(noteId: string) {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const target = notesRef.current.find((note) => note.id === noteId);
    if (!target) return;
    await updateNoteById(noteId, { isPinned: !target.isPinned });
  }

  function captureEditorDraft() {
    if (!editorRef.current) return;
    const nextEditorText = editorRef.current.value;

    const currentUser = auth.currentUser;
    const currentSelectedNoteId = selectedNoteIdRef.current;
    if (!currentUser || !currentSelectedNoteId) return;

    const currentNote = notesRef.current.find((note) => note.id === currentSelectedNoteId);
    if (!currentNote) return;

    const now = new Date().toISOString();
    const nextBody = editorTextToStoredBody(nextEditorText);
    queueDraftMirror(currentUser.uid, currentSelectedNoteId, nextBody, now);
    if (currentNote.body === nextBody) {
      bodyDirtyRef.current = false;
      bodyDirtyNoteIdRef.current = null;
      if (bodyAutosaveTimeoutRef.current) {
        window.clearTimeout(bodyAutosaveTimeoutRef.current);
        bodyAutosaveTimeoutRef.current = null;
      }
      return;
    }
    bodyDirtyRef.current = true;
    bodyDirtyNoteIdRef.current = currentSelectedNoteId;
    queueBodyAutosave(currentSelectedNoteId, nextEditorText);
  }

  function saveEditorSelection() {
    const editor = editorRef.current;
    if (!editor) return;
    savedSelectionRef.current = {
      start: editor.selectionStart ?? 0,
      end: editor.selectionEnd ?? 0,
    };
  }

  function checkEditorSelection() {
    setSelectionPopup(null);
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
    setEditorBandanaCaret((current) => (current.visible ? { ...current, visible: false } : current));
  }

  function restoreEditorSelection() {
    const editor = editorRef.current;
    const savedRange = savedSelectionRef.current;
    if (!editor || !savedRange) return false;

    editor.focus();
    editor.setSelectionRange(savedRange.start, savedRange.end);
    return true;
  }

  function applyEditorTextTransformation(
    transformer: (selectedText: string, fullText: string) => { nextText: string; selectionStart: number; selectionEnd: number },
  ) {
    const editor = editorRef.current;
    if (!editor) return;
    restoreEditorSelection();
    const start = editor.selectionStart ?? 0;
    const end = editor.selectionEnd ?? start;
    const fullText = editor.value;
    const selectedText = fullText.slice(start, end);
    const { nextText, selectionStart, selectionEnd } = transformer(selectedText, fullText);
    editor.value = nextText;
    editor.focus();
    editor.setSelectionRange(selectionStart, selectionEnd);
    savedSelectionRef.current = { start: selectionStart, end: selectionEnd };
    captureEditorDraft();
  }

  function applyEditorCommand(command: string, value?: string) {
    void value;
    switch (command) {
      case "bold":
        applyEditorTextTransformation((selectedText, fullText) => {
          const editor = editorRef.current;
          const start = editor?.selectionStart ?? 0;
          const end = editor?.selectionEnd ?? start;
          const wrapped = `**${selectedText || "bold text"}**`;
          const nextText = `${fullText.slice(0, start)}${wrapped}${fullText.slice(end)}`;
          const contentStart = start + 2;
          const contentEnd = contentStart + (selectedText || "bold text").length;
          return { nextText, selectionStart: contentStart, selectionEnd: contentEnd };
        });
        return;
      case "italic":
        applyEditorTextTransformation((selectedText, fullText) => {
          const editor = editorRef.current;
          const start = editor?.selectionStart ?? 0;
          const end = editor?.selectionEnd ?? start;
          const wrapped = `*${selectedText || "italic text"}*`;
          const nextText = `${fullText.slice(0, start)}${wrapped}${fullText.slice(end)}`;
          const contentStart = start + 1;
          const contentEnd = contentStart + (selectedText || "italic text").length;
          return { nextText, selectionStart: contentStart, selectionEnd: contentEnd };
        });
        return;
      case "underline":
        applyEditorTextTransformation((selectedText, fullText) => {
          const editor = editorRef.current;
          const start = editor?.selectionStart ?? 0;
          const end = editor?.selectionEnd ?? start;
          const wrapped = `__${selectedText || "underlined text"}__`;
          const nextText = `${fullText.slice(0, start)}${wrapped}${fullText.slice(end)}`;
          const contentStart = start + 2;
          const contentEnd = contentStart + (selectedText || "underlined text").length;
          return { nextText, selectionStart: contentStart, selectionEnd: contentEnd };
        });
        return;
      case "removeFormat":
        applyEditorTextTransformation((selectedText, fullText) => {
          const editor = editorRef.current;
          const start = editor?.selectionStart ?? 0;
          const end = editor?.selectionEnd ?? start;
          const replacement = stripSimpleFormatting(selectedText || fullText);
          const nextText = selectedText
            ? `${fullText.slice(0, start)}${replacement}${fullText.slice(end)}`
            : replacement;
          const nextEnd = selectedText ? start + replacement.length : replacement.length;
          return { nextText, selectionStart: selectedText ? start : 0, selectionEnd: nextEnd };
        });
        return;
      case "formatBlock": {
        const prefix = value === "H1" ? "# " : value === "H2" ? "## " : value === "BLOCKQUOTE" ? "> " : "";
        if (!prefix) return;
        applyEditorTextTransformation((selectedText, fullText) => {
          const editor = editorRef.current;
          const start = editor?.selectionStart ?? 0;
          const end = editor?.selectionEnd ?? start;
          const target = selectedText || "";
          const replacement = prefixLines(target || "New line", prefix);
          const nextText = `${fullText.slice(0, start)}${replacement}${fullText.slice(end)}`;
          return { nextText, selectionStart: start, selectionEnd: start + replacement.length };
        });
        return;
      }
      case "insertHorizontalRule":
        applyEditorTextTransformation((_selectedText, fullText) => {
          const editor = editorRef.current;
          const start = editor?.selectionStart ?? 0;
          const end = editor?.selectionEnd ?? start;
          const replacement = "\n---\n";
          const nextText = `${fullText.slice(0, start)}${replacement}${fullText.slice(end)}`;
          const caret = start + replacement.length;
          return { nextText, selectionStart: caret, selectionEnd: caret };
        });
        return;
      case "insertUnorderedList":
        applyEditorTextTransformation((selectedText, fullText) => {
          const editor = editorRef.current;
          const start = editor?.selectionStart ?? 0;
          const end = editor?.selectionEnd ?? start;
          const replacement = prefixLines(selectedText || "List item", "- ");
          const nextText = `${fullText.slice(0, start)}${replacement}${fullText.slice(end)}`;
          return { nextText, selectionStart: start, selectionEnd: start + replacement.length };
        });
        return;
      case "insertOrderedList":
        applyEditorTextTransformation((selectedText, fullText) => {
          const editor = editorRef.current;
          const start = editor?.selectionStart ?? 0;
          const end = editor?.selectionEnd ?? start;
          const source = (selectedText || "List item").split("\n");
          const replacement = source.map((line, index) => `${index + 1}. ${line || "Item"}`).join("\n");
          const nextText = `${fullText.slice(0, start)}${replacement}${fullText.slice(end)}`;
          return { nextText, selectionStart: start, selectionEnd: start + replacement.length };
        });
        return;
      default:
        return;
    }
  }

  function applyHighlightColor(value: string) {
    void value;
    applyEditorTextTransformation((selectedText, fullText) => {
      const editor = editorRef.current;
      const start = editor?.selectionStart ?? 0;
      const end = editor?.selectionEnd ?? start;
      const wrapped = `==${selectedText || "highlight"}==`;
      const nextText = `${fullText.slice(0, start)}${wrapped}${fullText.slice(end)}`;
      const contentStart = start + 2;
      const contentEnd = contentStart + (selectedText || "highlight").length;
      return { nextText, selectionStart: contentStart, selectionEnd: contentEnd };
    });
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
    setSelectedNoteId((current) => (current === noteId ? null : current));
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

  const handleRetrySync = useCallback(async () => {
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
          : null;
      setSelectedNoteId(nextSelectedNoteId);

        const selectedAfterRetry =
          result.notes.find((note) => note.id === nextSelectedNoteId) ?? null;
      const repairedEditorText = resolvePreferredEditorText(
        currentUser.uid,
        selectedAfterRetry,
        editorRef.current?.value ?? editorBodyDraftRef.current,
      );

      if (selectedAfterRetry && repairedEditorText !== editorBodyDraftRef.current) {
        setEditorBodyDraft(repairedEditorText);
        if (editorRef.current && editorRef.current.value !== repairedEditorText) {
          editorRef.current.value = repairedEditorText;
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
  }, [flushSelectedNoteDraft]);

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
      if (bodyAutosaveTimeoutRef.current) {
        window.clearTimeout(bodyAutosaveTimeoutRef.current);
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
    createWorkspaceNoteFromDraft,
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
