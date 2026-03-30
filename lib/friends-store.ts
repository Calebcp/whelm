"use client";

import { resolveApiUrl } from "@/lib/api-base";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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

export async function sendFriendRequest(
  fromUid: string,
  fromUsername: string,
  toUsername: string,
  toUid: string,
): Promise<void> {
  if (!fromUid || !toUid || fromUid === toUid) {
    throw new Error("Invalid friend request target.");
  }
  const sentAtISO = new Date().toISOString();
  await Promise.all([
    setDoc(doc(db, "friendRequests", toUid, "incoming", fromUid), {
      fromUid,
      fromUsername,
      sentAtISO,
    }),
    setDoc(doc(db, "friendRequests", fromUid, "outgoing", toUid), {
      toUid,
      toUsername,
      sentAtISO,
    }),
  ]);
}

export async function getIncomingRequests(uid: string): Promise<FriendRequestDoc[]> {
  const snap = await getDocs(collection(db, "friendRequests", uid, "incoming"));
  return snap.docs.map((d) => d.data() as FriendRequestDoc);
}

export async function getOutgoingRequests(uid: string): Promise<OutgoingFriendRequestDoc[]> {
  const snap = await getDocs(collection(db, "friendRequests", uid, "outgoing"));
  return snap.docs.map((d) => d.data() as OutgoingFriendRequestDoc);
}

export async function acceptFriendRequest(
  myUid: string,
  myUsername: string,
  fromUid: string,
  fromUsername: string,
): Promise<void> {
  const now = new Date().toISOString();
  await Promise.all([
    setDoc(doc(db, "friendships", myUid, "friends", fromUid), {
      friendUid: fromUid,
      friendUsername: fromUsername,
      addedAtISO: now,
    }),
    setDoc(doc(db, "friendships", fromUid, "friends", myUid), {
      friendUid: myUid,
      friendUsername: myUsername,
      addedAtISO: now,
    }),
    deleteDoc(doc(db, "friendRequests", myUid, "incoming", fromUid)),
    deleteDoc(doc(db, "friendRequests", fromUid, "outgoing", myUid)),
  ]);
}

export async function declineFriendRequest(myUid: string, fromUid: string): Promise<void> {
  await Promise.all([
    deleteDoc(doc(db, "friendRequests", myUid, "incoming", fromUid)),
    deleteDoc(doc(db, "friendRequests", fromUid, "outgoing", myUid)),
  ]);
}

export async function getFriends(uid: string): Promise<FriendDoc[]> {
  const snap = await getDocs(collection(db, "friendships", uid, "friends"));
  return snap.docs.map((d) => d.data() as FriendDoc);
}

export async function removeFriend(myUid: string, friendUid: string): Promise<void> {
  await Promise.all([
    deleteDoc(doc(db, "friendships", myUid, "friends", friendUid)),
    deleteDoc(doc(db, "friendships", friendUid, "friends", myUid)),
  ]);
}

export async function getFriendProfile(friendUid: string): Promise<FriendProfile | null> {
  const snap = await getDoc(doc(db, "leaderboardProfiles", friendUid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    userId: friendUid,
    username: (data.username as string) ?? "Whelm user",
    totalXp: (data.totalXp as number) ?? 0,
    currentStreak: (data.currentStreak as number) ?? 0,
    weeklyXp: (data.weeklyXp as number) ?? 0,
  };
}

export async function searchUsersByUsernameAuthed(
  searchTerm: string,
  idToken: string,
): Promise<FriendProfile[]> {
  if (!searchTerm.trim()) return [];
  const url = new URL(resolveApiUrl("/api/friends/search"), window.location.origin);
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
