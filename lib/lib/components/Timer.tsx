"use client";

import { useEffect, useRef, useState } from "react";

export default function Timer({
  minutes = 25,
  onComplete,
}: {
  minutes?: number;
  onComplete: () => Promise<void> | void;
}) {
  const totalSeconds = minutes * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [running, setRunning] = useState(false);

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [running]);

  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;

  function reset() {
    setRunning(false);
    setSecondsLeft(totalSeconds);
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-white/70 p-6 shadow-sm backdrop-blur">
      <div className="text-center">
        <div className="text-6xl font-semibold tabular-nums">
          {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
        </div>
        <div className="mt-2 text-sm text-gray-600">
          {running ? "In WHELM." : "Ready."}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {!running ? (
          <button
            onClick={() => setRunning(true)}
            className="rounded-xl bg-black px-5 py-3 text-white hover:opacity-90"
          >
            Start
          </button>
        ) : (
          <button
            onClick={() => setRunning(false)}
            className="rounded-xl bg-gray-200 px-5 py-3 hover:opacity-90"
          >
            Pause
          </button>
        )}

        <button
          onClick={reset}
          className="rounded-xl bg-gray-200 px-5 py-3 hover:opacity-90"
        >
          Reset
        </button>

        <button
          onClick={async () => {
            await onComplete();
            reset();
          }}
          className="rounded-xl bg-emerald-600 px-5 py-3 text-white hover:opacity-90"
        >
          Complete Session
        </button>
      </div>

      <div className="mt-4 text-center text-xs text-gray-500">
        Focus. Don’t drown.
      </div>
    </div>
  );
}