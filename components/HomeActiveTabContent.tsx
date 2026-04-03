"use client";

import { type ComponentProps } from "react";

import HistoryTab from "@/components/HistoryTab";
import HomeNotesContainer from "@/components/HomeNotesContainer";
import HomeTodayContainer from "@/components/HomeTodayContainer";
import MirrorTab from "@/components/MirrorTab";
import ReportsTab from "@/components/ReportsTab";
import HomeScheduleContainer from "@/components/HomeScheduleContainer";
import SettingsTab from "@/components/SettingsTab";
import StreaksTab from "@/components/StreaksTab";
import WhelmboardTab from "@/components/WhelmboardTab";
import type { AppTab } from "@/lib/app-tabs";

type HomeActiveTabContentProps = {
  activeTab: AppTab;
  todayContainerProps: ComponentProps<typeof HomeTodayContainer>;
  scheduleContainerProps: ComponentProps<typeof HomeScheduleContainer>;
  leaderboardTabProps: ComponentProps<typeof WhelmboardTab>;
  mirrorTabProps: ComponentProps<typeof MirrorTab>;
  notesContainerProps: ComponentProps<typeof HomeNotesContainer>;
  historyTabProps: ComponentProps<typeof HistoryTab>;
  reportsTabProps: ComponentProps<typeof ReportsTab>;
  streaksTabProps: ComponentProps<typeof StreaksTab>;
  settingsTabProps: ComponentProps<typeof SettingsTab>;
};

export default function HomeActiveTabContent({
  activeTab,
  todayContainerProps,
  scheduleContainerProps,
  leaderboardTabProps,
  mirrorTabProps,
  notesContainerProps,
  historyTabProps,
  reportsTabProps,
  streaksTabProps,
  settingsTabProps,
}: HomeActiveTabContentProps) {
  if (activeTab === "today") {
    return <HomeTodayContainer {...todayContainerProps} />;
  }

  if (activeTab === "calendar") {
    return <HomeScheduleContainer {...scheduleContainerProps} />;
  }

  if (activeTab === "leaderboard") {
    return <WhelmboardTab {...leaderboardTabProps} />;
  }

  if (activeTab === "mirror") {
    return <MirrorTab {...mirrorTabProps} />;
  }

  if (activeTab === "notes") {
    return <HomeNotesContainer {...notesContainerProps} />;
  }

  if (activeTab === "history") {
    return <HistoryTab {...historyTabProps} />;
  }

  if (activeTab === "reports") {
    return <ReportsTab {...reportsTabProps} />;
  }

  if (activeTab === "streaks") {
    return <StreaksTab {...streaksTabProps} />;
  }

  if (activeTab === "settings") {
    return <SettingsTab {...settingsTabProps} />;
  }

  return null;
}
