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

import { db } from "@/lib/firebase";

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

export type NotesSyncResult = {
  notes: WorkspaceNote[];
  synced: boolean;
  message?: string;
};

const storagePrefix = "whelm:notes:";
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
  window.localStorage.setItem(storageKey(uid), JSON.stringify(normalizeNotes(notes)));
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
    if (!existing || existing.updatedAtISO < note.updatedAtISO) {
      merged.set(note.id, note);
    }
  }

  return normalizeNotes([...merged.values()]);
}

export function saveNotesLocally(uid: string, notes: WorkspaceNote[]) {
  writeLocalNotes(uid, notes);
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
    await setDoc(firestoreDoc(db, "userNotes", uid, "notes", target.id), target, { merge: true });
    console.log("[whelm] saveNoteToFirestore: wrote userNotes/" + uid + "/notes/" + target.id);
    return { notes: [target], synced: true };
  } catch (err) {
    console.error("[whelm] saveNoteToFirestore: FAILED for userNotes/" + uid + "/notes/" + target.id, err);
    return { notes: [target], synced: false, message: "Saved locally. Cloud sync is currently unavailable." };
  }
}

/**
 * Delete a single note document from `userNotes/{uid}/notes/{noteId}`.
 * Throws on failure so the caller can handle the sync-status update.
 */
export async function deleteNoteFromFirestore(uid: string, noteId: string): Promise<void> {
  await deleteDoc(firestoreDoc(db, "userNotes", uid, "notes", noteId));
}

// ── Bulk helpers (used for initial load and retry sync) ───────────────────────

export async function loadNotes(user: User): Promise<NotesSyncResult> {
  const localNotes = readLocalNotes(user.uid);

  try {
    const snap = await getDocs(collection(db, "userNotes", user.uid, "notes"));
    const cloudNotes = normalizeNotes(snap.docs.map((d) => d.data() as WorkspaceNote));
    const mergedNotes = mergeNotesPreferNewest(localNotes, cloudNotes);
    writeLocalNotes(user.uid, mergedNotes);

    // Push any local-only or newer-local notes up to Firestore.
    if (!notesMatch(mergedNotes, cloudNotes)) {
      const toSync = mergedNotes.filter(
        (n) => !cloudNotes.some((c) => c.id === n.id && c.updatedAtISO >= n.updatedAtISO),
      );
      await Promise.allSettled(
        toSync.map((n) =>
          setDoc(firestoreDoc(db, "userNotes", user.uid, "notes", n.id), n, { merge: true }),
        ),
      );
    }

    return { notes: mergedNotes, synced: true };
  } catch (error: unknown) {
    return {
      notes: localNotes,
      synced: false,
      message:
        error instanceof Error
          ? error.message
          : "Cloud sync unavailable. Local notes are still saved.",
    };
  }
}

export async function saveNotes(user: User, notes: WorkspaceNote[]): Promise<NotesSyncResult> {
  const normalized = normalizeNotes(notes);
  writeLocalNotes(user.uid, normalized);

  try {
    await Promise.all(
      normalized.map((note) =>
        setDoc(firestoreDoc(db, "userNotes", user.uid, "notes", note.id), note, { merge: true }),
      ),
    );
    return { notes: normalized, synced: true };
  } catch {
    return {
      notes: normalized,
      synced: false,
      message: "Saved locally. Cloud sync is currently unavailable.",
    };
  }
}

export async function retryNotesSync(user: User, notes: WorkspaceNote[]) {
  const result = await saveNotes(user, notes);
  return { synced: result.synced, message: result.message };
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
  // If the subcollection already has any documents, nothing to migrate.
  const existingSnap = await getDocs(collection(db, "userNotes", uid, "notes"));
  if (!existingSnap.empty) {
    console.log("[whelm:migration] subcollection already has docs — skipping", existingSnap.size);
    return;
  }

  console.log("[whelm:migration] subcollection is empty — reading legacy notesJson blob");

  // Read the old single-document format.
  const oldSnap = await getDoc(firestoreDoc(db, "userNotes", uid));
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

  console.log(`[whelm:migration] migrating ${oldNotes.length} notes to subcollection`);

  const results = await Promise.allSettled(
    oldNotes.map((note) =>
      setDoc(firestoreDoc(db, "userNotes", uid, "notes", note.id), note, { merge: true }),
    ),
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  console.log(`[whelm:migration] done — ${oldNotes.length - failed} written, ${failed} failed`);
}
