"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
  type PreferencesNotificationSettings,
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
  const [notificationSettings, setNotificationSettings] = useState<PreferencesNotificationSettings>({
    enabled: false,
    performanceNudges: true,
    noteReminders: true,
  });
  const [proState, setProState] = useState<PreferencesProState>({ isPro: true, source: "preview" });
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const preferencesSignatureRef = useRef<string | null>(null);

  const resolvedTheme: "dark" | "light" =
    themeMode === "system" ? (systemIsDark ? "dark" : "light") : themeMode;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => setSystemIsDark(event.matches);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  useEffect(() => {
    document.body.dataset.theme = resolvedTheme;
    return () => {
      delete document.body.dataset.theme;
    };
  }, [resolvedTheme]);

  const applyPreferencesSnapshot = useCallback((prefs: PreferencesState) => {
    const signature = JSON.stringify(prefs);
    if (preferencesSignatureRef.current === signature) {
      if (user) {
        writeLocalPreferences(user.uid, prefs);
      }
      return;
    }
    preferencesSignatureRef.current = signature;
    setCompanionStyle(prefs.companionStyle);
    setThemeMode(prefs.themeMode);
    setThemePromptOpen(false);
    setAppBackgroundSetting(prefs.backgroundSetting);
    setBackgroundSkin(prefs.backgroundSkin);
    setNotificationSettings(prefs.notificationSettings);
    setProState(prefs.proState);
    if (user) {
      writeLocalPreferences(user.uid, prefs);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPreferencesHydrated(false);
      return;
    }

    const loadStartedAt = performance.now();
    applyPreferencesSnapshot(readLocalPreferences(user.uid));
    setPreferencesHydrated(true);

    let cancelled = false;
    void loadPreferences(user).then((prefs) => {
      if (cancelled) return;
      applyPreferencesSnapshot(prefs);
      setPreferencesHydrated(true);
      console.info("[whelm:preferences] refresh complete", {
        uid: user.uid,
        synced: prefs.synced,
        durationMs: Math.round(performance.now() - loadStartedAt),
        message: prefs.message ?? "",
        online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
      });
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
      notificationSettings,
      proState,
    });
  }, [appBackgroundSetting, backgroundSkin, companionStyle, notificationSettings, persistPreferencesState, proState]);

  const applyBackgroundSetting = useCallback((nextSetting: PreferencesBackgroundSetting) => {
    if (!isPro && nextSetting.kind !== "default") {
      return;
    }

    void persistPreferencesState({
      companionStyle,
      themeMode,
      backgroundSetting: nextSetting,
      backgroundSkin,
      notificationSettings,
      proState,
    });
  }, [backgroundSkin, companionStyle, isPro, notificationSettings, persistPreferencesState, proState, themeMode]);

  const applyCompanionStyle = useCallback((nextStyle: PreferencesCompanionStyle) => {
    void persistPreferencesState({
      companionStyle: nextStyle,
      themeMode,
      backgroundSetting: appBackgroundSetting,
      backgroundSkin,
      notificationSettings,
      proState,
    });
  }, [appBackgroundSetting, backgroundSkin, notificationSettings, persistPreferencesState, proState, themeMode]);

  const updateBackgroundSkin = useCallback((nextSkin: PreferencesBackgroundSkin) => {
    if (!isPro) {
      return;
    }

    void persistPreferencesState({
      companionStyle,
      themeMode,
      backgroundSetting: appBackgroundSetting,
      backgroundSkin: nextSkin,
      notificationSettings,
      proState,
    });
  }, [appBackgroundSetting, companionStyle, isPro, notificationSettings, persistPreferencesState, proState, themeMode]);

  const applyNotificationSettings = useCallback((nextSettings: PreferencesNotificationSettings) => {
    void persistPreferencesState({
      companionStyle,
      themeMode,
      backgroundSetting: appBackgroundSetting,
      backgroundSkin,
      notificationSettings: nextSettings,
      proState,
    });
  }, [
    appBackgroundSetting,
    backgroundSkin,
    companionStyle,
    persistPreferencesState,
    proState,
    themeMode,
  ]);

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
    notificationSettings,
    effectiveBackgroundSetting,
    backgroundSkinActive,
    preferencesHydrated,
    setThemePromptOpen,
    applyPreferencesSnapshot,
    applyThemeMode,
    applyBackgroundSetting,
    applyCompanionStyle,
    updateBackgroundSkin,
    applyNotificationSettings,
    handleBackgroundUpload,
  };
}
