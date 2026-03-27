import type { User } from "firebase/auth";

import { resolveApiUrl } from "@/lib/api-base";

export type PreferencesThemeMode = "dark" | "light" | "system";
export type PreferencesCompanionStyle = "gentle" | "balanced" | "strict";
export type PreferencesBackgroundSetting =
  | { kind: "default" }
  | { kind: "preset"; value: string }
  | { kind: "upload"; value: string };

export type PreferencesBackgroundSkin = {
  mode: "solid" | "glass";
  dim: number;
  surfaceOpacity: number;
  blur: number;
  imageFit: "fill" | "fit";
};

export type PreferencesProState = {
  isPro: boolean;
  source: "preview" | "store" | "none";
};

export type PreferencesState = {
  themeMode: PreferencesThemeMode;
  companionStyle: PreferencesCompanionStyle;
  backgroundSetting: PreferencesBackgroundSetting;
  backgroundSkin: PreferencesBackgroundSkin;
  proState: PreferencesProState;
};

export type PreferencesSyncResult = PreferencesState & {
  synced: boolean;
  message?: string;
};

const storagePrefix = "whelm:preferences:";
const DEFAULT_BACKGROUND_SKIN: PreferencesBackgroundSkin = {
  mode: "glass",
  dim: 0.58,
  surfaceOpacity: 0.72,
  blur: 18,
  imageFit: "fit",
};

function storageKey(uid: string) {
  return `${storagePrefix}${uid}`;
}

function normalizeBackgroundSetting(
  setting: PreferencesBackgroundSetting | null | undefined,
): PreferencesBackgroundSetting {
  if (setting?.kind === "preset" && typeof setting.value === "string") return setting;
  if (setting?.kind === "upload" && typeof setting.value === "string") return setting;
  return { kind: "default" };
}

function normalizeBackgroundSkin(
  skin: Partial<PreferencesBackgroundSkin> | null | undefined,
): PreferencesBackgroundSkin {
  return {
    mode: skin?.mode === "solid" ? "solid" : "glass",
    dim: Math.min(0.96, Math.max(0.02, Number(skin?.dim) || DEFAULT_BACKGROUND_SKIN.dim)),
    surfaceOpacity: Math.min(
      0.98,
      Math.max(0.08, Number(skin?.surfaceOpacity) || DEFAULT_BACKGROUND_SKIN.surfaceOpacity),
    ),
    blur: Math.min(40, Math.max(0, Number(skin?.blur) || DEFAULT_BACKGROUND_SKIN.blur)),
    imageFit: skin?.imageFit === "fill" ? "fill" : "fit",
  };
}

function normalizeState(state: Partial<PreferencesState> | null | undefined): PreferencesState {
  return {
    themeMode: state?.themeMode === "light" ? "light" : "dark",
    companionStyle:
      state?.companionStyle === "gentle" || state?.companionStyle === "strict"
        ? state.companionStyle
        : "balanced",
    backgroundSetting: normalizeBackgroundSetting(state?.backgroundSetting),
    backgroundSkin: normalizeBackgroundSkin(state?.backgroundSkin),
    proState: {
      isPro:
        typeof state?.proState?.isPro === "boolean"
          ? state.proState.isPro
          : true,
      source:
        state?.proState?.source === "store" || state?.proState?.source === "preview"
          ? state.proState.source
          : "none",
    },
  };
}

function readLocalState(uid: string) {
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    return raw ? normalizeState(JSON.parse(raw) as PreferencesState) : normalizeState(undefined);
  } catch {
    return normalizeState(undefined);
  }
}

function writeLocalState(uid: string, state: PreferencesState) {
  window.localStorage.setItem(storageKey(uid), JSON.stringify(normalizeState(state)));
}

export function readLocalPreferences(uid: string) {
  return readLocalState(uid);
}

export function writeLocalPreferences(uid: string, state: PreferencesState) {
  writeLocalState(uid, state);
}

async function authorizedRequest(user: User, input: string, init: RequestInit, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const token = await user.getIdToken();

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || response.statusText || "Preferences request failed.");
    }

    return response;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function loadPreferences(user: User) {
  const localState = readLocalState(user.uid);

  try {
    const response = await authorizedRequest(
      user,
      resolveApiUrl(`/api/preferences?uid=${encodeURIComponent(user.uid)}`),
      { method: "GET" },
    );
    const body = (await response.json()) as Partial<PreferencesState>;
    const state = normalizeState(body);
    writeLocalState(user.uid, state);
    return { ...state, synced: true } as PreferencesSyncResult;
  } catch (error: unknown) {
    return {
      ...localState,
      synced: false,
      message:
        error instanceof Error
          ? error.message
          : "Cloud sync unavailable. Local preferences are still saved.",
    } as PreferencesSyncResult;
  }
}

export async function savePreferences(user: User, state: PreferencesState) {
  const normalized = normalizeState(state);
  writeLocalState(user.uid, normalized);

  try {
    await authorizedRequest(user, resolveApiUrl("/api/preferences"), {
      method: "POST",
      body: JSON.stringify({
        uid: user.uid,
        ...normalized,
      }),
    });
    return { ...normalized, synced: true } as PreferencesSyncResult;
  } catch {
    return {
      ...normalized,
      synced: false,
      message: "Saved locally. Cloud sync is currently unavailable.",
    } as PreferencesSyncResult;
  }
}
