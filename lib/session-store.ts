import type { User } from "firebase/auth";

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
  const seen = new Set<string>();

  return sortSessions(
    sessions.filter((session) => {
      const key = sessionKey(session);

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
}

export async function loadSessions(user: User) {
  try {
    const raw = window.localStorage.getItem(storageKey(user.uid));
    const parsed = raw ? (JSON.parse(raw) as SessionDoc[]) : [];

    return Array.isArray(parsed) ? dedupeSessions(parsed) : [];
  } catch {
    return [];
  }
}

export async function saveSession(user: User, session: SessionDoc) {
  const sessions = dedupeSessions([session, ...(await loadSessions(user))]);
  window.localStorage.setItem(storageKey(user.uid), JSON.stringify(sessions));
}
