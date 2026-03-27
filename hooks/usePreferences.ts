"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { doc, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";

import { db } from "@/lib/firebase";
import {
  savePreferences,
  type PreferencesBackgroundSetting,
  type PreferencesBackgroundSkin,
  type PreferencesCompanionStyle,
  type PreferencesState,
  type PreferencesThemeMode,
} from "@/lib/preferences-store";

type UsePreferencesOptions = {
  user: User | null;
  isPro: boolean;
  defaultBackgroundSkin: PreferencesBackgroundSkin;
};

export function usePreferences({
  user,
  isPro,
  defaultBackgroundSkin,
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
  }, []);

  const persistPreferencesState = useCallback(async (nextState: PreferencesState) => {
    if (!user) return;

    applyPreferencesSnapshot(nextState);

    void setDoc(
      doc(db, "userPreferences", user.uid),
      {
        uid: user.uid,
        preferencesJson: JSON.stringify(nextState),
        updatedAtISO: new Date().toISOString(),
      },
      { merge: true },
    );

    await savePreferences(user, nextState);
  }, [applyPreferencesSnapshot, user]);

  const applyThemeMode = useCallback((nextMode: PreferencesThemeMode) => {
    void persistPreferencesState({
      companionStyle,
      themeMode: nextMode,
      backgroundSetting: appBackgroundSetting,
      backgroundSkin,
    });
  }, [appBackgroundSetting, backgroundSkin, companionStyle, persistPreferencesState]);

  const applyBackgroundSetting = useCallback((nextSetting: PreferencesBackgroundSetting) => {
    void persistPreferencesState({
      companionStyle,
      themeMode,
      backgroundSetting: nextSetting,
      backgroundSkin,
    });
  }, [backgroundSkin, companionStyle, persistPreferencesState, themeMode]);

  const applyCompanionStyle = useCallback((nextStyle: PreferencesCompanionStyle) => {
    void persistPreferencesState({
      companionStyle: nextStyle,
      themeMode,
      backgroundSetting: appBackgroundSetting,
      backgroundSkin,
    });
  }, [appBackgroundSetting, backgroundSkin, persistPreferencesState, themeMode]);

  const updateBackgroundSkin = useCallback((nextSkin: PreferencesBackgroundSkin) => {
    void persistPreferencesState({
      companionStyle,
      themeMode,
      backgroundSetting: appBackgroundSetting,
      backgroundSkin: nextSkin,
    });
  }, [appBackgroundSetting, companionStyle, persistPreferencesState, themeMode]);

  const handleBackgroundUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isPro) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        applyBackgroundSetting({ kind: "upload", value: reader.result });
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }, [applyBackgroundSetting, isPro]);

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
