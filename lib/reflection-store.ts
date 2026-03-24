import type { User } from "firebase/auth";

import { resolveApiUrl } from "@/lib/api-base";

export type ReflectionMirrorEntry = {
  id: string;
  dateKey: string;
  createdAtISO: string;
  updatedAtISO: string;
  tag: string;
  answers: Record<string, string>;
  source: "streak_save";
};

export type ReflectionSickDaySave = {
  id: string;
  dateKey: string;
  claimedAtISO: string;
  reason: "sick";
};

export type ReflectionState = {
  mirrorEntries: ReflectionMirrorEntry[];
  sickDaySaves: ReflectionSickDaySave[];
  sickDaySaveDismissals: string[];
};

export type ReflectionSyncResult = ReflectionState & {
  synced: boolean;
  message?: string;
};

const mirrorStoragePrefix = "whelm:streak-mirror:";
const sickDaySaveStoragePrefix = "whelm:sick-day-saves:";
const sickDayDismissalStoragePrefix = "whelm:sick-day-save-dismissals:";

function mirrorStorageKey(uid: string) {
  return `${mirrorStoragePrefix}${uid}`;
}

function sickDaySaveStorageKey(uid: string) {
  return `${sickDaySaveStoragePrefix}${uid}`;
}

function sickDayDismissalStorageKey(uid: string) {
  return `${sickDayDismissalStoragePrefix}${uid}`;
}

function normalizeMirrorEntries(entries: ReflectionMirrorEntry[]) {
  if (!Array.isArray(entries)) return [] as ReflectionMirrorEntry[];

  return entries
    .filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.dateKey === "string" &&
        typeof item.createdAtISO === "string" &&
        typeof item.updatedAtISO === "string" &&
        typeof item.tag === "string" &&
        item.answers &&
        typeof item.answers === "object",
    )
    .map((item) => ({
      id: item.id,
      dateKey: item.dateKey.slice(0, 10),
      createdAtISO: item.createdAtISO,
      updatedAtISO: item.updatedAtISO,
      tag: item.tag.slice(0, 80),
      answers: Object.fromEntries(
        Object.entries(item.answers).map(([question, answer]) => [
          question.slice(0, 120),
          String(answer ?? "").slice(0, 2500),
        ]),
      ),
      source: "streak_save" as const,
    }))
    .sort((a, b) => (a.updatedAtISO < b.updatedAtISO ? 1 : -1));
}

function normalizeSickDaySaves(saves: ReflectionSickDaySave[]) {
  if (!Array.isArray(saves)) return [] as ReflectionSickDaySave[];

  return saves
    .filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.dateKey === "string" &&
        typeof item.claimedAtISO === "string" &&
        item.reason === "sick",
    )
    .map((item) => ({
      id: item.id,
      dateKey: item.dateKey.slice(0, 10),
      claimedAtISO: item.claimedAtISO,
      reason: "sick" as const,
    }))
    .sort((a, b) => (a.claimedAtISO < b.claimedAtISO ? 1 : -1));
}

function normalizeDismissals(dateKeys: string[]) {
  if (!Array.isArray(dateKeys)) return [] as string[];
  return [...new Set(dateKeys.filter((value) => typeof value === "string").map((value) => value.slice(0, 10)))];
}

function readLocalState(uid: string): ReflectionState {
  try {
    const mirrorRaw = window.localStorage.getItem(mirrorStorageKey(uid));
    const savesRaw = window.localStorage.getItem(sickDaySaveStorageKey(uid));
    const dismissalsRaw = window.localStorage.getItem(sickDayDismissalStorageKey(uid));

    return {
      mirrorEntries: normalizeMirrorEntries(mirrorRaw ? (JSON.parse(mirrorRaw) as ReflectionMirrorEntry[]) : []),
      sickDaySaves: normalizeSickDaySaves(savesRaw ? (JSON.parse(savesRaw) as ReflectionSickDaySave[]) : []),
      sickDaySaveDismissals: normalizeDismissals(dismissalsRaw ? (JSON.parse(dismissalsRaw) as string[]) : []),
    };
  } catch {
    return {
      mirrorEntries: [],
      sickDaySaves: [],
      sickDaySaveDismissals: [],
    };
  }
}

function writeLocalState(uid: string, state: ReflectionState) {
  window.localStorage.setItem(mirrorStorageKey(uid), JSON.stringify(normalizeMirrorEntries(state.mirrorEntries)));
  window.localStorage.setItem(sickDaySaveStorageKey(uid), JSON.stringify(normalizeSickDaySaves(state.sickDaySaves)));
  window.localStorage.setItem(
    sickDayDismissalStorageKey(uid),
    JSON.stringify(normalizeDismissals(state.sickDaySaveDismissals)),
  );
}

async function authorizedRequest(user: User, input: string, init: RequestInit, timeoutMs = 12000) {
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
      throw new Error(body?.error || response.statusText || "Reflection state request failed.");
    }

    return response;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizeState(state: ReflectionState): ReflectionState {
  return {
    mirrorEntries: normalizeMirrorEntries(state.mirrorEntries),
    sickDaySaves: normalizeSickDaySaves(state.sickDaySaves),
    sickDaySaveDismissals: normalizeDismissals(state.sickDaySaveDismissals),
  };
}

export async function loadReflectionState(user: User) {
  const localState = readLocalState(user.uid);

  try {
    const response = await authorizedRequest(
      user,
      resolveApiUrl(`/api/reflection-state?uid=${encodeURIComponent(user.uid)}`),
      { method: "GET" },
    );
    const body = (await response.json()) as Partial<ReflectionState>;
    const state = normalizeState({
      mirrorEntries: Array.isArray(body.mirrorEntries) ? body.mirrorEntries : localState.mirrorEntries,
      sickDaySaves: Array.isArray(body.sickDaySaves) ? body.sickDaySaves : localState.sickDaySaves,
      sickDaySaveDismissals: Array.isArray(body.sickDaySaveDismissals)
        ? body.sickDaySaveDismissals
        : localState.sickDaySaveDismissals,
    });
    writeLocalState(user.uid, state);
    return { ...state, synced: true } as ReflectionSyncResult;
  } catch (error: unknown) {
    return {
      ...localState,
      synced: false,
      message:
        error instanceof Error
          ? error.message
          : "Cloud sync unavailable. Local streak recovery state is still saved.",
    } as ReflectionSyncResult;
  }
}

export async function saveReflectionState(user: User, state: ReflectionState) {
  const normalized = normalizeState(state);
  writeLocalState(user.uid, normalized);

  try {
    await authorizedRequest(user, resolveApiUrl("/api/reflection-state"), {
      method: "POST",
      body: JSON.stringify({
        uid: user.uid,
        ...normalized,
      }),
    });
    return { ...normalized, synced: true } as ReflectionSyncResult;
  } catch {
    return {
      ...normalized,
      synced: false,
      message: "Saved locally. Cloud sync is currently unavailable.",
    } as ReflectionSyncResult;
  }
}
