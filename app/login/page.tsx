"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [status, setStatus] = useState("");

  async function signUp() {
    setStatus("");
    try {
      await createUserWithEmailAndPassword(auth, email, pw);
      router.push("/");
    } catch (e: any) {
      setStatus(e?.message || "Sign up failed");
    }
  }

  async function signIn() {
    setStatus("");
    try {
      await signInWithEmailAndPassword(auth, email, pw);
      router.push("/");
    } catch (e: any) {
      setStatus(e?.message || "Sign in failed");
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-6">
      <div className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">WHELM</h1>
          <p className="mt-2 text-sm text-gray-600">Underwhelm the overwhelm.</p>
        </div>

        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-gray-400"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-gray-400"
            placeholder="Password (6+ chars)"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />

          <div className="flex gap-3">
            <button
              onClick={signIn}
              className="flex-1 rounded-xl bg-black px-4 py-3 text-white hover:opacity-90"
            >
              Sign in
            </button>
            <button
              onClick={signUp}
              className="flex-1 rounded-xl bg-gray-200 px-4 py-3 hover:opacity-90"
            >
              Sign up
            </button>
          </div>

          {status && (
            <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
              {status}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}