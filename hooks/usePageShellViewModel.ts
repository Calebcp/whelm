"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";

import { dayKeyLocal } from "@/lib/date-utils";
import type { WorkspaceNote } from "@/lib/notes-store";
import type { SessionDoc } from "@/lib/streak";
import type { WhelmEmoteId } from "@/lib/whelm-emotes";

type TrendPoint = {
  label: string;
  minutes: number;
};

type PlannedBlockLike = {
  id: string;
  title: string;
  note: string;
  timeOfDay: string;
  durationMinutes: number;
  dateKey: string;
  sortOrder: number;
  createdAtISO: string;
  updatedAtISO: string;
  status: "active" | "completed" | "deleted";
  completedAtISO?: string;
  attachmentCount?: number;
  tone?: "Clear" | "Push" | "Deep" | "Sharp" | "Steady" | "Recover";
};

type BackgroundSkinLike = {
  surfaceOpacity: number;
  blur: number;
  mode: "solid" | "glass";
  dim: number;
  imageFit: "fill" | "fit";
};

type UsePageShellViewModelOptions = {
  trendPoints: TrendPoint[];
  streak: number;
  resolvedTheme: "light" | "dark";
  themeMode: "light" | "dark" | "system";
  effectiveBackgroundSetting: unknown;
  backgroundSkin: BackgroundSkinLike;
  backgroundSkinActive: boolean;
  activeTab: string;
  mobileMoreTabs: readonly string[];
  filteredNotes: WorkspaceNote[];
  sessions: SessionDoc[];
  todayKey: string;
  todayActivePlannedBlocks: PlannedBlockLike[];
  orderedNotes: WorkspaceNote[];
  streakBandanaColor?: string;
  isPro?: boolean;
  getPageShellBackgroundStyle: (
    themeMode: "light" | "dark",
    setting: any,
    skin: BackgroundSkinLike,
  ) => CSSProperties | undefined;
  getProfileTierTheme: (color?: string | null, isPro?: boolean) => { title: string; imagePath: string };
};

export function usePageShellViewModel({
  trendPoints,
  streak,
  resolvedTheme,
  themeMode,
  effectiveBackgroundSetting,
  backgroundSkin,
  backgroundSkinActive,
  activeTab,
  mobileMoreTabs,
  filteredNotes,
  sessions,
  todayKey,
  todayActivePlannedBlocks,
  orderedNotes,
  streakBandanaColor,
  isPro,
  getPageShellBackgroundStyle,
  getProfileTierTheme,
}: UsePageShellViewModelOptions) {
  const maxTrendMinutes = Math.max(30, ...trendPoints.map((point) => point.minutes));

  const trendPath = useMemo(
    () =>
      trendPoints
        .map((point, index) => {
          const x = (index / Math.max(1, trendPoints.length - 1)) * 100;
          const y = 100 - (point.minutes / maxTrendMinutes) * 100;
          return `${x},${y}`;
        })
        .join(" "),
    [maxTrendMinutes, trendPoints],
  );

  const streakHeroEmoteId: WhelmEmoteId =
    streak >= 100 ? "whelm.proud" : streak >= 50 ? "whelm.ready" : "whelm.encourage";

  const pageShellBackgroundStyle = getPageShellBackgroundStyle(
    resolvedTheme,
    effectiveBackgroundSetting,
    backgroundSkin,
  );

  const pageShellStyle = useMemo(
    () =>
      ({
        ...pageShellBackgroundStyle,
        ...(backgroundSkinActive
          ? {
              ["--glass-surface-opacity" as const]: String(backgroundSkin.surfaceOpacity),
              ["--glass-surface-opacity-strong" as const]: String(
                Math.min(0.99, backgroundSkin.surfaceOpacity + 0.08),
              ),
              ["--glass-blur" as const]: `${backgroundSkin.blur}px`,
              ["--glass-border-alpha" as const]: themeMode === "light" ? "0.18" : "0.24",
              ["--glass-highlight-alpha" as const]: themeMode === "light" ? "0.5" : "0.08",
              ["--glass-shadow-alpha" as const]: themeMode === "light" ? "0.16" : "0.34",
            }
          : {}),
      }) as CSSProperties,
    [backgroundSkin, backgroundSkinActive, pageShellBackgroundStyle, themeMode],
  );

  const lastSession = sessions[0];
  const latestNote = orderedNotes[0] ?? null;
  const nextPlannedBlock = todayActivePlannedBlocks[0] ?? null;
  const mobileMoreActive = mobileMoreTabs.includes(activeTab);
  const recentNotes = filteredNotes.slice(0, 4);
  const todaySessionNoteCount = sessions.filter((session) => {
    return dayKeyLocal(session.completedAtISO) === todayKey && Boolean(session.note?.trim());
  }).length;
  const profileTierTheme = getProfileTierTheme(streakBandanaColor, isPro);
  const lifetimeFocusMinutes = sessions.reduce((sum, session) => sum + session.minutes, 0);

  return {
    trendPath,
    streakHeroEmoteId,
    pageShellStyle,
    lastSession,
    latestNote,
    nextPlannedBlock,
    mobileMoreActive,
    recentNotes,
    todaySessionNoteCount,
    profileTierTheme,
    lifetimeFocusMinutes,
  };
}
