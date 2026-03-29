"use client";

/**
 * Real-time Firestore sync via onSnapshot listeners.
 *
 * Every user-data collection has a single-document layout keyed by UID with a
 * JSON-blob field — the same format written by the REST API routes.  Sessions
 * are stored as individual documents in a flat collection queried by UID.
 *
 * Call `subscribeToUserData(uid, callbacks)` once after authentication.
 * It returns an unsubscribe function; call it on cleanup.
 */

import { collection, doc, onSnapshot, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { mergeNotesPreferNewest, type WorkspaceNote } from "@/lib/notes-store";
import type { PlannedBlockDoc } from "@/lib/planned-blocks-store";
import type { PreferencesState } from "@/lib/preferences-store";
import type { ReflectionState } from "@/lib/reflection-store";
import type { WhelCard } from "@/lib/cards-store";
import type { SessionDoc } from "@/lib/streak";

export type FirestoreSyncCallbacks = {
  /** Called when the remote notes document changes. */
  onNotes(notes: WorkspaceNote[]): void;
  /** Called when the remote planned-blocks document changes. */
  onBlocks(blocks: PlannedBlockDoc[]): void;
  /** Called when the remote preferences document changes. */
  onPreferences(prefs: PreferencesState): void;
  /** Called when the remote reflection-state document changes. */
  onReflection(state: ReflectionState): void;
  /** Called when the remote sessions collection changes. */
  onSessions(sessions: SessionDoc[]): void;
  /** Called when the remote cards document changes. */
  onCards(cards: WhelCard[]): void;
  /**
   * Return true while this device has an unsaved note-body draft in-flight.
   * When true the notes callback skips the currently-edited note to avoid
   * overwriting local edits.
   */
  isEditingNote(): boolean;
  /** Return the ID of the note currently being edited, or null. */
  editingNoteId(): string | null;
  /** Callback for the local note currently being edited when not editing. */
  localNote(id: string): WorkspaceNote | undefined;
};

export type FirestoreSyncOptions = {
  enableNotesRealtime?: boolean;
};

function warn(area: string, err: Error) {
  console.warn(`[whelm:sync] ${area} listener error:`, err.message);
}

/**
 * Set up real-time listeners for all user-data collections.
 * Returns an unsubscribe function.
 */
export function subscribeToUserData(
  uid: string,
  cb: FirestoreSyncCallbacks,
  options: FirestoreSyncOptions = {},
): () => void {
  const unsubs: (() => void)[] = [];
  let liveSubcollectionNotes: WorkspaceNote[] = [];
  let liveLegacyNotes: WorkspaceNote[] = [];
  const enableNotesRealtime = options.enableNotesRealtime ?? true;

  const emitMergedNotes = () => {
    const remote =
      liveSubcollectionNotes.length > 0
        ? liveSubcollectionNotes
        : mergeNotesPreferNewest(liveLegacyNotes, liveSubcollectionNotes);

    const editingId = cb.isEditingNote() ? cb.editingNoteId() : null;
    const merged = editingId
      ? remote.map((n) => (n.id === editingId ? (cb.localNote(editingId) ?? n) : n))
      : remote;

    cb.onNotes(merged);
  };

  // ── Notes (subcollection — each note is its own document) ────
  if (enableNotesRealtime) {
    unsubs.push(
      onSnapshot(
        collection(db, "userNotes", uid, "notes"),
        (snap) => {
          liveSubcollectionNotes = snap.docs.map((d) => d.data() as WorkspaceNote);
          emitMergedNotes();
        },
        (err) => warn("notes", err),
      ),
    );

    unsubs.push(
      onSnapshot(
        doc(db, "userNotes", uid),
        (snap) => {
          if (!snap.exists()) {
            liveLegacyNotes = [];
            emitMergedNotes();
            return;
          }

          const raw = snap.data()?.notesJson;
          if (typeof raw !== "string") {
            liveLegacyNotes = [];
            emitMergedNotes();
            return;
          }

          try {
            const parsed = JSON.parse(raw) as WorkspaceNote[];
            liveLegacyNotes = Array.isArray(parsed) ? parsed : [];
          } catch {
            liveLegacyNotes = [];
          }

          emitMergedNotes();
        },
        (err) => warn("notes-legacy", err),
      ),
    );
  }

  // ── Planned blocks ────────────────────────────────────────────
  unsubs.push(
    onSnapshot(
      doc(db, "userPlannedBlocks", uid),
      (snap) => {
        if (!snap.exists()) return;
        const json = snap.data()?.blocksJson;
        if (typeof json !== "string") return;
        try {
          const parsed = JSON.parse(json) as PlannedBlockDoc[];
          if (Array.isArray(parsed)) cb.onBlocks(parsed);
        } catch { /* ignore */ }
      },
      (err) => warn("blocks", err),
    ),
  );

  // ── Preferences ───────────────────────────────────────────────
  unsubs.push(
    onSnapshot(
      doc(db, "userPreferences", uid),
      (snap) => {
        if (!snap.exists()) return;
        const json = snap.data()?.preferencesJson;
        if (typeof json !== "string") return;
        try {
          const parsed = JSON.parse(json);
          if (parsed && typeof parsed === "object") cb.onPreferences(parsed as PreferencesState);
        } catch { /* ignore */ }
      },
      (err) => warn("preferences", err),
    ),
  );

  // ── Reflection / sick-day saves ───────────────────────────────
  unsubs.push(
    onSnapshot(
      doc(db, "userReflectionState", uid),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        try {
          const mirrorEntries = d?.mirrorEntriesJson
            ? (JSON.parse(d.mirrorEntriesJson as string) as ReflectionState["mirrorEntries"])
            : [];
          const sickDaySaves = d?.sickDaySavesJson
            ? (JSON.parse(d.sickDaySavesJson as string) as ReflectionState["sickDaySaves"])
            : [];
          const sickDaySaveDismissals = d?.sickDaySaveDismissalsJson
            ? (JSON.parse(d.sickDaySaveDismissalsJson as string) as string[])
            : [];
          cb.onReflection({
            mirrorEntries: Array.isArray(mirrorEntries) ? mirrorEntries : [],
            sickDaySaves: Array.isArray(sickDaySaves) ? sickDaySaves : [],
            sickDaySaveDismissals: Array.isArray(sickDaySaveDismissals) ? sickDaySaveDismissals : [],
          });
        } catch { /* ignore */ }
      },
      (err) => warn("reflection", err),
    ),
  );

  // ── Sessions (individual docs keyed by uid field) ─────────────
  unsubs.push(
    onSnapshot(
      query(collection(db, "sessions"), where("uid", "==", uid)),
      (snapshot) => {
        const sessions: SessionDoc[] = snapshot.docs
          .map((d) => {
            const data = d.data();
            const cat = data.category as string;
            return {
              uid: String(data.uid ?? ""),
              completedAtISO: String(data.completedAtISO ?? ""),
              minutes: Number(data.minutes) || 25,
              category: cat === "language" || cat === "software" ? cat : "misc",
              note: (data.note as string) || undefined,
              noteSavedAtISO: (data.noteSavedAtISO as string) || undefined,
            } as SessionDoc;
          })
          .filter((s) => Boolean(s.uid) && Boolean(s.completedAtISO));
        cb.onSessions(sessions);
      },
      (err) => warn("sessions", err),
    ),
  );

  // ── Cards ─────────────────────────────────────────────────────
  unsubs.push(
    onSnapshot(
      doc(db, "userCards", uid),
      (snap) => {
        if (!snap.exists()) return;
        const json = snap.data()?.cardsJson;
        if (typeof json !== "string") return;
        try {
          const parsed = JSON.parse(json) as WhelCard[];
          if (Array.isArray(parsed)) cb.onCards(parsed);
        } catch { /* ignore */ }
      },
      (err) => warn("cards", err),
    ),
  );

  return () => unsubs.forEach((u) => u());
}
