"use client";

export function isNativeAppShellProtocol(protocol: string) {
  return protocol === "capacitor:" || protocol === "ionic:" || protocol === "file:";
}

export function isNativeAppShell() {
  if (typeof window === "undefined") return false;
  const protocol = typeof window.location?.protocol === "string" ? window.location.protocol : "";
  return isNativeAppShellProtocol(protocol);
}

export function shouldUseRealtimeNotesSync() {
  return isNativeAppShell();
}
