const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

function countWords(value) {
  const plain = String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plain ? plain.split(" ").length : 0;
}

function dayKeyLocal(input) {
  const d = new Date(input);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayKeyUtc(input) {
  const d = new Date(input);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function startOfDayLocal(input) {
  const d = new Date(input);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function isPlannedBlockCompletionSession(session) {
  return String(session?.note ?? "").trim().toLowerCase().startsWith("planned block completed:");
}

function buildSessionMinutesByDay(sessions) {
  const map = new Map();
  for (const session of sessions) {
    const key = isPlannedBlockCompletionSession(session)
      ? dayKeyUtc(session.completedAtISO)
      : dayKeyLocal(session.completedAtISO);
    map.set(key, (map.get(key) ?? 0) + Number(session.minutes ?? 0));
  }
  return map;
}

function inferCompletedBlocksByDay(sessions) {
  const map = new Map();
  for (const session of sessions) {
    if (!isPlannedBlockCompletionSession(session)) continue;
    const key = dayKeyUtc(session.completedAtISO);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function mergeCounts(primary, secondary) {
  const merged = new Map(primary);
  for (const [key, value] of secondary.entries()) {
    merged.set(key, Math.max(merged.get(key) ?? 0, value));
  }
  return merged;
}

function parsePlannedBlocksDocument(data) {
  if (!data) return [];
  if (Array.isArray(data.plannedBlocks)) return data.plannedBlocks;
  if (Array.isArray(data.blocks)) return data.blocks;
  if (typeof data.blocksJson === "string") {
    try {
      const parsed = JSON.parse(data.blocksJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const STREAK_RULE_V2_START_DATE = "2026-03-22";

function doesDateQualifyForStreak({ dateKey, focusMinutes, completedBlocks, noteWords, todayKey, protectedDateKeys }) {
  if (protectedDateKeys.includes(dateKey)) return true;
  if (dateKey < STREAK_RULE_V2_START_DATE) return focusMinutes > 0;
  if (dateKey > todayKey) return false;
  return completedBlocks >= 1 && (focusMinutes >= 30 || noteWords >= 33);
}

function computeStreakEndingAtDateKey(anchorDateKey, qualifiedKeys) {
  const days = new Set(qualifiedKeys);
  if (!days.has(anchorDateKey)) return 0;
  let streak = 0;
  const cursor = new Date(`${anchorDateKey}T00:00:00`);
  while (days.has(dayKeyLocal(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function computeHistoricalStreaks(qualifiedKeys) {
  const days = [...new Set(qualifiedKeys)].sort();
  const map = new Map();
  let previousDate = null;
  let currentRun = 0;
  for (const dayKey of days) {
    const currentDate = new Date(`${dayKey}T00:00:00`);
    if (!previousDate) {
      currentRun = 1;
    } else {
      const expected = new Date(previousDate);
      expected.setDate(expected.getDate() + 1);
      currentRun = dayKeyLocal(expected) === dayKey ? currentRun + 1 : 1;
    }
    map.set(dayKey, currentRun);
    previousDate = currentDate;
  }
  return map;
}

async function main() {
  const uid = process.argv[2] || "JrmPIR80WcPM9OQbLspF51VyOHj1";
  const privateKey = String(process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const app =
    getApps()[0] ||
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
    });

  const db = getFirestore(
    app,
    process.env.FIREBASE_DATABASE_ID || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "(default)",
  );

  console.error("[audit] loading sessions window");
  const sessionsSnap = await db.collection("sessions").where("uid", "==", uid).get();
  console.error("[audit] loading planned/reflection/notes/profile");
  const [plannedSnap, reflectionSnap, notesSnap, profileSnap] = await Promise.all([
    db.collection("userPlannedBlocks").doc(uid).get(),
    db.collection("userReflectionState").doc(uid).get(),
    db.collection("userNotes").doc(uid).collection("notes").get(),
    db.collection("leaderboardProfiles").doc(uid).get(),
  ]);

  const sessions = sessionsSnap.docs
    .map((doc) => doc.data())
    .filter((session) => String(session.completedAtISO ?? "") >= "2026-03-20T00:00:00.000Z");
  const plannedBlocks = parsePlannedBlocksDocument(plannedSnap.data());
  const reflection = reflectionSnap.data() ?? {};
  const notes = notesSnap.docs.map((doc) => doc.data());

  console.error("[audit] loading note revisions", notes.length);
  const revisionsByNoteId = Object.fromEntries(
    await Promise.all(
      notes.map(async (note) => {
        const revisionsSnap = await db
          .collection("userNotes")
          .doc(uid)
          .collection("notes")
          .doc(note.id)
          .collection("revisions")
          .get();
        return [note.id, revisionsSnap.docs.map((doc) => doc.data())];
      }),
    ),
  );

  const noteWordsByDay = new Map();
  for (const note of notes) {
    const bestByDay = new Map();
    const entries = [
      {
        dateKey: dayKeyLocal(note.updatedAtISO),
        words: countWords(note.body ?? ""),
      },
      ...((revisionsByNoteId[note.id] ?? []).map((revision) => ({
        dateKey: dayKeyLocal(revision.sourceUpdatedAtISO),
        words: countWords(revision.body ?? ""),
      }))),
    ];

    for (const entry of entries) {
      if (entry.words <= 0) continue;
      bestByDay.set(entry.dateKey, Math.max(bestByDay.get(entry.dateKey) ?? 0, entry.words));
    }

    for (const [dateKey, words] of bestByDay.entries()) {
      noteWordsByDay.set(dateKey, (noteWordsByDay.get(dateKey) ?? 0) + words);
    }
  }

  const completedBlocksByDay = new Map();
  for (const block of plannedBlocks) {
    if (block?.status !== "completed") continue;
    const key = String(block.dateKey ?? "").slice(0, 10);
    if (!key) continue;
    completedBlocksByDay.set(key, (completedBlocksByDay.get(key) ?? 0) + 1);
  }

  const sickDaySaves = Array.isArray(reflection.sickDaySaves)
    ? reflection.sickDaySaves
    : typeof reflection.sickDaySavesJson === "string"
      ? JSON.parse(reflection.sickDaySavesJson)
      : [];

  const protectedStreakDateKeys = sickDaySaves.map((save) => String(save.dateKey).slice(0, 10));

  const sessionMinutesByDay = buildSessionMinutesByDay(sessions);
  const inferredCompletedBlocksByDay = inferCompletedBlocksByDay(sessions);
  const effectiveCompletedBlocksByDay = mergeCounts(completedBlocksByDay, inferredCompletedBlocksByDay);

  const todayKey = dayKeyLocal(new Date());
  const trackedKeys = [
    ...new Set([
      ...sessionMinutesByDay.keys(),
      ...effectiveCompletedBlocksByDay.keys(),
      ...noteWordsByDay.keys(),
      ...protectedStreakDateKeys,
    ]),
  ].sort();

  const ledger = trackedKeys.map((dateKey) => {
    const focusMinutes = sessionMinutesByDay.get(dateKey) ?? 0;
    const completedBlocks = effectiveCompletedBlocksByDay.get(dateKey) ?? 0;
    const noteWords = noteWordsByDay.get(dateKey) ?? 0;
    const protectedDay = protectedStreakDateKeys.includes(dateKey);
    const qualifies = doesDateQualifyForStreak({
      dateKey,
      focusMinutes,
      completedBlocks,
      noteWords,
      todayKey,
      protectedDateKeys: protectedStreakDateKeys,
    });
    return {
      date: dateKey,
      minutes: focusMinutes,
      storedBlocks: completedBlocksByDay.get(dateKey) ?? 0,
      inferredBlocks: inferredCompletedBlocksByDay.get(dateKey) ?? 0,
      effectiveBlocks: completedBlocks,
      words: noteWords,
      protected: protectedDay,
      qualifies,
    };
  });

  const qualifiedKeys = ledger.filter((day) => day.qualifies).map((day) => day.date);
  const yesterdayKey = dayKeyLocal(addDays(startOfDayLocal(new Date()), -1));
  const displayStreak = qualifiedKeys.includes(todayKey)
    ? computeStreakEndingAtDateKey(todayKey, qualifiedKeys)
    : computeStreakEndingAtDateKey(yesterdayKey, qualifiedKeys);
  const longestStreak = Math.max(0, ...computeHistoricalStreaks(qualifiedKeys).values());

  console.log(
    JSON.stringify(
      {
        leaderboardProfile: profileSnap.data() ?? null,
        plannedDocKeys: plannedSnap.exists ? Object.keys(plannedSnap.data() ?? {}) : [],
        plannedBlockCount: plannedBlocks.length,
        todayKey,
        displayStreak,
        longestStreak,
        protectedStreakDateKeys,
        qualifiedTail: qualifiedKeys.slice(-20),
        recent: ledger.filter((day) => day.date >= "2026-03-24"),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
