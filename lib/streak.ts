export type SessionCategory = "misc" | "language" | "software";

export type SessionDoc = {
  uid: string;
  completedAtISO: string;
  minutes: number;
  category?: SessionCategory;
  note?: string;
  noteSavedAtISO?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymdLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function computeStreak(sessions: SessionDoc[]) {
  const days = new Set<string>();
  for (const s of sessions) days.add(ymdLocal(new Date(s.completedAtISO)));

  let streak = 0;
  const cursor = new Date();
  while (days.has(ymdLocal(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
