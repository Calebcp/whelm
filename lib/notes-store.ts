import type { User } from "firebase/auth";

export type WorkspaceNote = {
  id: string;
  title: string;
  body: string;
  color: string;
  updatedAtISO: string;
  createdAtISO: string;
};

export type NotesSyncResult = {
  notes: WorkspaceNote[];
  synced: boolean;
  message?: string;
};

const storagePrefix = "whelm:notes:";

function storageKey(uid: string) {
  return `${storagePrefix}${uid}`;
}

function sortNotes(notes: WorkspaceNote[]) {
  return [...notes].sort((a, b) => (a.updatedAtISO < b.updatedAtISO ? 1 : -1));
}

function normalizeNotes(notes: WorkspaceNote[]) {
  return sortNotes(
    notes
      .filter((note) => note.id && typeof note.title === "string" && typeof note.body === "string")
      .map((note) => ({
        id: note.id,
        title: note.title.slice(0, 200),
        body: note.body.slice(0, 20000),
        color: typeof note.color === "string" && note.color ? note.color : "gray",
        updatedAtISO: note.updatedAtISO,
        createdAtISO: note.createdAtISO,
      })),
  );
}

function dedupeById(notes: WorkspaceNote[]) {
  const byId = new Map<string, WorkspaceNote>();

  for (const note of notes) {
    const existing = byId.get(note.id);
    if (!existing || existing.updatedAtISO < note.updatedAtISO) {
      byId.set(note.id, note);
    }
  }

  return sortNotes([...byId.values()]);
}

function readLocalNotes(uid: string) {
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

async function authorizedRequest(
  user: User,
  input: string,
  init: RequestInit,
  timeoutMs = 12000,
) {
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
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(body?.error || response.statusText || "Notes request failed.");
    }

    return response;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function pushNotesToCloud(user: User, notes: WorkspaceNote[]) {
  await authorizedRequest(user, "/api/notes", {
    method: "POST",
    body: JSON.stringify({
      uid: user.uid,
      notes: normalizeNotes(notes),
    }),
  });
}

export async function loadNotes(user: User) {
  const localNotes = readLocalNotes(user.uid);

  try {
    const response = await authorizedRequest(
      user,
      `/api/notes?uid=${encodeURIComponent(user.uid)}`,
      { method: "GET" },
    );
    const body = (await response.json()) as { notes?: WorkspaceNote[] };
    const cloudNotes = Array.isArray(body.notes) ? normalizeNotes(body.notes) : [];
    const merged = dedupeById([...cloudNotes, ...localNotes]);

    writeLocalNotes(user.uid, merged);
    if (JSON.stringify(cloudNotes) !== JSON.stringify(merged)) {
      await pushNotesToCloud(user, merged);
    }

    return {
      notes: merged,
      synced: true,
    } as NotesSyncResult;
  } catch (error: unknown) {
    return {
      notes: localNotes,
      synced: false,
      message:
        error instanceof Error
          ? error.message
          : "Cloud sync unavailable. Local notes are still saved.",
    } as NotesSyncResult;
  }
}

export async function saveNotes(user: User, notes: WorkspaceNote[]) {
  const normalized = normalizeNotes(notes);
  writeLocalNotes(user.uid, normalized);

  try {
    await pushNotesToCloud(user, normalized);
    return {
      notes: normalized,
      synced: true,
    } as NotesSyncResult;
  } catch {
    return {
      notes: normalized,
      synced: false,
      message: "Saved locally. Cloud sync is currently unavailable.",
    } as NotesSyncResult;
  }
}

export async function retryNotesSync(user: User, notes: WorkspaceNote[]) {
  const normalized = normalizeNotes(notes);

  try {
    await pushNotesToCloud(user, normalized);
    return {
      synced: true,
    };
  } catch (error: unknown) {
    return {
      synced: false,
      message:
        error instanceof Error
          ? error.message
          : "Retry failed. Local notes are still safe.",
    };
  }
}
