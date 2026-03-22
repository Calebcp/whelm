import type { User } from "firebase/auth";

import { resolveApiUrl } from "@/lib/api-base";
import type { SessionDoc } from "@/lib/streak";

const storagePrefix = "whelm:sessions:";

function storageKey(uid: string) {
  return `${storagePrefix}${uid}`;
}

function sessionKey(session: SessionDoc) {
  return [
    session.uid,
    session.completedAtISO,
    session.minutes,
    session.category ?? "misc",
    session.note ?? "",
    session.noteSavedAtISO ?? "",
  ].join("|");
}

function sortSessions(sessions: SessionDoc[]) {
  return [...sessions].sort((a, b) => (a.completedAtISO < b.completedAtISO ? 1 : -1));
}

function dedupeSessions(sessions: SessionDoc[]) {
  const byKey = new Map<string, SessionDoc>();

  for (const session of sessions) {
    byKey.set(sessionKey(session), session);
  }

  return sortSessions([...byKey.values()]);
}

function readLocalSessions(uid: string) {
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    const parsed = raw ? (JSON.parse(raw) as SessionDoc[]) : [];
    return Array.isArray(parsed) ? dedupeSessions(parsed) : [];
  } catch {
    return [];
  }
}

function writeLocalSessions(uid: string, sessions: SessionDoc[]) {
  window.localStorage.setItem(storageKey(uid), JSON.stringify(dedupeSessions(sessions)));
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
      throw new Error(body?.error || response.statusText || "Session request failed.");
    }

    return response;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function saveSessionToCloud(user: User, session: SessionDoc) {
  await authorizedRequest(user, resolveApiUrl("/api/sessions"), {
    method: "POST",
    body: JSON.stringify(session),
  });
}

export async function loadSessions(user: User) {
  const localSessions = readLocalSessions(user.uid);

  try {
    const response = await authorizedRequest(
      user,
      resolveApiUrl(`/api/sessions?uid=${encodeURIComponent(user.uid)}`),
      { method: "GET" },
    );
    const body = (await response.json()) as { sessions?: SessionDoc[] };
    const cloudSessions = Array.isArray(body.sessions) ? body.sessions : [];
    const merged = dedupeSessions([...cloudSessions, ...localSessions]);
    writeLocalSessions(user.uid, merged);

    const cloudKeys = new Set(cloudSessions.map(sessionKey));
    const missingInCloud = localSessions.filter((session) => !cloudKeys.has(sessionKey(session)));
    if (missingInCloud.length > 0) {
      await Promise.all(missingInCloud.map((session) => saveSessionToCloud(user, session)));
    }

    return merged;
  } catch {
    return localSessions;
  }
}

export async function saveSession(user: User, session: SessionDoc) {
  const mergedLocal = dedupeSessions([session, ...readLocalSessions(user.uid)]);
  writeLocalSessions(user.uid, mergedLocal);

  try {
    await saveSessionToCloud(user, session);
  } catch {
    // Keep local history when cloud sync is unavailable.
  }

  return mergedLocal;
}
