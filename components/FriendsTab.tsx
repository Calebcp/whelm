"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import styles from "@/components/FriendsTab.module.css";
import sharedStyles from "@/app/page.module.css";
import type {
  FriendProfile,
  FriendWithXp,
} from "@/hooks/useFriends";

type FriendsTabProps = {
  friends: FriendWithXp[];
  searchResults: FriendProfile[];
  searchQuery: string;
  searchLoading: boolean;
  friendsLoading: boolean;
  error: string;
  sentRequestUids: Set<string>;
  alreadyFriendUids: Set<string>;
  incomingRequestUids: Set<string>;
  onSearch: (q: string) => void;
  onSendRequest: (target: FriendProfile) => void;
  onRemoveFriend: (friendUid: string) => void;
  onNudge: (friendUid: string) => void;
  canNudgeFriend: (friendUid: string) => boolean;
  nudgeAvailableInMinutes: (friendUid: string) => number;
};

function formatXp(xp: number) {
  if (xp >= 1000) return `${(xp / 1000).toFixed(1).replace(/\.0$/, "")}k XP`;
  return `${xp} XP`;
}

export default function FriendsTab({
  friends,
  searchResults,
  searchQuery,
  searchLoading,
  friendsLoading,
  error,
  sentRequestUids,
  alreadyFriendUids,
  incomingRequestUids,
  onSearch,
  onSendRequest,
  onRemoveFriend,
  onNudge,
  canNudgeFriend,
  nudgeAvailableInMinutes,
}: FriendsTabProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const showSearchDropdown = searchFocused && (searchQuery.length > 0 || searchLoading);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearch(e.target.value);
    },
    [onSearch],
  );

  return (
    <div className={styles.friendsRoot}>
      {/* Search */}
      <div className={styles.searchWrap}>
        <div className={`${styles.searchField} ${searchFocused ? styles.searchFieldFocused : ""}`}>
          <span className={styles.searchIcon} aria-hidden="true">
            🔍
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Find friends by username…"
            className={styles.searchInput}
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <AnimatePresence>
          {showSearchDropdown && (
            <motion.div
              className={styles.searchDropdown}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
            >
              {searchLoading ? (
                <p className={styles.searchHint}>Searching…</p>
              ) : searchResults.length === 0 ? (
                <p className={styles.searchHint}>No users found</p>
              ) : (
                searchResults.map((result) => {
                  const alreadyFriend = alreadyFriendUids.has(result.userId);
                  const requestSent = sentRequestUids.has(result.userId);
                  const incomingRequest = incomingRequestUids.has(result.userId);
                  return (
                    <div key={result.userId} className={styles.searchResultRow}>
                      <div className={styles.searchResultInfo}>
                        <strong className={styles.searchResultName}>{result.username}</strong>
                        <span className={styles.searchResultMeta}>
                          {formatXp(result.totalXp)} · {result.currentStreak}d streak
                        </span>
                      </div>
                      {alreadyFriend ? (
                        <span className={styles.alreadyFriendChip}>Friends</span>
                      ) : incomingRequest ? (
                        <button
                          type="button"
                          className={styles.acceptButton}
                          onClick={() => onSendRequest(result)}
                        >
                          Accept
                        </button>
                      ) : requestSent ? (
                        <span className={styles.requestSentChip}>Sent</span>
                      ) : (
                        <button
                          type="button"
                          className={styles.addButton}
                          onClick={() => onSendRequest(result)}
                        >
                          Add
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}

      {/* Friends list */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={sharedStyles.sectionLabel}>This week</span>
          <span className={styles.countBadge}>{friends.length} friends</span>
        </div>

        {friendsLoading ? (
          <div className={styles.loadingList}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.loadingRow} aria-hidden="true" />
            ))}
          </div>
        ) : friends.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>No friends yet</strong>
            <p className={sharedStyles.accountMeta}>
              Search for friends by username to start competing together.
            </p>
          </div>
        ) : (
          <div className={styles.friendList}>
            {friends.map((friend, index) => {
              const canNudge = canNudgeFriend(friend.friendUid);
              const nudgeMinsLeft = nudgeAvailableInMinutes(friend.friendUid);
              const nudgeCooldownLabel =
                nudgeMinsLeft >= 60
                  ? `Available in ${Math.floor(nudgeMinsLeft / 60)}h ${nudgeMinsLeft % 60}m`
                  : `Available in ${nudgeMinsLeft}m`;
              return (
                <motion.div
                  key={friend.friendUid}
                  className={styles.friendRow}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.24,
                    delay: Math.min(index * 0.04, 0.16),
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <span className={styles.friendRank}>#{index + 1}</span>
                  <div className={styles.friendInfo}>
                    <strong className={styles.friendUsername}>{friend.friendUsername}</strong>
                    <span className={styles.friendMeta}>
                      {friend.currentStreak}d streak · {formatXp(friend.totalXp)} total
                    </span>
                  </div>
                  <div className={styles.friendRight}>
                    <span className={styles.friendWeeklyXp}>{formatXp(friend.weeklyXp)}</span>
                    <div className={styles.friendActions}>
                      <button
                        type="button"
                        className={`${styles.nudgeButton} ${!canNudge ? styles.nudgeButtonCooling : ""}`}
                        disabled={!canNudge}
                        onClick={() => onNudge(friend.friendUid)}
                        title={canNudge ? "Send a nudge" : nudgeCooldownLabel}
                      >
                        {canNudge ? "👋 Nudge" : nudgeCooldownLabel}
                      </button>
                      <button
                        type="button"
                        className={styles.removeButton}
                        onClick={() => onRemoveFriend(friend.friendUid)}
                        title="Remove friend"
                        aria-label="Remove friend"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
