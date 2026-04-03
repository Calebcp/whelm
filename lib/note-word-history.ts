import { countWords, dayKeyLocal } from "@/lib/date-utils";
import type { WorkspaceNote, NoteRevision } from "@/lib/notes-store";

export function buildNoteWordsByDayFromHistory({
  notes,
  getRevisions,
}: {
  notes: WorkspaceNote[];
  getRevisions?: (noteId: string) => NoteRevision[];
}) {
  const totalsByDay = new Map<string, number>();

  for (const note of notes) {
    const bestWordCountByDay = new Map<string, number>();
    const noteEntries = [
      {
        dateKey: dayKeyLocal(note.updatedAtISO),
        words: countWords(note.body),
      },
      ...((getRevisions?.(note.id) ?? []).map((revision) => ({
        dateKey: dayKeyLocal(revision.sourceUpdatedAtISO),
        words: countWords(revision.body),
      }))),
    ];

    for (const entry of noteEntries) {
      if (entry.words <= 0) continue;
      bestWordCountByDay.set(
        entry.dateKey,
        Math.max(bestWordCountByDay.get(entry.dateKey) ?? 0, entry.words),
      );
    }

    for (const [dateKey, words] of bestWordCountByDay.entries()) {
      totalsByDay.set(dateKey, (totalsByDay.get(dateKey) ?? 0) + words);
    }
  }

  return totalsByDay;
}
