"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  acceptFriendRequestAuthed,
  declineFriendRequestAuthed,
  getFriendsStateAuthed,
  removeFriendAuthed,
  saveNudgeCooldownAuthed,
  searchUsersByUsernameAuthed,
  sendFriendRequestAuthed,
  type FriendProfile,
  type FriendRequestDoc,
  type FriendWithXp,
  type OutgoingFriendRequestDoc,
} from "@/lib/friends-store";

export type { FriendProfile, FriendRequestDoc, FriendWithXp, OutgoingFriendRequestDoc };

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
      const token = await user.getIdToken();
      const payload = await getFriendsStateAuthed(user.uid, token);
      setFriends(payload.friends);
      setIncomingRequests(payload.incomingRequests);
      setOutgoingRequests(payload.outgoingRequests);
      setNudgeCooldowns(
        new Map(
          Object.entries(payload.nudgeCooldowns ?? {}).map(([friendUid, iso]) => [
            friendUid,
            new Date(iso).getTime(),
          ]),
        ),
      );
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
        const token = await user.getIdToken();
        if (incomingMatch) {
          await acceptFriendRequestAuthed(
            {
              myUid: user.uid,
              myUsername: profileDisplayName,
              fromUid: incomingMatch.fromUid,
              fromUsername: incomingMatch.fromUsername,
            },
            token,
          );
          await loadFriendsData();
          setSearchResults((prev) => prev.filter((item) => item.userId !== target.userId));
          return;
        }
        await sendFriendRequestAuthed(
          {
            fromUid: user.uid,
            fromUsername: profileDisplayName,
            toUid: target.userId,
            toUsername: target.username,
          },
          token,
        );
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
        const token = await user.getIdToken();
        await acceptFriendRequestAuthed(
          {
            myUid: user.uid,
            myUsername: profileDisplayName,
            fromUid: req.fromUid,
            fromUsername: req.fromUsername,
          },
          token,
        );
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
        const token = await user.getIdToken();
        await declineFriendRequestAuthed({ myUid: user.uid, fromUid: req.fromUid }, token);
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
        const token = await user.getIdToken();
        await removeFriendAuthed({ myUid: user.uid, friendUid }, token);
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
      void user
        .getIdToken()
        .then((token) => saveNudgeCooldownAuthed({ uid: user.uid, friendUid, iso }, token))
        .catch(() => undefined);
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
