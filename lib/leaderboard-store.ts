import {
  buildLeaderboardProfile,
  compareLeaderboardProfiles,
  decodeCursor,
  encodeCursor,
  movementDirection,
  snapshotEntryDocId,
  snapshotRunDocId,
  type LeaderboardMetric,
  type LeaderboardPageResponse,
  type LeaderboardProfile,
  type LeaderboardSnapshotEntry,
} from "@/lib/leaderboard";

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
};

type RunQueryResponse = {
  document?: FirestoreDocument;
};

type ListDocumentsResponse = {
  documents?: FirestoreDocument[];
  nextPageToken?: string;
};

function requireConfig() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const databaseId = process.env.FIREBASE_DATABASE_ID?.trim() || "(default)";

  if (!projectId || !apiKey) {
    throw new Error("Missing Firebase environment variables on the server.");
  }

  return { projectId, apiKey, databaseId };
}

function documentsBaseUrl() {
  const { projectId, databaseId } = requireConfig();
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
}

function documentName(path: string) {
  const { projectId, databaseId } = requireConfig();
  return `projects/${projectId}/databases/${databaseId}/documents/${path}`;
}

function encodeFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "object" && !Array.isArray(value)) {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, nested]) => [key, encodeFirestoreValue(nested)]),
        ),
      },
    };
  }
  throw new Error("Unsupported Firestore value.");
}

function decodeFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("mapValue" in value) {
    const fields = value.mapValue.fields ?? {};
    return Object.fromEntries(
      Object.entries(fields).map(([key, nested]) => [key, decodeFirestoreValue(nested)]),
    );
  }
  return null;
}

async function runQuery(authHeader: string, structuredQuery: object) {
  const { apiKey } = requireConfig();
  const response = await fetch(`${documentsBaseUrl()}:runQuery?key=${apiKey}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({ structuredQuery }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to query Firestore.");
  }

  return (await response.json()) as RunQueryResponse[];
}

async function listDocuments(authHeader: string, collectionId: string, pageToken?: string) {
  const { apiKey } = requireConfig();
  const url = new URL(`${documentsBaseUrl()}/${collectionId}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("pageSize", "400");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to list Firestore documents.");
  }

  return (await response.json()) as ListDocumentsResponse;
}

async function getDocument(authHeader: string, path: string) {
  const { apiKey } = requireConfig();
  const response = await fetch(`${documentsBaseUrl()}/${path}?key=${apiKey}`, {
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to get Firestore document.");
  }

  return (await response.json()) as FirestoreDocument;
}

function decodeProfile(document: FirestoreDocument): LeaderboardProfile | null {
  if (!document.fields) return null;
  const fields = document.fields;

  return buildLeaderboardProfile({
    userId: String(decodeFirestoreValue(fields.userId) ?? ""),
    username: String(decodeFirestoreValue(fields.username) ?? "Whelm user"),
    totalXp: Number(decodeFirestoreValue(fields.totalXp) ?? 0),
    currentStreak: Number(decodeFirestoreValue(fields.currentStreak) ?? 0),
    level: Number(decodeFirestoreValue(fields.level) ?? 1),
    createdAtISO: String(decodeFirestoreValue(fields.createdAtISO) ?? new Date().toISOString()),
    updatedAtISO: String(decodeFirestoreValue(fields.updatedAtISO) ?? new Date().toISOString()),
    bestStreak: Number(decodeFirestoreValue(fields.bestStreak) ?? 0),
    totalFocusHours: Number(decodeFirestoreValue(fields.totalFocusHours) ?? 0),
    weeklyXp: Number(decodeFirestoreValue(fields.weeklyXp) ?? 0),
  });
}

function decodeSnapshotEntry(document: FirestoreDocument): LeaderboardSnapshotEntry | null {
  if (!document.fields) return null;
  const fields = document.fields;

  return {
    userId: String(decodeFirestoreValue(fields.userId) ?? ""),
    username: String(decodeFirestoreValue(fields.username) ?? "Whelm user"),
    usernameLower: String(decodeFirestoreValue(fields.usernameLower) ?? ""),
    totalXp: Number(decodeFirestoreValue(fields.totalXp) ?? 0),
    currentStreak: Number(decodeFirestoreValue(fields.currentStreak) ?? 0),
    level: Number(decodeFirestoreValue(fields.level) ?? 1),
    createdAtISO: String(decodeFirestoreValue(fields.createdAtISO) ?? ""),
    updatedAtISO: String(decodeFirestoreValue(fields.updatedAtISO) ?? ""),
    bandanaColor: (decodeFirestoreValue(fields.bandanaColor) as string | null) ?? null,
    bandanaLabel: (decodeFirestoreValue(fields.bandanaLabel) as string | null) ?? null,
    bestStreak: Number(decodeFirestoreValue(fields.bestStreak) ?? 0),
    totalFocusHours: Number(decodeFirestoreValue(fields.totalFocusHours) ?? 0),
    weeklyXp: Number(decodeFirestoreValue(fields.weeklyXp) ?? 0),
    snapshotDate: String(decodeFirestoreValue(fields.snapshotDate) ?? ""),
    metric: (decodeFirestoreValue(fields.metric) as LeaderboardMetric) ?? "xp",
    rank: Number(decodeFirestoreValue(fields.rank) ?? 0),
    previousRank: (decodeFirestoreValue(fields.previousRank) as number | null) ?? null,
    movement: Number(decodeFirestoreValue(fields.movement) ?? 0),
    movementDirection:
      (decodeFirestoreValue(fields.movementDirection) as LeaderboardSnapshotEntry["movementDirection"]) ??
      "same",
  };
}

function snapshotRunFields(snapshotDate: string, metric: LeaderboardMetric, totalEntries: number) {
  return {
    snapshotDate,
    metric,
    totalEntries,
    status: "ready",
    computedAtISO: new Date().toISOString(),
  };
}

export async function saveLeaderboardProfile(authHeader: string, profile: LeaderboardProfile) {
  const { apiKey } = requireConfig();
  const response = await fetch(
    `${documentsBaseUrl()}/leaderboardProfiles/${encodeURIComponent(profile.userId)}?key=${apiKey}`,
    {
      method: "PATCH",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(profile).map(([key, value]) => [key, encodeFirestoreValue(value)]),
        ),
      }),
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to save leaderboard profile.");
  }

  return profile;
}

async function listAllProfiles(authHeader: string) {
  const all: LeaderboardProfile[] = [];
  let pageToken: string | undefined;

  do {
    const page = await listDocuments(authHeader, "leaderboardProfiles", pageToken);
    all.push(
      ...(page.documents ?? [])
        .map((document) => decodeProfile(document))
        .filter((entry): entry is LeaderboardProfile => Boolean(entry)),
    );
    pageToken = page.nextPageToken || undefined;
  } while (pageToken);

  return all;
}

async function latestSnapshotDate(authHeader: string, metric: LeaderboardMetric) {
  const rows = await runQuery(authHeader, {
    from: [{ collectionId: "leaderboardSnapshotRuns" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "metric" },
        op: "EQUAL",
        value: { stringValue: metric },
      },
    },
    orderBy: [{ field: { fieldPath: "snapshotDate" }, direction: "DESCENDING" }],
    limit: 1,
  });

  const doc = rows[0]?.document;
  if (!doc?.fields) return null;
  return String(decodeFirestoreValue(doc.fields.snapshotDate) ?? null);
}

async function totalEntriesForSnapshot(authHeader: string, snapshotDate: string, metric: LeaderboardMetric) {
  const doc = await getDocument(authHeader, `leaderboardSnapshotRuns/${snapshotRunDocId(snapshotDate, metric)}`);
  if (!doc?.fields) return 0;
  return Number(decodeFirestoreValue(doc.fields.totalEntries) ?? 0);
}

async function querySnapshotWindow(
  authHeader: string,
  snapshotDate: string,
  metric: LeaderboardMetric,
  minRank: number,
  maxRank: number,
) {
  const rows = await runQuery(authHeader, {
    from: [{ collectionId: "leaderboardDailySnapshots" }],
    where: {
      compositeFilter: {
        op: "AND",
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: "metric" },
              op: "EQUAL",
              value: { stringValue: metric },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "snapshotDate" },
              op: "EQUAL",
              value: { stringValue: snapshotDate },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "rank" },
              op: "GREATER_THAN_OR_EQUAL",
              value: { integerValue: String(minRank) },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: "rank" },
              op: "LESS_THAN_OR_EQUAL",
              value: { integerValue: String(maxRank) },
            },
          },
        ],
      },
    },
    orderBy: [{ field: { fieldPath: "rank" }, direction: "ASCENDING" }],
  });

  return rows
    .map((row) => (row.document ? decodeSnapshotEntry(row.document) : null))
    .filter((entry): entry is LeaderboardSnapshotEntry => Boolean(entry));
}

async function previousRanksForUsers(
  authHeader: string,
  snapshotDate: string,
  metric: LeaderboardMetric,
  userIds: string[],
) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, number>();

  const docs = await Promise.all(
    uniqueIds.map((userId) =>
      getDocument(authHeader, `leaderboardDailySnapshots/${snapshotEntryDocId(snapshotDate, metric, userId)}`),
    ),
  );

  const map = new Map<string, number>();
  docs.forEach((document, index) => {
    const entry = document ? decodeSnapshotEntry(document) : null;
    if (entry?.userId && entry.rank > 0) {
      map.set(entry.userId, entry.rank);
      return;
    }
    const fallbackUserId = uniqueIds[index];
    if (fallbackUserId) map.set(fallbackUserId, 0);
  });

  return map;
}

export async function getLeaderboardPage(authHeader: string, input: {
  metric: LeaderboardMetric;
  limit: number;
  cursor?: string | null;
  userId?: string | null;
  aroundWindow?: number;
}): Promise<LeaderboardPageResponse> {
  // Read live from leaderboardProfiles so every registered user appears
  // immediately with their current XP/streak, no daily rebuild required.
  const profiles = await listAllProfiles(authHeader);

  if (profiles.length === 0) {
    return {
      metric: input.metric,
      snapshotDate: null,
      items: [],
      aroundMe: [],
      nextCursor: null,
      hasMore: false,
      totalEntries: 0,
      source: "fallback",
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...profiles].sort((left, right) =>
    compareLeaderboardProfiles(left, right, input.metric),
  );

  // Cursor encodes the last rank seen; next page starts at rank + 1.
  const startRankExclusive = decodeCursor(input.cursor ?? null);
  const startIndex = startRankExclusive; // 0-based; rank = index + 1
  const pageProfiles = sorted.slice(startIndex, startIndex + input.limit);

  let aroundProfiles: Array<{ profile: LeaderboardProfile; rank: number }> = [];
  if (input.userId) {
    const userIndex = sorted.findIndex((p) => p.userId === input.userId);
    if (userIndex >= 0) {
      const window = Math.max(1, input.aroundWindow ?? 2);
      const rangeStart = Math.max(0, userIndex - window);
      const rangeEnd = Math.min(sorted.length - 1, userIndex + window);
      aroundProfiles = sorted
        .slice(rangeStart, rangeEnd + 1)
        .map((profile, i) => ({ profile, rank: rangeStart + i + 1 }));
    }
  }

  const previousSnapshotDate = await latestSnapshotDate(authHeader, input.metric);
  const previousRankMap =
    previousSnapshotDate && previousSnapshotDate !== today
      ? await previousRanksForUsers(
          authHeader,
          previousSnapshotDate,
          input.metric,
          [
            ...pageProfiles.map((profile) => profile.userId),
            ...aroundProfiles.map(({ profile }) => profile.userId),
          ],
        )
      : new Map<string, number>();

  function toEntry(profile: LeaderboardProfile, rank: number): LeaderboardSnapshotEntry {
    const previousRankRaw = previousRankMap.get(profile.userId) ?? null;
    const previousRank = previousRankRaw && previousRankRaw > 0 ? previousRankRaw : null;
    return {
      ...profile,
      snapshotDate: today,
      metric: input.metric,
      rank,
      previousRank,
      movement: previousRank === null ? 0 : previousRank - rank,
      movementDirection: movementDirection(rank, previousRank),
    };
  }

  const items = pageProfiles.map((profile, i) => toEntry(profile, startIndex + i + 1));
  const aroundMe = aroundProfiles.map(({ profile, rank }) => toEntry(profile, rank));
  const lastRank = items.length > 0 ? items[items.length - 1].rank : null;

  return {
    metric: input.metric,
    snapshotDate: today,
    items,
    aroundMe,
    nextCursor:
      items.length === input.limit && lastRank !== null ? encodeCursor(lastRank) : null,
    hasMore: startIndex + input.limit < sorted.length,
    totalEntries: sorted.length,
    source: "snapshot",
  };
}

async function commitWrites(authHeader: string, writes: Array<{ path: string; fields: Record<string, unknown> }>) {
  if (writes.length === 0) return;
  const { apiKey } = requireConfig();
  const response = await fetch(`${documentsBaseUrl()}:commit?key=${apiKey}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      writes: writes.map((write) => ({
        update: {
          name: documentName(write.path),
          fields: Object.fromEntries(
            Object.entries(write.fields).map(([key, value]) => [key, encodeFirestoreValue(value)]),
          ),
        },
      })),
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    throw new Error(body?.error?.message || body?.error?.status || "Failed to commit leaderboard writes.");
  }
}

export async function rebuildLeaderboardSnapshots(authHeader: string, snapshotDate: string) {
  const profiles = await listAllProfiles(authHeader);

  for (const metric of ["xp", "streak"] as const) {
    const previousDate = await latestSnapshotDate(authHeader, metric);
    const previousRankMap = new Map<string, number>();

    if (previousDate) {
      let cursor: string | null = null;
      let hasMore = true;
      while (hasMore) {
        const page = await getLeaderboardPage(authHeader, {
          metric,
          limit: 400,
          cursor,
        });
        page.items.forEach((item) => previousRankMap.set(item.userId, item.rank));
        cursor = page.nextCursor;
        hasMore = page.hasMore && Boolean(cursor);
      }
    }

    const sorted = [...profiles].sort((left, right) => compareLeaderboardProfiles(left, right, metric));
    const writes: Array<{ path: string; fields: Record<string, unknown> }> = [];

    sorted.forEach((profile, index) => {
      const rank = index + 1;
      const previousRank = previousRankMap.get(profile.userId) ?? null;
      writes.push({
        path: `leaderboardDailySnapshots/${snapshotEntryDocId(snapshotDate, metric, profile.userId)}`,
        fields: {
          ...profile,
          snapshotDate,
          metric,
          rank,
          previousRank,
          movement: previousRank === null ? 0 : previousRank - rank,
          movementDirection: movementDirection(rank, previousRank),
        },
      });
    });

    writes.push({
      path: `leaderboardSnapshotRuns/${snapshotRunDocId(snapshotDate, metric)}`,
      fields: snapshotRunFields(snapshotDate, metric, sorted.length),
    });

    for (let index = 0; index < writes.length; index += 200) {
      await commitWrites(authHeader, writes.slice(index, index + 200));
    }
  }

  return { ok: true, snapshotDate, profilesProcessed: profiles.length };
}
