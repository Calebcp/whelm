"use client";

import { useEffect, useState, type ReactNode } from "react";

function isOvernight(date: Date) {
  const hour = date.getHours();
  return hour >= 0 && hour < 8;
}

export default function OvernightWarning({
  children,
}: {
  children: ReactNode;
}) {
  const [overnight, setOvernight] = useState(false);

  useEffect(() => {
    const syncWarningMode = () => {
      setOvernight(isOvernight(new Date()));
    };

    syncWarningMode();

    const intervalId = window.setInterval(syncWarningMode, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("overnight-mode", overnight);

    return () => {
      document.body.classList.remove("overnight-mode");
    };
  }, [overnight]);

  return (
    <>
      {overnight && (
        <div className="overnight-warning" role="alert" aria-live="polite">
          <div className="overnight-warning__eyebrow">Late-night warning</div>
          <div className="overnight-warning__text">You should be in bed. Period.</div>
        </div>
      )}
      {children}
    </>
  );
}
