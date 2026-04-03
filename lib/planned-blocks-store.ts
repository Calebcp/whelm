import type { User } from "firebase/auth";

import { resolveApiUrl } from "@/lib/api-base";

export type PlannedBlockDoc = {
  id: string;
  dateKey: string;
  title: string;
  note: string;
  attachmentCount?: number;
  tone?: string;
  durationMinutes: number;
  timeOfDay: string;
  sortOrder: number;
  createdAtISO: string;
  updatedAtISO: string;
  status: "active" | "completed" | "deleted";
  completedAtISO?: string;
};

export type PlannedBlocksSyncResult = {
  blocks: PlannedBlockDoc[];
  synced: boolean;
  message?: string;
};

const storagePrefix = "whelm:planned-blocks:";
const MIN_PLANNED_BLOCK_MINUTES = 15;
const MAX_PLANNED_BLOCK_MINUTES = 480;

function storageKey(uid: string) {
  return `${storagePrefix}${uid}`;
}

function sortBlocks(blocks: PlannedBlockDoc[]) {
  return [...blocks].sort((a, b) =>
    a.dateKey === b.dateKey
      ? a.sortOrder - b.sortOrder || a.timeOfDay.localeCompare(b.timeOfDay)
      : a.dateKey.localeCompare(b.dateKey),
  );
}

function normalizeBlocks(blocks: PlannedBlockDoc[]) {
  return sortBlocks(
    blocks
      .filter((item) => item.id && item.dateKey && item.title)
      .map((item, index) => {
        const createdAtISO =
          typeof item.createdAtISO === "string" && item.createdAtISO
            ? item.createdAtISO
            : new Date().toISOString();
        const updatedAtISO =
          typeof item.updatedAtISO === "string" && item.updatedAtISO
            ? item.updatedAtISO
            : createdAtISO;

        return {
          id: item.id,
          dateKey: String(item.dateKey).slice(0, 10),
          title: String(item.title).slice(0, 80),
          note: String(item.note ?? "").slice(0, 280),
          attachmentCount: Math.max(0, Math.round(Number(item.attachmentCount) || 0)),
          tone: typeof item.tone === "string" && item.tone ? item.tone : undefined,
          durationMinutes: Math.min(
            MAX_PLANNED_BLOCK_MINUTES,
            Math.max(MIN_PLANNED_BLOCK_MINUTES, Number(item.durationMinutes) || 25),
          ),
          timeOfDay: String(item.timeOfDay || "09:00").slice(0, 5),
          sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
          createdAtISO,
          updatedAtISO,
          status: item.status === "completed" ? "completed" : item.status === "deleted" ? "deleted" : "active",
          completedAtISO:
            item.status === "completed" && typeof item.completedAtISO === "string" && item.completedAtISO
              ? item.completedAtISO
              : undefined,
        } as PlannedBlockDoc;
      }),
  );
}

export function readLocalBlocks(uid: string) {
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    const parsed = raw ? (JSON.parse(raw) as PlannedBlockDoc[]) : [];
    return Array.isArray(parsed) ? normalizeBlocks(parsed) : [];
  } catch {
    return [];
  }
}

function writeLocalBlocks(uid: string, blocks: PlannedBlockDoc[]) {
  try {
    window.localStorage.setItem(storageKey(uid), JSON.stringify(normalizeBlocks(blocks)));
  } catch {
    // localStorage can be unavailable in private browsing; keep in-memory blocks alive.
  }
}

export function mergeBlocksPreferNewest(localBlocks: PlannedBlockDoc[], cloudBlocks: PlannedBlockDoc[]) {
  const merged = new Map<string, PlannedBlockDoc>();

  const preferBlock = (current: PlannedBlockDoc | undefined, candidate: PlannedBlockDoc) => {
    if (!current) return candidate;

    const currentCompleted = current.status === "completed" && Boolean(current.completedAtISO);
    const candidateCompleted = candidate.status === "completed" && Boolean(candidate.completedAtISO);

    // Never let a stale local active copy erase a completed block that already
    // exists in cloud history. Completed status is streak evidence, not just UI.
    if (currentCompleted !== candidateCompleted) {
      return candidateCompleted ? candidate : current;
    }

    return current.updatedAtISO < candidate.updatedAtISO ? candidate : current;
  };

  for (const block of cloudBlocks) {
    merged.set(block.id, preferBlock(merged.get(block.id), block));
  }

  for (const block of localBlocks) {
    merged.set(block.id, preferBlock(merged.get(block.id), block));
  }

  return normalizeBlocks([...merged.values()]);
}

export function savePlannedBlocksLocally(uid: string, blocks: PlannedBlockDoc[]) {
  writeLocalBlocks(uid, blocks);
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
      throw new Error(body?.error || response.statusText || "Planned blocks request failed.");
    }

    return response;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function pushBlocksToCloud(user: User, blocks: PlannedBlockDoc[]) {
  await authorizedRequest(user, resolveApiUrl("/api/planned-blocks"), {
    method: "POST",
    body: JSON.stringify({
      uid: user.uid,
      blocks: normalizeBlocks(blocks),
    }),
  });
}

export async function loadPlannedBlocks(user: User) {
  const localBlocks = readLocalBlocks(user.uid);

  try {
    const response = await authorizedRequest(
      user,
      resolveApiUrl(`/api/planned-blocks?uid=${encodeURIComponent(user.uid)}`),
      { method: "GET" },
    );
    const body = (await response.json()) as { blocks?: PlannedBlockDoc[] };
    const cloudBlocks = Array.isArray(body.blocks) ? normalizeBlocks(body.blocks) : [];
    const mergedBlocks = mergeBlocksPreferNewest(localBlocks, cloudBlocks);
    writeLocalBlocks(user.uid, mergedBlocks);

    if (JSON.stringify(mergedBlocks) !== JSON.stringify(cloudBlocks)) {
      void pushBlocksToCloud(user, mergedBlocks).catch((error) => {
        console.warn("[whelm:planned-blocks] failed to heal cloud snapshot after merge", error);
      });
    }

    return {
      blocks: mergedBlocks,
      synced: true,
    } as PlannedBlocksSyncResult;
  } catch (error: unknown) {
    return {
      blocks: localBlocks,
      synced: false,
      message:
        error instanceof Error
          ? error.message
          : "Cloud sync unavailable. Local planned blocks are still saved.",
    } as PlannedBlocksSyncResult;
  }
}

export async function savePlannedBlocks(user: User, blocks: PlannedBlockDoc[]) {
  const normalized = normalizeBlocks(blocks);
  writeLocalBlocks(user.uid, normalized);

  try {
    await pushBlocksToCloud(user, normalized);
    return {
      blocks: normalized,
      synced: true,
    } as PlannedBlocksSyncResult;
  } catch {
    return {
      blocks: normalized,
      synced: false,
      message: "Saved locally. Cloud sync is currently unavailable.",
    } as PlannedBlocksSyncResult;
  }
}
