export type SessionCategory = "misc" | "language" | "software";

export type SessionDoc = {
  uid: string;
  completedAtISO: string;
  minutes: number;
  category?: SessionCategory;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function ymdLocal(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function computeStreak(sessions: SessionDoc[]) {
  const days = new Set<string>();

  for (const session of sessions) {
    days.add(ymdLocal(new Date(session.completedAtISO)));
  }

  let streak = 0;
  const cursor = new Date();

  while (days.has(ymdLocal(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
