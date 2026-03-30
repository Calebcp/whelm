"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriendProfile,
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  removeFriend,
  searchUsersByUsernameAuthed,
  sendFriendRequest,
  type FriendDoc,
  type FriendProfile,
  type FriendRequestDoc,
  type OutgoingFriendRequestDoc,
} from "@/lib/friends-store";

export type { FriendDoc, FriendProfile, FriendRequestDoc, OutgoingFriendRequestDoc };

export type FriendWithXp = FriendDoc & {
  totalXp: number;
  currentStreak: number;
  weeklyXp: number;
};

async function loadNudgeCooldownsFromFirestore(uid: string): Promise<Map<string, number>> {
  const snap = await getDoc(doc(db, "userPreferences", uid));
  const cooldowns = snap.data()?.nudgeCooldowns as Record<string, string> | undefined;
  if (!cooldowns) return new Map();
  return new Map(
    Object.entries(cooldowns).map(([friendUid, iso]) => [friendUid, new Date(iso).getTime()]),
  );
}

async function writeNudgeCooldownToFirestore(
  uid: string,
  friendUid: string,
  iso: string,
): Promise<void> {
  await setDoc(
    doc(db, "userPreferences", uid),
    { nudgeCooldowns: { [friendUid]: iso } },
    { merge: true },
  );
}

const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function useFriends(user: User | null, profileDisplayName: string) {
  const [friends, setFriends] = useState<FriendWithXp[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestDoc[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<OutgoingFriendRequestDoc[]>([]);
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [error, setError] = useState("");
  const [nudgeCooldowns, setNudgeCooldowns] = useState<Map<string, number>>(new Map());
  const searchRequestIdRef = useRef(0);
  const searchDebounceTimeoutRef = useRef<number | null>(null);

  const loadFriendsData = useCallback(async () => {
    if (!user) return;
    setFriendsLoading(true);
    setError("");
    try {
      const [friendDocs, requestDocs, outgoingRequestDocs] = await Promise.all([
        getFriends(user.uid),
        getIncomingRequests(user.uid),
        getOutgoingRequests(user.uid),
      ]);

      const friendsWithXp = await Promise.all(
        friendDocs.map(async (friend): Promise<FriendWithXp> => {
          const profile = await getFriendProfile(friend.friendUid).catch(() => null);
          return {
            ...friend,
            totalXp: profile?.totalXp ?? 0,
            currentStreak: profile?.currentStreak ?? 0,
            weeklyXp: profile?.weeklyXp ?? 0,
          };
        }),
      );

      setFriends(friendsWithXp.sort((a, b) => b.weeklyXp - a.weeklyXp));
      setIncomingRequests(requestDocs);
      setOutgoingRequests(outgoingRequestDocs);

      const cooldowns = await loadNudgeCooldownsFromFirestore(user.uid).catch(
        () => new Map<string, number>(),
      );
      setNudgeCooldowns(cooldowns);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load friends.");
    } finally {
      setFriendsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setSearchResults([]);
      setSearchQuery("");
      if (searchDebounceTimeoutRef.current !== null) {
        window.clearTimeout(searchDebounceTimeoutRef.current);
        searchDebounceTimeoutRef.current = null;
      }
      return;
    }
    void loadFriendsData();
  }, [user, loadFriendsData]);

  useEffect(() => () => {
    if (searchDebounceTimeoutRef.current !== null) {
      window.clearTimeout(searchDebounceTimeoutRef.current);
    }
  }, []);

  const handleSearch = useCallback(
    (q: string) => {
      setSearchQuery(q);
      setError("");
      const trimmed = q.trim();
      if (searchDebounceTimeoutRef.current !== null) {
        window.clearTimeout(searchDebounceTimeoutRef.current);
        searchDebounceTimeoutRef.current = null;
      }
      if (!trimmed) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }
      const requestId = searchRequestIdRef.current + 1;
      searchRequestIdRef.current = requestId;
      setSearchLoading(true);
      searchDebounceTimeoutRef.current = window.setTimeout(async () => {
        try {
          if (!user) {
            if (searchRequestIdRef.current === requestId) {
              setSearchResults([]);
              setSearchLoading(false);
            }
            return;
          }
          const token = await user.getIdToken();
          const results = await searchUsersByUsernameAuthed(trimmed, token);
          if (searchRequestIdRef.current !== requestId) return;
          setSearchResults(results.filter((r) => r.userId !== user.uid));
        } catch (err) {
          if (searchRequestIdRef.current !== requestId) return;
          setSearchResults([]);
          setError(err instanceof Error ? err.message : "Failed to search users.");
        } finally {
          if (searchRequestIdRef.current === requestId) {
            setSearchLoading(false);
          }
        }
      }, 180);
    },
    [user],
  );

  const handleSendRequest = useCallback(
    async (target: FriendProfile) => {
      if (!user) return;
      try {
        if (target.userId === user.uid) {
          setError("You cannot add yourself.");
          return;
        }
        const incomingMatch = incomingRequests.find((req) => req.fromUid === target.userId) ?? null;
        if (incomingMatch) {
          await acceptFriendRequest(user.uid, profileDisplayName, incomingMatch.fromUid, incomingMatch.fromUsername);
          await loadFriendsData();
          setSearchResults((prev) => prev.filter((item) => item.userId !== target.userId));
          return;
        }
        await sendFriendRequest(user.uid, profileDisplayName, target.username, target.userId);
        setOutgoingRequests((prev) => {
          const next = prev.filter((req) => req.toUid !== target.userId);
          next.push({ toUid: target.userId, toUsername: target.username, sentAtISO: new Date().toISOString() });
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send request.");
      }
    },
    [incomingRequests, loadFriendsData, profileDisplayName, user],
  );

  const handleAccept = useCallback(
    async (req: FriendRequestDoc) => {
      if (!user) return;
      try {
        await acceptFriendRequest(user.uid, profileDisplayName, req.fromUid, req.fromUsername);
        await loadFriendsData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to accept request.");
      }
    },
    [user, profileDisplayName, loadFriendsData],
  );

  const handleDecline = useCallback(
    async (req: FriendRequestDoc) => {
      if (!user) return;
      try {
        await declineFriendRequest(user.uid, req.fromUid);
        setIncomingRequests((prev) => prev.filter((r) => r.fromUid !== req.fromUid));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to decline request.");
      }
    },
    [user],
  );

  const handleRemoveFriend = useCallback(
    async (friendUid: string) => {
      if (!user) return;
      try {
        await removeFriend(user.uid, friendUid);
        setFriends((prev) => prev.filter((f) => f.friendUid !== friendUid));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove friend.");
      }
    },
    [user],
  );

  const handleNudge = useCallback(
    (friendUid: string) => {
      if (!user) return;
      const sentAt = nudgeCooldowns.get(friendUid);
      if (sentAt && Date.now() - sentAt < NUDGE_COOLDOWN_MS) return;
      const iso = new Date().toISOString();
      setNudgeCooldowns((prev) => new Map(prev).set(friendUid, Date.now()));
      void writeNudgeCooldownToFirestore(user.uid, friendUid, iso).catch(() => undefined);
    },
    [user, nudgeCooldowns],
  );

  const canNudgeFriend = useCallback(
    (friendUid: string): boolean => {
      const sentAt = nudgeCooldowns.get(friendUid);
      if (!sentAt) return true;
      return Date.now() - sentAt >= NUDGE_COOLDOWN_MS;
    },
    [nudgeCooldowns],
  );

  const nudgeAvailableInMinutes = useCallback(
    (friendUid: string): number => {
      const sentAt = nudgeCooldowns.get(friendUid);
      if (!sentAt) return 0;
      const msLeft = NUDGE_COOLDOWN_MS - (Date.now() - sentAt);
      if (msLeft <= 0) return 0;
      return Math.ceil(msLeft / 60000);
    },
    [nudgeCooldowns],
  );

  const alreadyFriendUids = new Set(friends.map((f) => f.friendUid));
  const sentRequestUids = new Set(outgoingRequests.map((req) => req.toUid));
  const incomingRequestUids = new Set(incomingRequests.map((req) => req.fromUid));

  return {
    friends,
    incomingRequests,
    outgoingRequests,
    searchResults,
    searchQuery,
    searchLoading,
    friendsLoading,
    error,
    sentRequestUids,
    alreadyFriendUids,
    incomingRequestUids,
    handleSearch,
    handleSendRequest,
    handleAccept,
    handleDecline,
    handleRemoveFriend,
    handleNudge,
    canNudgeFriend,
    nudgeAvailableInMinutes,
  };
}
