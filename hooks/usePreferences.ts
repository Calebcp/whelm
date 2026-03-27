"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";

import { db, storage } from "@/lib/firebase";
import {
  loadPreferences,
  readLocalPreferences,
  savePreferences,
  type PreferencesBackgroundSetting,
  type PreferencesBackgroundSkin,
  type PreferencesCompanionStyle,
  type PreferencesProState,
  type PreferencesState,
  type PreferencesThemeMode,
  writeLocalPreferences,
} from "@/lib/preferences-store";

type UsePreferencesOptions = {
  user: User | null;
  isPro: boolean;
  defaultBackgroundSkin: PreferencesBackgroundSkin;
  showToast?: (message: string, tone?: "success" | "warning" | "error" | "info") => void;
};

export function usePreferences({
  user,
  isPro,
  defaultBackgroundSkin,
  showToast,
}: UsePreferencesOptions) {
  const [companionStyle, setCompanionStyle] = useState<PreferencesCompanionStyle>("balanced");
  const [themeMode, setThemeMode] = useState<PreferencesThemeMode>("dark");
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : true,
  );
  const [themePromptOpen, setThemePromptOpen] = useState(false);
  const [appBackgroundSetting, setAppBackgroundSetting] = useState<PreferencesBackgroundSetting>({
    kind: "default",
  });
  const [backgroundSkin, setBackgroundSkin] = useState<PreferencesBackgroundSkin>(defaultBackgroundSkin);
  const [proState, setProState] = useState<PreferencesProState>({ isPro: true, source: "preview" });

  const resolvedTheme: "dark" | "light" =
    themeMode === "system" ? (systemIsDark ? "dark" : "light") : themeMode;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => setSystemIsDark(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    document.body.dataset.theme = resolvedTheme;
    return () => {
      delete document.body.dataset.theme;
    };
  }, [resolvedTheme]);

  const applyPreferencesSnapshot = useCallback((prefs: PreferencesState) => {
    setCompanionStyle(prefs.companionStyle);
    setThemeMode(prefs.themeMode);
    setThemePromptOpen(false);
    setAppBackgroundSetting(prefs.backgroundSetting);
    setBackgroundSkin(prefs.backgroundSkin);
    setProState(prefs.proState);
    if (user) {
      writeLocalPreferences(user.uid, prefs);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    applyPreferencesSnapshot(readLocalPreferences(user.uid));

    let cancelled = false;
    void loadPreferences(user).then((prefs) => {
      if (cancelled) return;
      applyPreferencesSnapshot(prefs);
    });

    return () => {
      cancelled = true;
    };
  }, [applyPreferencesSnapshot, user]);

  const persistPreferencesState = useCallback(async (nextState: PreferencesState) => {
    if (!user) return;

    applyPreferencesSnapshot(nextState);

    // Firestore SDK write — best-effort. If this fails (e.g. missing security rule)
    // we must not block the authoritative REST API write below.
    await setDoc(
      doc(db, "userPreferences", user.uid),
      {
        uid: user.uid,
        preferencesJson: JSON.stringify(nextState),
        updatedAtISO: new Date().toISOString(),
      },
      { merge: true },
    ).catch((err: unknown) => {
      console.warn("[whelm] preferences Firestore SDK write failed (non-fatal):", err);
    });

    await savePreferences(user, nextState);
  }, [applyPreferencesSnapshot, user]);

  const applyThemeMode = useCallback((nextMode: PreferencesThemeMode) => {
    void persistPreferencesState({
      companionStyle,
      themeMode: nextMode,
      backgroundSetting: appBackgroundSetting,
      backgroundSkin,
      proState,
    });
  }, [appBackgroundSetting, backgroundSkin, companionStyle, persistPreferencesState, proState]);

  const applyBackgroundSetting = useCallback((nextSetting: PreferencesBackgroundSetting) => {
    void persistPreferencesState({
      companionStyle,
      themeMode,
      backgroundSetting: nextSetting,
      backgroundSkin,
      proState,
    });
  }, [backgroundSkin, companionStyle, persistPreferencesState, proState, themeMode]);

  const applyCompanionStyle = useCallback((nextStyle: PreferencesCompanionStyle) => {
    void persistPreferencesState({
      companionStyle: nextStyle,
      themeMode,
      backgroundSetting: appBackgroundSetting,
      backgroundSkin,
      proState,
    });
  }, [appBackgroundSetting, backgroundSkin, persistPreferencesState, proState, themeMode]);

  const updateBackgroundSkin = useCallback((nextSkin: PreferencesBackgroundSkin) => {
    void persistPreferencesState({
      companionStyle,
      themeMode,
      backgroundSetting: appBackgroundSetting,
      backgroundSkin: nextSkin,
      proState,
    });
  }, [appBackgroundSetting, companionStyle, persistPreferencesState, proState, themeMode]);

  const handleBackgroundUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !isPro || !user) return;

    try {
      const extension = file.name.includes(".")
        ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
        : "";
      const objectPath = `users/${user.uid}/backgrounds/app-background${extension}`;
      const backgroundRef = storageRef(storage, objectPath);

      await uploadBytes(backgroundRef, file, {
        contentType: file.type || "application/octet-stream",
        cacheControl: "public,max-age=31536000,immutable",
      });

      const downloadUrl = await getDownloadURL(backgroundRef);
      applyBackgroundSetting({ kind: "upload", value: downloadUrl });
      showToast?.("Background updated across your account.", "success");
    } catch (error: unknown) {
      showToast?.(
        error instanceof Error
          ? error.message
          : "Background upload failed. Your current background was kept.",
        "error",
      );
    }
  }, [applyBackgroundSetting, isPro, showToast, user]);

  const effectiveBackgroundSetting = useMemo(
    () => (isPro ? appBackgroundSetting : { kind: "default" as const }),
    [appBackgroundSetting, isPro],
  );
  const backgroundSkinActive =
    isPro && effectiveBackgroundSetting.kind !== "default" && backgroundSkin.mode === "glass";

  return {
    companionStyle,
    themeMode,
    resolvedTheme,
    themePromptOpen,
    appBackgroundSetting,
    backgroundSkin,
    effectiveBackgroundSetting,
    backgroundSkinActive,
    setThemePromptOpen,
    applyPreferencesSnapshot,
    applyThemeMode,
    applyBackgroundSetting,
    applyCompanionStyle,
    updateBackgroundSkin,
    handleBackgroundUpload,
  };
}
