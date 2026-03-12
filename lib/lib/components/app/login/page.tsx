"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Timer from "@/components/Timer";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { computeStreak, SessionDoc } from "@/lib/streak";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const streak = useMemo(() => computeStreak(sessions), [sessions]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setSessions([]);
        router.push("/login");
        return;
      }
      setUser(u);
      await refreshSessions(u.uid);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshSessions(uid: string) {
    const q = query(collection(db, "sessions"), where("uid", "==", uid));
    const snap = await getDocs(q);
    const list = snap.docs
      .map((d) => d.data() as SessionDoc)
      .filter(Boolean)
      .sort((a, b) => (a.completedAtISO < b.completedAtISO ? 1 : -1));
    setSessions(list);
  }

  async function completeSession() {
    if (!user) return;
    const doc: SessionDoc = {
      uid: user.uid,
      completedAtISO: new Date().toISOString(),
      minutes: 25,
    };
    await addDoc(collection(db, "sessions"), doc);
    await refreshSessions(user.uid);
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-6">
      <div className="mx-auto max-w-3xl">
        <header className="mt-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">WHELM</h1>
            <p className="mt-1 text-sm text-gray-600">Underwhelm the overwhelm.</p>
            <p className="mt-2 text-sm text-gray-700">
              Streak: <span className="font-semibold">{streak}</span> day{streak === 1 ? "" : "s"}
            </p>
          </div>

          <button
            onClick={() => signOut(auth)}
            className="rounded-xl bg-gray-200 px-4 py-2 text-sm hover:opacity-90"
          >
            Sign out
          </button>
        </header>

        <section className="mt-10 flex flex-col items-center gap-6">
          <Timer minutes={25} onComplete={completeSession} />

          <div className="w-full max-w-md rounded-2xl bg-white/70 p-5 shadow-sm">
            <div className="text-sm font-medium">Recent sessions</div>
            <div className="mt-3 space-y-2 text-sm text-gray-700">
              {sessions.slice(0, 5).map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl bg-white p-3"
                >
                  <div>{new Date(s.completedAtISO).toLocaleString()}</div>
                  <div className="text-gray-500">{s.minutes}m</div>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="text-gray-500">No sessions yet. Start your first WHELM.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}