import { Capacitor } from "@capacitor/core";

const PRO_STATE_KEY = "whelm-pro-state-v1";

export type ProState = {
  isPro: boolean;
  source: "preview" | "store" | "none";
};

function readFromStorage(): ProState {
  if (typeof window === "undefined") {
    return { isPro: true, source: "preview" };
  }

  const raw = window.localStorage.getItem(PRO_STATE_KEY);
  if (!raw) return { isPro: true, source: "preview" };

  try {
    const parsed = JSON.parse(raw) as Partial<ProState>;
    return {
      isPro: Boolean(parsed.isPro),
      source: parsed.source === "store" || parsed.source === "preview" ? parsed.source : "none",
    };
  } catch {
    return { isPro: true, source: "preview" };
  }
}

function writeToStorage(state: ProState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PRO_STATE_KEY, JSON.stringify(state));
}

export async function getProState() {
  return readFromStorage();
}

export async function startProPreview() {
  const next: ProState = { isPro: true, source: "preview" };
  writeToStorage(next);
  return next;
}

export async function restoreFreeTier() {
  const next: ProState = { isPro: false, source: "none" };
  writeToStorage(next);
  return next;
}

export function isStorePurchaseSupported() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}
