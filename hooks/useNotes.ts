"use client";

import { useMemo } from "react";

import { countWords, dayKeyLocal } from "@/lib/date-utils";
import type { WorkspaceNote } from "@/lib/notes-store";

export type { WorkspaceNote };

type NotesSyncStatus = "synced" | "syncing" | "local-only" | "error";

type UseNotesInput = {
  notes: WorkspaceNote[];
  notesSyncStatus: NotesSyncStatus;
  notesSyncMessage: string;
  notesSearch: string;
  notesCategoryFilter: "all" | "personal" | "school" | "work";
  selectedNoteId: string | null;
};

/**
 * Derives computed note values from raw notes state.
 * In Phase 3, this hook will own its own Firestore subscription and mutations.
 * For now it accepts state from page.tsx and computes derived values.
 */
export function useNotes({
  notes,
  notesSyncStatus,
  notesSyncMessage,
  notesSearch,
  notesCategoryFilter,
  selectedNoteId,
}: UseNotesInput) {
  const noteWordsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const note of notes) {
      const key = dayKeyLocal(note.updatedAtISO);
      map.set(key, (map.get(key) ?? 0) + countWords(note.body));
    }
    return map;
  }, [notes]);

  const filteredNotes = useMemo(() => {
    let result = notes;
    if (notesCategoryFilter !== "all") {
      result = result.filter((n) => n.category === notesCategoryFilter);
    }
    if (notesSearch.trim()) {
      const q = notesSearch.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q),
      );
    }
    return result;
  }, [notes, notesCategoryFilter, notesSearch]);

  const pinnedNotes = useMemo(
    () => filteredNotes.filter((n) => n.isPinned),
    [filteredNotes],
  );

  const unpinnedNotes = useMemo(
    () => filteredNotes.filter((n) => !n.isPinned),
    [filteredNotes],
  );

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  );

  return {
    notes,
    noteWordsByDay,
    filteredNotes,
    pinnedNotes,
    unpinnedNotes,
    selectedNote,
    notesSyncStatus,
    notesSyncMessage,
  };
}
