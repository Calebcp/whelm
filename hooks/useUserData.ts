"use client";

import type { User } from "firebase/auth";

import type {
  PreferencesState,
  PreferencesThemeMode,
  PreferencesCompanionStyle,
  PreferencesBackgroundSetting,
  PreferencesBackgroundSkin,
} from "@/lib/preferences-store";
import { getProfileTierTheme } from "@/lib/profile-tier";
import type { StreakBandanaTier } from "@/lib/streak-bandanas";

export type { PreferencesState };

type UseUserDataInput = {
  user: User | null;
  isPro: boolean;
  themeMode: PreferencesThemeMode;
  companionStyle: PreferencesCompanionStyle;
  appBackgroundSetting: PreferencesBackgroundSetting;
  backgroundSkin: PreferencesBackgroundSkin;
  streakBandanaTier: StreakBandanaTier | null;
};

/**
 * Derives display-ready user profile and preference values from raw state.
 * In Phase 3, this hook will own its own Firestore subscription.
 * For now it accepts state from page.tsx and computes derived values.
 */
export function useUserData({
  user,
  isPro,
  themeMode,
  companionStyle,
  appBackgroundSetting,
  backgroundSkin,
  streakBandanaTier,
}: UseUserDataInput) {
  const profileDisplayName =
    user?.displayName?.trim() ||
    user?.email?.split("@")[0]?.trim() ||
    "Whelm user";

  const currentUserPhotoUrl = user?.photoURL ?? null;
  const currentUserId = user?.uid ?? "current-user";

  const profileTierTheme = getProfileTierTheme(streakBandanaTier?.color, isPro);

  const preferences: PreferencesState = {
    themeMode,
    companionStyle,
    backgroundSetting: appBackgroundSetting,
    backgroundSkin,
  };

  return {
    profileDisplayName,
    currentUserPhotoUrl,
    currentUserId,
    profileTierTheme,
    preferences,
    isPro,
    tierColor: streakBandanaTier?.color ?? null,
  };
}
