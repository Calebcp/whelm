"use client";

export type ClientRuntimeSnapshot = {
  online: boolean;
  userAgent: string;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  localStorageAvailable: boolean;
  sessionStorageAvailable: boolean;
};

function canUseStorage(kind: "localStorage" | "sessionStorage") {
  try {
    const storage = window[kind];
    const key = `whelm:storage-check:${kind}`;
    storage.setItem(key, "1");
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function getClientRuntimeSnapshot(): ClientRuntimeSnapshot | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return null;
  }

  return {
    online: navigator.onLine,
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    localStorageAvailable: canUseStorage("localStorage"),
    sessionStorageAvailable: canUseStorage("sessionStorage"),
  };
}

export function logClientRuntime(area: string) {
  const snapshot = getClientRuntimeSnapshot();
  if (!snapshot) return;
  console.info(`[whelm:runtime] ${area}`, snapshot);
}
