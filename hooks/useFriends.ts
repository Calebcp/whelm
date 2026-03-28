"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriendProfile,
  getFriends,
  getIncomingRequests,
  removeFriend,
  searchUsersByUsername,
  sendFriendRequest,
  type FriendDoc,
  type FriendProfile,
  type FriendRequestDoc,
} from "@/lib/friends-store";

export type { FriendDoc, FriendProfile, FriendRequestDoc };

export type FriendWithXp = FriendDoc & {
  totalXp: number;
  currentStreak: number;
  weeklyXp: number;
};

function nudgeCooldownKey(myUid: string, friendUid: string) {
  return `whelm:nudge-sent:${myUid}:${friendUid}`;
}

function readNudgeSentAt(myUid: string, friendUid: string): number | null {
  try {
    const raw = localStorage.getItem(nudgeCooldownKey(myUid, friendUid));
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function recordNudge(myUid: string, friendUid: string): void {
  try {
    localStorage.setItem(nudgeCooldownKey(myUid, friendUid), String(Date.now()));
  } catch {
    // ignore
  }
}

const NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function useFriends(user: User | null, profileDisplayName: string) {
  const [friends, setFriends] = useState<FriendWithXp[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestDoc[]>([]);
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [error, setError] = useState("");
  const [nudgeCooldowns, setNudgeCooldowns] = useState<Map<string, number>>(new Map());
  const [sentRequestUids, setSentRequestUids] = useState<Set<string>>(new Set());

  const loadFriendsData = useCallback(async () => {
    if (!user) return;
    setFriendsLoading(true);
    setError("");
    try {
      const [friendDocs, requestDocs] = await Promise.all([
        getFriends(user.uid),
        getIncomingRequests(user.uid),
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

      const cooldowns = new Map<string, number>();
      for (const friend of friendDocs) {
        const sentAt = readNudgeSentAt(user.uid, friend.friendUid);
        if (sentAt !== null) cooldowns.set(friend.friendUid, sentAt);
      }
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
      setSearchResults([]);
      setSearchQuery("");
      setSentRequestUids(new Set());
      return;
    }
    void loadFriendsData();
  }, [user, loadFriendsData]);

  const handleSearch = useCallback(
    async (q: string) => {
      setSearchQuery(q);
      if (!q.trim()) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const results = await searchUsersByUsername(q);
        setSearchResults(results.filter((r) => r.userId !== user?.uid));
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [user],
  );

  const handleSendRequest = useCallback(
    async (toUserId: string) => {
      if (!user) return;
      try {
        await sendFriendRequest(user.uid, profileDisplayName, toUserId);
        setSentRequestUids((prev) => new Set([...prev, toUserId]));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send request.");
      }
    },
    [user, profileDisplayName],
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
      recordNudge(user.uid, friendUid);
      setNudgeCooldowns((prev) => new Map(prev).set(friendUid, Date.now()));
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

  const alreadyFriendUids = new Set(friends.map((f) => f.friendUid));

  return {
    friends,
    incomingRequests,
    searchResults,
    searchQuery,
    searchLoading,
    friendsLoading,
    error,
    sentRequestUids,
    alreadyFriendUids,
    handleSearch,
    handleSendRequest,
    handleAccept,
    handleDecline,
    handleRemoveFriend,
    handleNudge,
    canNudgeFriend,
  };
}
