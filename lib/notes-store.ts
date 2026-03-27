import type { User } from "firebase/auth";

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
  await authorizedRequest(user, resolveApiUrl("/api/notes"), {
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
      resolveApiUrl(`/api/notes?uid=${encodeURIComponent(user.uid)}`),
      { method: "GET" },
    );
    const body = (await response.json()) as { notes?: WorkspaceNote[] };
    const cloudNotes = Array.isArray(body.notes) ? normalizeNotes(body.notes) : [];
    const mergedNotes = mergeNotesPreferNewest(localNotes, cloudNotes);
    writeLocalNotes(user.uid, mergedNotes);

    if (!notesMatch(mergedNotes, cloudNotes)) {
      try {
        await pushNotesToCloud(user, mergedNotes);
      } catch {
        return {
          notes: mergedNotes,
          synced: false,
          message: "Recovered newer local notes. Cloud sync is still catching up.",
        } as NotesSyncResult;
      }
    }

    return {
      notes: mergedNotes,
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
