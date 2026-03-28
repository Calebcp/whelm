"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
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
  toUid: string,
): Promise<void> {
  await setDoc(doc(db, "friendRequests", toUid, "incoming", fromUid), {
    fromUid,
    fromUsername,
    sentAtISO: new Date().toISOString(),
  });
}

export async function getIncomingRequests(uid: string): Promise<FriendRequestDoc[]> {
  const snap = await getDocs(collection(db, "friendRequests", uid, "incoming"));
  return snap.docs.map((d) => d.data() as FriendRequestDoc);
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
  ]);
}

export async function declineFriendRequest(myUid: string, fromUid: string): Promise<void> {
  await deleteDoc(doc(db, "friendRequests", myUid, "incoming", fromUid));
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

export async function searchUsersByUsername(searchTerm: string): Promise<FriendProfile[]> {
  if (!searchTerm.trim()) return [];
  const term = searchTerm.trim().toLowerCase();
  const q = query(
    collection(db, "leaderboardProfiles"),
    where("usernameLower", ">=", term),
    where("usernameLower", "<=", term + "\uf8ff"),
    limit(10),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      userId: data.userId as string,
      username: data.username as string,
      totalXp: (data.totalXp as number) ?? 0,
      currentStreak: (data.currentStreak as number) ?? 0,
      weeklyXp: (data.weeklyXp as number) ?? 0,
    };
  });
}
