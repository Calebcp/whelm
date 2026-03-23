# Whelm Leaderboard Backend

## Data model

### `leaderboardProfiles/{userId}`
- Canonical per-user leaderboard record written by the signed-in client.
- Fields:
  - `userId`
  - `username`
  - `usernameLower`
  - `totalXp`
  - `currentStreak`
  - `level`
  - `bandanaColor`
  - `bandanaLabel`
  - `createdAtISO`
  - `updatedAtISO`

### `leaderboardSnapshotRuns/{snapshotDate_metric}`
- Snapshot metadata for a single daily rebuild and metric.
- Fields:
  - `snapshotDate`
  - `metric`
  - `totalEntries`
  - `status`
  - `computedAtISO`

### `leaderboardDailySnapshots/{snapshotDate_metric_userId}`
- Precomputed ranked row for one user inside one metric snapshot.
- Fields:
  - All profile fields above
  - `snapshotDate`
  - `metric`
  - `rank`
  - `previousRank`
  - `movement`
  - `movementDirection`

## Read strategy

- The app reads only `leaderboardDailySnapshots` and `leaderboardSnapshotRuns`.
- Pagination is rank-window based.
- Around-me retrieval is rank-window based around the current user's precomputed snapshot doc.
- The client does not sort large user sets.

## Write strategy

- Clients sync their own `leaderboardProfiles/{userId}` through `POST /api/leaderboard/profile`.
- A scheduled backend job calls `POST /api/leaderboard/rebuild` once per day.
- The rebuild route reads all `leaderboardProfiles`, sorts server-side, computes movement from the previous snapshot, and writes precomputed snapshot docs in batches.

## Scaling notes

- This keeps hot leaderboard reads off the profiles collection.
- Snapshot docs are append/overwrite friendly and cheap to page.
- If the profile count grows far beyond the point where one in-memory daily sort is comfortable, keep the same read model and move the rebuild worker to Cloud Run or another job runner with more memory.
