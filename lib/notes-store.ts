"use client";

import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc as firestoreDoc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import { resolveApiUrl } from "@/lib/api-base";

export type WorkspaceNote = {
  id: string;
  title: string;
  body: string;
  attachments: NoteAttachment[];
  color: string;
  shellColor: string;
  surfaceStyle: "solid" | "airy";
  isPinned: boolean;
  fontFamily: string;
  fontSizePx: number;
  category: "personal" | "school" | "work";
  reminderAtISO: string;
  updatedAtISO: string;
  createdAtISO: string;
};

export type NoteAttachment = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: "image" | "document" | "spreadsheet" | "presentation" | "archive" | "text" | "other";
  storagePath: string;
  downloadUrl: string;
  uploadedAtISO: string;
};

export type NoteUpdatePatch = Partial<
  Pick<
    WorkspaceNote,
    | "title"
    | "body"
    | "attachments"
    | "color"
    | "shellColor"
    | "surfaceStyle"
    | "isPinned"
    | "fontFamily"
    | "fontSizePx"
    | "category"
    | "reminderAtISO"
    | "updatedAtISO"
    | "createdAtISO"
  >
>;

export type NotesSyncResult = {
  notes: WorkspaceNote[];
  synced: boolean;
  message?: string;
};

const storagePrefix = "whelm:notes:";
const pendingDeleteStoragePrefix = "whelm:notes:pending-delete:";
const NOTE_FIRESTORE_WRITE_TIMEOUT_MS = 4000;
const NOTE_FIRESTORE_READ_TIMEOUT_MS = 8000;
const legacyColorMap: Record<string, string> = {
  red: "#fecaca",
  green: "#bbf7d0",
  yellow: "#fef08a",
  blue: "#bfdbfe",
  gray: "#e7e5e4",
  violet: "#ddd6fe",
  pink: "#fbcfe8",
};

function storageKey(uid: string) {
  return `${storagePrefix}${uid}`;
}

function pendingDeleteStorageKey(uid: string) {
  return `${pendingDeleteStoragePrefix}${uid}`;
}

function sortNotes(notes: WorkspaceNote[]) {
  return [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return a.updatedAtISO < b.updatedAtISO ? 1 : -1;
  });
}

function normalizeNotes(notes: WorkspaceNote[]) {
  return sortNotes(
    notes
      .filter((note) => note.id && typeof note.title === "string" && typeof note.body === "string")
      .map((note) => ({
        id: note.id,
        title: note.title.slice(0, 200),
        body: note.body.slice(0, 20000),
        attachments: normalizeAttachments((note as WorkspaceNote).attachments),
        color:
          typeof note.color === "string" && note.color
            ? legacyColorMap[note.color] || note.color
            : "#e7e5e4",
        shellColor:
          typeof (note as WorkspaceNote).shellColor === "string" && (note as WorkspaceNote).shellColor
            ? legacyColorMap[(note as WorkspaceNote).shellColor] || (note as WorkspaceNote).shellColor
            : "#fff7d6",
        surfaceStyle:
          (note as WorkspaceNote).surfaceStyle === "airy" ? "airy" : "solid",
        isPinned: typeof note.isPinned === "boolean" ? note.isPinned : false,
        fontFamily:
          typeof note.fontFamily === "string" && note.fontFamily
            ? note.fontFamily
            : "Avenir Next",
        fontSizePx:
          typeof note.fontSizePx === "number" && Number.isFinite(note.fontSizePx)
            ? Math.min(32, Math.max(12, Math.round(note.fontSizePx)))
            : 16,
        category:
          note.category === "school" || note.category === "work" || note.category === "personal"
            ? note.category
            : "personal",
        reminderAtISO:
          typeof note.reminderAtISO === "string" ? note.reminderAtISO : "",
        updatedAtISO: note.updatedAtISO,
        createdAtISO: note.createdAtISO,
      })),
  );
}

function normalizeAttachments(attachments: WorkspaceNote["attachments"]) {
  if (!Array.isArray(attachments)) return [] as NoteAttachment[];

  return attachments
    .filter(
      (attachment) =>
        attachment &&
        typeof attachment.id === "string" &&
        typeof attachment.name === "string" &&
        typeof attachment.mimeType === "string" &&
        typeof attachment.storagePath === "string" &&
        typeof attachment.downloadUrl === "string" &&
        typeof attachment.uploadedAtISO === "string",
    )
    .map((attachment) => ({
      id: attachment.id,
      name: attachment.name.slice(0, 180),
      mimeType: attachment.mimeType.slice(0, 140),
      sizeBytes: Math.max(0, Math.round(Number(attachment.sizeBytes) || 0)),
      kind:
        attachment.kind === "image" ||
        attachment.kind === "document" ||
        attachment.kind === "spreadsheet" ||
        attachment.kind === "presentation" ||
        attachment.kind === "archive" ||
        attachment.kind === "text"
          ? attachment.kind
          : "other",
      storagePath: attachment.storagePath.slice(0, 500),
      downloadUrl: attachment.downloadUrl.slice(0, 2000),
      uploadedAtISO: attachment.uploadedAtISO,
    }) satisfies NoteAttachment)
    .sort((a, b) => (a.uploadedAtISO < b.uploadedAtISO ? 1 : -1));
}

function mergeAttachments(first: WorkspaceNote["attachments"], second: WorkspaceNote["attachments"]) {
  const merged = new Map<string, NoteAttachment>();

  for (const attachment of normalizeAttachments(second)) {
    merged.set(attachment.id, attachment);
  }

  for (const attachment of normalizeAttachments(first)) {
    const existing = merged.get(attachment.id);
    if (!existing || existing.uploadedAtISO < attachment.uploadedAtISO) {
      merged.set(attachment.id, attachment);
    }
  }

  return normalizeAttachments([...merged.values()]);
}

function pickPreferredTitle(newer: WorkspaceNote, older: WorkspaceNote) {
  const newerTitle = newer.title.trim();
  const olderTitle = older.title.trim();
  if (!newerTitle && olderTitle) return older.title;
  if (newerTitle === "Untitled note" && olderTitle && olderTitle !== "Untitled note") {
    return older.title;
  }
  return newer.title;
}

function isEffectivelyEmptyNoteBody(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]*>/g, "")
    .trim().length === 0;
}

function pickPreferredBody(newer: WorkspaceNote, older: WorkspaceNote) {
  const newerBodyEmpty = isEffectivelyEmptyNoteBody(newer.body);
  const olderBodyEmpty = isEffectivelyEmptyNoteBody(older.body);
  if (newerBodyEmpty && !olderBodyEmpty) return older.body;
  return newer.body;
}

function mergeNoteVersions(first: WorkspaceNote, second: WorkspaceNote) {
  const [newer, older] =
    first.updatedAtISO >= second.updatedAtISO ? [first, second] : [second, first];

  return normalizeNotes([
    {
      ...older,
      ...newer,
      title: pickPreferredTitle(newer, older),
      body: pickPreferredBody(newer, older),
      attachments: mergeAttachments(newer.attachments, older.attachments),
      createdAtISO: older.createdAtISO || newer.createdAtISO,
      updatedAtISO: newer.updatedAtISO >= older.updatedAtISO ? newer.updatedAtISO : older.updatedAtISO,
    },
  ])[0];
}

export function readLocalNotes(uid: string) {
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    if (!raw) return [] as WorkspaceNote[];

    const parsed = JSON.parse(raw) as WorkspaceNote[];
    return Array.isArray(parsed) ? normalizeNotes(parsed) : [];
  } catch {
    return [];
  }
}

function writeLocalNotes(uid: string, notes: WorkspaceNote[]) {
  try {
    window.localStorage.setItem(storageKey(uid), JSON.stringify(normalizeNotes(notes)));
  } catch {
    // localStorage can be unavailable in private browsing; keep in-memory notes alive.
  }
}

export function readPendingDeletedNoteIds(uid: string) {
  try {
    const raw = window.localStorage.getItem(pendingDeleteStorageKey(uid));
    if (!raw) return [] as string[];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [] as string[];
    return [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0))];
  } catch {
    return [] as string[];
  }
}

function writePendingDeletedNoteIds(uid: string, noteIds: string[]) {
  try {
    const normalized = [...new Set(noteIds.filter((id) => typeof id === "string" && id.length > 0))];
    if (normalized.length === 0) {
      window.localStorage.removeItem(pendingDeleteStorageKey(uid));
      return;
    }
    window.localStorage.setItem(pendingDeleteStorageKey(uid), JSON.stringify(normalized));
  } catch {
    // Ignore localStorage failures; in-memory note state still carries the delete.
  }
}

export function registerPendingDeletedNoteId(uid: string, noteId: string) {
  const current = readPendingDeletedNoteIds(uid);
  if (current.includes(noteId)) return;
  writePendingDeletedNoteIds(uid, [...current, noteId]);
}

export function clearPendingDeletedNoteId(uid: string, noteId: string) {
  const current = readPendingDeletedNoteIds(uid);
  if (current.length === 0) return;
  writePendingDeletedNoteIds(
    uid,
    current.filter((id) => id !== noteId),
  );
}

export function filterNotesAgainstPendingDeletes(uid: string, notes: WorkspaceNote[]) {
  const pendingDeletedNoteIds = new Set(readPendingDeletedNoteIds(uid));
  if (pendingDeletedNoteIds.size === 0) return normalizeNotes(notes);
  return normalizeNotes(notes.filter((note) => !pendingDeletedNoteIds.has(note.id)));
}

function timeoutError(message: string) {
  const error = new Error(message);
  error.name = "TimeoutError";
  return error;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId = 0;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(timeoutError(message)), timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function authorizedNotesRequest(user: User, input: string, init: RequestInit, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const token = await user.getIdToken();

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || response.statusText || "Notes request failed.");
    }

    return response;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function loadNotesFromApi(user: User) {
  const response = await authorizedNotesRequest(
    user,
    resolveApiUrl(`/api/notes?uid=${encodeURIComponent(user.uid)}`),
    { method: "GET" },
  );
  const body = (await response.json()) as { notes?: WorkspaceNote[] };
  return Array.isArray(body.notes) ? normalizeNotes(body.notes) : [];
}

async function saveNotesToApi(user: User, notes: WorkspaceNote[], timeoutMs = 8000) {
  await authorizedNotesRequest(
    user,
    resolveApiUrl("/api/notes"),
    {
      method: "POST",
      body: JSON.stringify({
        uid: user.uid,
        notes: normalizeNotes(notes),
      }),
    },
    timeoutMs,
  );
}

async function deleteSingleNoteFromApi(user: User, noteId: string, timeoutMs = 8000) {
  await authorizedNotesRequest(
    user,
    resolveApiUrl(`/api/notes?uid=${encodeURIComponent(user.uid)}&noteId=${encodeURIComponent(noteId)}`),
    {
      method: "DELETE",
    },
    timeoutMs,
  );
}

function notesMatch(a: WorkspaceNote[], b: WorkspaceNote[]) {
  return JSON.stringify(normalizeNotes(a)) === JSON.stringify(normalizeNotes(b));
}

export function mergeNotesPreferNewest(localNotes: WorkspaceNote[], cloudNotes: WorkspaceNote[]) {
  const merged = new Map<string, WorkspaceNote>();

  for (const note of cloudNotes) {
    merged.set(note.id, note);
  }

  for (const note of localNotes) {
    const existing = merged.get(note.id);
    if (!existing) {
      merged.set(note.id, note);
      continue;
    }
    merged.set(note.id, mergeNoteVersions(existing, note));
  }

  return normalizeNotes([...merged.values()]);
}

export function saveNotesLocally(uid: string, notes: WorkspaceNote[]) {
  writeLocalNotes(uid, notes);
}

async function syncLegacyNotesBlob(uid: string, notes: WorkspaceNote[]) {
  await withTimeout(
    setDoc(
      firestoreDoc(db, "userNotes", uid),
      {
        uid,
        notesJson: JSON.stringify(normalizeNotes(notes)),
        updatedAtISO: new Date().toISOString(),
      },
      { merge: true },
    ),
    NOTE_FIRESTORE_WRITE_TIMEOUT_MS,
    "Firestore legacy notes blob write timed out.",
  );
}

// ── Individual document writes ────────────────────────────────────────────────

/**
 * Write a single note to its own Firestore document at
 * `userNotes/{uid}/notes/{noteId}` using merge semantics.
 * Concurrent writes from different devices can never overwrite each other.
 */
export async function saveNoteToFirestore(uid: string, note: WorkspaceNote): Promise<NotesSyncResult> {
  const normalized = normalizeNotes([note]);
  const target = normalized[0];
  if (!target) return { notes: [note], synced: false };
  try {
    await withTimeout(
      setDoc(firestoreDoc(db, "userNotes", uid, "notes", target.id), target, { merge: true }),
      NOTE_FIRESTORE_WRITE_TIMEOUT_MS,
      "Firestore note write timed out.",
    );
    await syncLegacyNotesBlob(uid, readLocalNotes(uid));
    console.log("[whelm] saveNoteToFirestore: wrote userNotes/" + uid + "/notes/" + target.id);
    return { notes: [target], synced: true };
  } catch (err) {
    console.error("[whelm] saveNoteToFirestore: FAILED for userNotes/" + uid + "/notes/" + target.id, err);
    const currentUser = auth.currentUser;
    if (currentUser?.uid === uid) {
      try {
        await saveNotesToApi(currentUser, [target]);
        console.log("[whelm] saveNoteToFirestore: api fallback wrote userNotes/" + uid + "/notes/" + target.id);
        return { notes: [target], synced: true };
      } catch (apiErr) {
        console.error("[whelm] saveNoteToFirestore: API FALLBACK failed for userNotes/" + uid + "/notes/" + target.id, apiErr);
      }
    }
    return { notes: [target], synced: false, message: "Saved locally. Cloud sync is currently pending." };
  }
}

function normalizeNotePatch(patch: NoteUpdatePatch): NoteUpdatePatch {
  const normalized: NoteUpdatePatch = {};

  if ("title" in patch && typeof patch.title === "string") normalized.title = patch.title.slice(0, 200);
  if ("body" in patch && typeof patch.body === "string") normalized.body = patch.body.slice(0, 20000);
  if ("attachments" in patch && Array.isArray(patch.attachments)) {
    normalized.attachments = normalizeAttachments(patch.attachments);
  }
  if ("color" in patch && typeof patch.color === "string") normalized.color = legacyColorMap[patch.color] || patch.color;
  if ("shellColor" in patch && typeof patch.shellColor === "string") {
    normalized.shellColor = legacyColorMap[patch.shellColor] || patch.shellColor;
  }
  if ("surfaceStyle" in patch) normalized.surfaceStyle = patch.surfaceStyle === "airy" ? "airy" : "solid";
  if ("isPinned" in patch && typeof patch.isPinned === "boolean") normalized.isPinned = patch.isPinned;
  if ("fontFamily" in patch && typeof patch.fontFamily === "string") normalized.fontFamily = patch.fontFamily;
  if ("fontSizePx" in patch && typeof patch.fontSizePx === "number" && Number.isFinite(patch.fontSizePx)) {
    normalized.fontSizePx = Math.min(32, Math.max(12, Math.round(patch.fontSizePx)));
  }
  if ("category" in patch) {
    normalized.category =
      patch.category === "school" || patch.category === "work" || patch.category === "personal"
        ? patch.category
        : "personal";
  }
  if ("reminderAtISO" in patch && typeof patch.reminderAtISO === "string") normalized.reminderAtISO = patch.reminderAtISO;
  if ("updatedAtISO" in patch && typeof patch.updatedAtISO === "string") normalized.updatedAtISO = patch.updatedAtISO;
  if ("createdAtISO" in patch && typeof patch.createdAtISO === "string") normalized.createdAtISO = patch.createdAtISO;

  return normalized;
}

export async function saveNotePatchToFirestore(
  uid: string,
  noteId: string,
  patch: NoteUpdatePatch,
): Promise<NotesSyncResult> {
  const normalizedPatch = normalizeNotePatch(patch);

  try {
    await withTimeout(
      setDoc(firestoreDoc(db, "userNotes", uid, "notes", noteId), normalizedPatch, { merge: true }),
      NOTE_FIRESTORE_WRITE_TIMEOUT_MS,
      "Firestore note patch timed out.",
    );
    await syncLegacyNotesBlob(uid, readLocalNotes(uid));
    console.log("[whelm] saveNotePatchToFirestore: wrote userNotes/" + uid + "/notes/" + noteId, {
      fields: Object.keys(normalizedPatch),
    });
    return { notes: [], synced: true };
  } catch (err) {
    console.error("[whelm] saveNotePatchToFirestore: FAILED for userNotes/" + uid + "/notes/" + noteId, err);
    const currentUser = auth.currentUser;
    const currentLocalNotes = currentUser?.uid === uid ? readLocalNotes(uid) : [];
    const fallbackNote = currentLocalNotes.find((note) => note.id === noteId);
    if (currentUser?.uid === uid && fallbackNote) {
      try {
        await saveNotesToApi(currentUser, [fallbackNote]);
        console.log("[whelm] saveNotePatchToFirestore: api fallback wrote userNotes/" + uid + "/notes/" + noteId, {
          fields: Object.keys(normalizedPatch),
        });
        return { notes: [], synced: true };
      } catch (apiErr) {
        console.error("[whelm] saveNotePatchToFirestore: API FALLBACK failed for userNotes/" + uid + "/notes/" + noteId, apiErr);
      }
    }
    return { notes: [], synced: false, message: "Saved locally. Cloud sync is currently pending." };
  }
}

/**
 * Delete a single note document from `userNotes/{uid}/notes/{noteId}`.
 * Throws on failure so the caller can handle the sync-status update.
 */
export async function deleteNoteFromFirestore(uid: string, noteId: string): Promise<void> {
  try {
    await withTimeout(
      deleteDoc(firestoreDoc(db, "userNotes", uid, "notes", noteId)),
      NOTE_FIRESTORE_WRITE_TIMEOUT_MS,
      "Firestore note delete timed out.",
    );
    await syncLegacyNotesBlob(
      uid,
      readLocalNotes(uid).filter((note) => note.id !== noteId),
    );
  } catch (error) {
    const currentUser = auth.currentUser;
    if (currentUser?.uid === uid) {
      try {
        await deleteSingleNoteFromApi(currentUser, noteId);
        return;
      } catch {
        // Fall through to the original failure.
      }
    }
    throw error;
  }
}

export async function flushPendingDeletedNotes(user: User) {
  const pendingDeletedNoteIds = readPendingDeletedNoteIds(user.uid);
  if (pendingDeletedNoteIds.length === 0) return [] as string[];

  const settled = await Promise.allSettled(
    pendingDeletedNoteIds.map(async (noteId) => {
      await deleteNoteFromFirestore(user.uid, noteId);
      return noteId;
    }),
  );

  const clearedNoteIds = settled
    .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
    .map((result) => result.value);

  if (clearedNoteIds.length > 0) {
    writePendingDeletedNoteIds(
      user.uid,
      pendingDeletedNoteIds.filter((noteId) => !clearedNoteIds.includes(noteId)),
    );
  }

  return pendingDeletedNoteIds.filter((noteId) => !clearedNoteIds.includes(noteId));
}

// ── Bulk helpers (used for initial load and retry sync) ───────────────────────

export async function loadNotes(user: User): Promise<NotesSyncResult> {
  const localNotes = filterNotesAgainstPendingDeletes(user.uid, readLocalNotes(user.uid));

  try {
    let healingWriteFailed = false;
    const snap = await withTimeout(
      getDocs(collection(db, "userNotes", user.uid, "notes")),
      NOTE_FIRESTORE_READ_TIMEOUT_MS,
      "Firestore note list timed out.",
    );
    const subcollectionNotes = normalizeNotes(snap.docs.map((d) => d.data() as WorkspaceNote));
    let legacyNotes: WorkspaceNote[] = [];
    const legacySnap = await withTimeout(
      getDoc(firestoreDoc(db, "userNotes", user.uid)),
      NOTE_FIRESTORE_READ_TIMEOUT_MS,
      "Firestore legacy note read timed out.",
    );
    const raw = legacySnap.data()?.notesJson;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw) as WorkspaceNote[];
        legacyNotes = Array.isArray(parsed) ? normalizeNotes(parsed) : [];
      } catch {
        legacyNotes = [];
      }
    }

    await flushPendingDeletedNotes(user);
    const cloudNotes = filterNotesAgainstPendingDeletes(
      user.uid,
      mergeNotesPreferNewest(legacyNotes, subcollectionNotes),
    );
    const mergedNotes = filterNotesAgainstPendingDeletes(user.uid, mergeNotesPreferNewest(localNotes, cloudNotes));
    writeLocalNotes(user.uid, mergedNotes);

    // Push any local-only or newer-local notes up to Firestore.
    if (!notesMatch(mergedNotes, subcollectionNotes)) {
      const toSync = mergedNotes.filter(
        (n) => !subcollectionNotes.some((c) => c.id === n.id && c.updatedAtISO >= n.updatedAtISO),
      );
      const healingResults = await withTimeout(
        Promise.allSettled(
          toSync.map((n) =>
            setDoc(firestoreDoc(db, "userNotes", user.uid, "notes", n.id), n, { merge: true }),
          ),
        ),
        NOTE_FIRESTORE_READ_TIMEOUT_MS,
        "Firestore note healing write timed out.",
      );
      healingWriteFailed = healingResults.some((result) => result.status === "rejected");
    }

    return {
      notes: mergedNotes,
      synced: !healingWriteFailed,
      message: healingWriteFailed ? "Saved locally. Cloud sync is currently pending." : "",
    };
  } catch (error: unknown) {
    try {
      const apiNotes = await loadNotesFromApi(user);
      const mergedNotes = filterNotesAgainstPendingDeletes(
        user.uid,
        mergeNotesPreferNewest(localNotes, apiNotes),
      );
      writeLocalNotes(user.uid, mergedNotes);
      return {
        notes: mergedNotes,
        synced: true,
        message: "",
      };
    } catch (apiError: unknown) {
      return {
        notes: localNotes,
        synced: false,
        message:
          apiError instanceof Error
            ? apiError.message
            : error instanceof Error
              ? error.message
              : "Cloud sync unavailable. Local notes are still saved.",
      };
    }
  }
}

export async function saveNotes(user: User, notes: WorkspaceNote[]): Promise<NotesSyncResult> {
  const normalized = filterNotesAgainstPendingDeletes(user.uid, normalizeNotes(notes));
  writeLocalNotes(user.uid, normalized);

  try {
    await flushPendingDeletedNotes(user);
    const existingSubcollectionSnap = await withTimeout(
      getDocs(collection(db, "userNotes", user.uid, "notes")),
      NOTE_FIRESTORE_READ_TIMEOUT_MS,
      "Firestore note list timed out while syncing.",
    );
    const existingSubcollectionNotes = normalizeNotes(
      existingSubcollectionSnap.docs.map((doc) => doc.data() as WorkspaceNote),
    );
    const existingLegacySnap = await withTimeout(
      getDoc(firestoreDoc(db, "userNotes", user.uid)),
      NOTE_FIRESTORE_READ_TIMEOUT_MS,
      "Firestore legacy note read timed out while syncing.",
    );
    let existingLegacyNotes: WorkspaceNote[] = [];

    if (existingLegacySnap.exists()) {
      const rawLegacy = existingLegacySnap.data()?.notesJson;
      if (typeof rawLegacy === "string") {
        try {
          const parsed = JSON.parse(rawLegacy) as WorkspaceNote[];
          existingLegacyNotes = Array.isArray(parsed) ? normalizeNotes(parsed) : [];
        } catch {
          existingLegacyNotes = [];
        }
      }
    }

    const mergedCloudNotes = filterNotesAgainstPendingDeletes(
      user.uid,
      mergeNotesPreferNewest(existingLegacyNotes, existingSubcollectionNotes),
    );
    const mergedNotes = normalized;

    await withTimeout(
      Promise.all(
        mergedNotes.map((note) =>
          setDoc(firestoreDoc(db, "userNotes", user.uid, "notes", note.id), note, { merge: true }),
        ),
      ),
      NOTE_FIRESTORE_READ_TIMEOUT_MS,
      "Firestore note write timed out while syncing.",
    );
    await withTimeout(
      Promise.all(
        mergedCloudNotes
          .filter((note) => !mergedNotes.some((localNote) => localNote.id === note.id))
          .map((note) => deleteDoc(firestoreDoc(db, "userNotes", user.uid, "notes", note.id))),
      ),
      NOTE_FIRESTORE_READ_TIMEOUT_MS,
      "Firestore note delete timed out while syncing.",
    );
    await syncLegacyNotesBlob(user.uid, mergedNotes);
    writeLocalNotes(user.uid, mergedNotes);
    return { notes: mergedNotes, synced: true };
  } catch (error) {
    try {
      await saveNotesToApi(user, normalized);
      return { notes: normalized, synced: true };
    } catch {
      console.warn("[whelm:notes] saveNotes fell back to local-only", error);
    }
    return {
      notes: normalized,
      synced: false,
      message: "Saved locally. Cloud sync is currently pending.",
    };
  }
}

export async function retryNotesSync(user: User, notes: WorkspaceNote[]) {
  await flushPendingDeletedNotes(user);
  const currentLocalNotes = filterNotesAgainstPendingDeletes(
    user.uid,
    mergeNotesPreferNewest(readLocalNotes(user.uid), notes),
  );
  writeLocalNotes(user.uid, currentLocalNotes);

  console.info("[whelm:notes] retry sync started", {
    uid: user.uid,
    localCount: currentLocalNotes.length,
  });

  const loaded = await loadNotes(user);
  const reconciledNotes = filterNotesAgainstPendingDeletes(
    user.uid,
    mergeNotesPreferNewest(currentLocalNotes, loaded.notes),
  );
  writeLocalNotes(user.uid, reconciledNotes);

  if (notesMatch(reconciledNotes, loaded.notes) && loaded.synced) {
    return {
      notes: reconciledNotes,
      synced: loaded.synced,
      message: loaded.message,
    };
  }

  const saved = await saveNotes(user, reconciledNotes);
  const verified = await loadNotes(user);
  const finalNotes = filterNotesAgainstPendingDeletes(
    user.uid,
    mergeNotesPreferNewest(reconciledNotes, verified.notes),
  );
  writeLocalNotes(user.uid, finalNotes);

  return {
    notes: finalNotes,
    synced: saved.synced && verified.synced,
    message:
      saved.synced && verified.synced
        ? ""
        : (verified.message ?? saved.message ?? "Cloud sync is still pending."),
  };
}

// ── One-time migration ────────────────────────────────────────────────────────

/**
 * Reads the legacy `notesJson` blob from `userNotes/{uid}` and writes each
 * note as its own document to `userNotes/{uid}/notes/{noteId}`.
 *
 * Gate: if the subcollection already has documents, the migration already ran
 * (or notes were written by the new code), so we skip immediately.
 * This avoids depending on `userPreferences` which has no security rule.
 */
export async function migrateNotesFromJson(uid: string): Promise<void> {
  const existingSnap = await withTimeout(
    getDocs(collection(db, "userNotes", uid, "notes")),
    NOTE_FIRESTORE_READ_TIMEOUT_MS,
    "Firestore note migration read timed out.",
  );
  const existingNotes = normalizeNotes(existingSnap.docs.map((doc) => doc.data() as WorkspaceNote));
  console.log("[whelm:migration] reading legacy notesJson blob for merge", existingNotes.length);

  // Read the old single-document format.
  const oldSnap = await withTimeout(
    getDoc(firestoreDoc(db, "userNotes", uid)),
    NOTE_FIRESTORE_READ_TIMEOUT_MS,
    "Firestore legacy note migration read timed out.",
  );
  if (!oldSnap.exists()) {
    console.log("[whelm:migration] no legacy document found — nothing to migrate");
    return;
  }

  const raw = oldSnap.data()?.notesJson;
  if (typeof raw !== "string") {
    console.log("[whelm:migration] legacy document has no notesJson string — nothing to migrate");
    return;
  }

  let oldNotes: WorkspaceNote[] = [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    oldNotes = Array.isArray(parsed) ? normalizeNotes(parsed as WorkspaceNote[]) : [];
  } catch {
    console.warn("[whelm:migration] failed to parse legacy notesJson");
  }

  if (oldNotes.length === 0) {
    console.log("[whelm:migration] legacy notesJson parsed to zero notes — nothing to migrate");
    return;
  }

  const mergedNotes = mergeNotesPreferNewest(oldNotes, existingNotes).filter(
    (note) => !existingNotes.some((existing) => existing.id === note.id && existing.updatedAtISO >= note.updatedAtISO),
  );

  if (mergedNotes.length === 0) {
    console.log("[whelm:migration] subcollection already has equal or newer notes — nothing to migrate");
    return;
  }

  console.log(`[whelm:migration] migrating ${mergedNotes.length} merged notes to subcollection`);

  const results = await withTimeout(
    Promise.allSettled(
      mergedNotes.map((note) =>
        setDoc(firestoreDoc(db, "userNotes", uid, "notes", note.id), note, { merge: true }),
      ),
    ),
    NOTE_FIRESTORE_READ_TIMEOUT_MS,
    "Firestore note migration write timed out.",
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  console.log(`[whelm:migration] done — ${mergedNotes.length - failed} written, ${failed} failed`);
}
