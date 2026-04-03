const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const STREAK_RULE_V2_START_DATE = "2026-03-22";
const XP_DAILY_CAP = 150;
const XP_COMPLETED_BLOCK_XP = 10;
const XP_COMPLETED_BLOCK_DAILY_CAP = 50;
const XP_STREAK_DAILY_BONUS = 10;
const XP_COMBO_BONUS = 15;
const XP_DEEP_WORK_BONUS = 25;
const XP_WRITING_ENTRY_THRESHOLD = 33;
const XP_WRITING_ENTRY_BONUS = 5;
const XP_WRITING_BONUS_THRESHOLD = 100;
const XP_WRITING_DAILY_CAP = 20;

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

function buildNoteWordsByDay(notes, revisionsByNoteId) {
  const totalsByDay = new Map();
  for (const note of notes) {
    const bestByDay = new Map();
    const entries = [
      {
        dateKey: dayKeyLocal(note.updatedAtISO),
        words: countWords(note.body),
      },
      ...((revisionsByNoteId[note.id] ?? []).map((revision) => ({
        dateKey: dayKeyLocal(revision.sourceUpdatedAtISO),
        words: countWords(revision.body),
      }))),
    ];

    for (const entry of entries) {
      if (entry.words <= 0) continue;
      bestByDay.set(entry.dateKey, Math.max(bestByDay.get(entry.dateKey) ?? 0, entry.words));
    }

    for (const [dateKey, words] of bestByDay.entries()) {
      totalsByDay.set(dateKey, (totalsByDay.get(dateKey) ?? 0) + words);
    }
  }
  return totalsByDay;
}

function doesDateQualify({ dateKey, focusMinutes, completedBlocks, noteWords, todayKey, protectedDateKeys }) {
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

function getMultiplier(streakLength) {
  if (streakLength >= 100) return 2.4;
  if (streakLength >= 50) return 2;
  if (streakLength >= 20) return 1.6;
  if (streakLength >= 10) return 1.35;
  if (streakLength >= 5) return 1.2;
  if (streakLength >= 2) return 1.1;
  return 1;
}

function getWritingBonus(wordCount) {
  if (wordCount >= XP_WRITING_BONUS_THRESHOLD) return XP_WRITING_DAILY_CAP;
  if (wordCount >= XP_WRITING_ENTRY_THRESHOLD) return XP_WRITING_ENTRY_BONUS;
  return 0;
}

function getMilestoneBonus(streakLength) {
  if (streakLength === 100) return 350;
  if (streakLength === 30) return 120;
  if (streakLength === 7) return 40;
  return 0;
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

  const [sessionsSnap, plannedSnap, reflectionSnap, notesSnap, profileSnap] = await Promise.all([
    db.collection("sessions").where("uid", "==", uid).get(),
    db.collection("userPlannedBlocks").doc(uid).get(),
    db.collection("userReflectionState").doc(uid).get(),
    db.collection("userNotes").doc(uid).collection("notes").get(),
    db.collection("leaderboardProfiles").doc(uid).get(),
  ]);

  const sessions = sessionsSnap.docs.map((doc) => doc.data());
  const plannedBlocks = parsePlannedBlocksDocument(plannedSnap.data());
  const reflection = reflectionSnap.data() ?? {};
  const notes = notesSnap.docs.map((doc) => doc.data());
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

  const noteWordsByDay = buildNoteWordsByDay(notes, revisionsByNoteId);
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

  const qualifiedKeys = trackedKeys.filter((dateKey) =>
    doesDateQualify({
      dateKey,
      focusMinutes: sessionMinutesByDay.get(dateKey) ?? 0,
      completedBlocks: effectiveCompletedBlocksByDay.get(dateKey) ?? 0,
      noteWords: noteWordsByDay.get(dateKey) ?? 0,
      todayKey,
      protectedDateKeys: protectedStreakDateKeys,
    }),
  );

  const xpDays = trackedKeys
    .filter((dateKey) => dateKey <= todayKey)
    .map((dateKey) => {
      const focusMinutes = sessionMinutesByDay.get(dateKey) ?? 0;
      const completedBlocks = effectiveCompletedBlocksByDay.get(dateKey) ?? 0;
      const noteWords = noteWordsByDay.get(dateKey) ?? 0;
      const streakLength = computeStreakEndingAtDateKey(dateKey, qualifiedKeys);
      const multiplier = getMultiplier(streakLength);
      const completedBlocksXp = Math.min(
        XP_COMPLETED_BLOCK_DAILY_CAP,
        completedBlocks * XP_COMPLETED_BLOCK_XP,
      );
      const focusXp = Math.floor(focusMinutes / 30) * 20;
      const writingXp = getWritingBonus(noteWords);
      const baseActionXp = completedBlocksXp + focusXp + writingXp;
      const multipliedBaseXp = Math.round(baseActionXp * multiplier);
      const streakDailyXp = streakLength > 0 ? XP_STREAK_DAILY_BONUS : 0;
      const streakMilestoneXp = streakLength > 0 ? getMilestoneBonus(streakLength) : 0;
      const deepWorkXp = focusMinutes >= 90 ? XP_DEEP_WORK_BONUS : 0;
      const comboXp =
        completedBlocks >= 1 && (focusMinutes >= 30 || noteWords >= XP_WRITING_ENTRY_THRESHOLD)
          ? XP_COMBO_BONUS
          : 0;
      const totalXp = Math.min(
        XP_DAILY_CAP,
        multipliedBaseXp + streakDailyXp + streakMilestoneXp + deepWorkXp + comboXp,
      );

      return {
        dateKey,
        focusMinutes,
        completedBlocks,
        noteWords,
        streakLength,
        multiplier,
        baseActionXp,
        multipliedBaseXp,
        streakDailyXp,
        streakMilestoneXp,
        deepWorkXp,
        comboXp,
        totalXp,
      };
    });

  const totalXp = xpDays.reduce((sum, day) => sum + day.totalXp, 0);

  console.log(
    JSON.stringify(
      {
        totalXp,
        leaderboardProfile: profileSnap.data() ?? null,
        recent: xpDays.filter((day) => day.dateKey >= "2026-03-20"),
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
