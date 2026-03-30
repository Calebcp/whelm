"use client";

import { resolveApiUrl } from "@/lib/api-base";

export type FriendDoc = {
  friendUid: string;
  friendUsername: string;
  addedAtISO: string;
};

export type FriendRequestDoc = {
  fromUid: string;
  fromUsername: string;
  sentAtISO: string;
};

export type OutgoingFriendRequestDoc = {
  toUid: string;
  toUsername: string;
  sentAtISO: string;
};

export type FriendProfile = {
  userId: string;
  username: string;
  totalXp: number;
  currentStreak: number;
  weeklyXp: number;
};

export type FriendWithXp = FriendDoc & {
  totalXp: number;
  currentStreak: number;
  weeklyXp: number;
};

export type FriendsStatePayload = {
  friends: FriendWithXp[];
  incomingRequests: FriendRequestDoc[];
  outgoingRequests: OutgoingFriendRequestDoc[];
  nudgeCooldowns: Record<string, string>;
};

async function readJson<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null;
}

function apiUrl(path: string) {
  return new URL(resolveApiUrl(path), window.location.origin).toString();
}

async function authedFetch<T>(
  path: string,
  idToken: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = await readJson<{ error?: string } & T>(response);
  if (!response.ok) {
    throw new Error(body?.error || "Friends request failed.");
  }

  return (body ?? {}) as T;
}

export async function getFriendsStateAuthed(
  uid: string,
  idToken: string,
): Promise<FriendsStatePayload> {
  const url = new URL(apiUrl("/api/friends"));
  url.searchParams.set("uid", uid);
  return authedFetch<FriendsStatePayload>(`${url.pathname}${url.search}`, idToken, {
    method: "GET",
  });
}

export async function sendFriendRequestAuthed(
  params: {
    fromUid: string;
    fromUsername: string;
    toUid: string;
    toUsername: string;
  },
  idToken: string,
): Promise<void> {
  await authedFetch<{ ok: true }>("/api/friends", idToken, {
    method: "POST",
    body: JSON.stringify({
      action: "send",
      ...params,
    }),
  });
}

export async function acceptFriendRequestAuthed(
  params: {
    myUid: string;
    myUsername: string;
    fromUid: string;
    fromUsername: string;
  },
  idToken: string,
): Promise<void> {
  await authedFetch<{ ok: true }>("/api/friends", idToken, {
    method: "PATCH",
    body: JSON.stringify({
      action: "accept",
      ...params,
    }),
  });
}

export async function declineFriendRequestAuthed(
  params: {
    myUid: string;
    fromUid: string;
  },
  idToken: string,
): Promise<void> {
  await authedFetch<{ ok: true }>("/api/friends", idToken, {
    method: "PATCH",
    body: JSON.stringify({
      action: "decline",
      ...params,
    }),
  });
}

export async function removeFriendAuthed(
  params: {
    myUid: string;
    friendUid: string;
  },
  idToken: string,
): Promise<void> {
  await authedFetch<{ ok: true }>("/api/friends", idToken, {
    method: "DELETE",
    body: JSON.stringify(params),
  });
}

export async function saveNudgeCooldownAuthed(
  params: {
    uid: string;
    friendUid: string;
    iso: string;
  },
  idToken: string,
): Promise<void> {
  await authedFetch<{ ok: true }>("/api/friends", idToken, {
    method: "POST",
    body: JSON.stringify({
      action: "nudge",
      ...params,
    }),
  });
}

export async function searchUsersByUsernameAuthed(
  searchTerm: string,
  idToken: string,
): Promise<FriendProfile[]> {
  if (!searchTerm.trim()) return [];
  const url = new URL(apiUrl("/api/friends/search"));
  url.searchParams.set("q", searchTerm.trim());
  url.searchParams.set("limit", "10");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  const body = (await response.json().catch(() => null)) as
    | { items?: FriendProfile[]; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(body?.error || "Failed to search users.");
  }

  return (body?.items ?? []).map((item) => ({
    userId: item.userId,
    username: item.username,
    totalXp: item.totalXp ?? 0,
    currentStreak: item.currentStreak ?? 0,
    weeklyXp: item.weeklyXp ?? 0,
  }));
}
