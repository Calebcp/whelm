"use client";

import { memo } from "react";

import TodayTab from "@/components/TodayTab";
import { useTodayTimeHub, type TodayTimeHubRequest } from "@/hooks/useTodayTimeHub";
import {
  type TodayShellHandlers,
  type TodayShellRefs,
  type TodayShellState,
  useTodayShellViewModel,
} from "@/hooks/useTodayShellViewModel";
import type { AppTab } from "@/lib/app-tabs";

type HomeTodayContainerProps = {
  refs: TodayShellRefs;
  state: TodayShellState;
  handlers: TodayShellHandlers;
  getTabTitle: (tab: AppTab) => string;
  timeHubRequest: TodayTimeHubRequest | null;
  onConsumeTimeHubRequest: (id: string) => void;
};

const HomeTodayContainer = memo(function HomeTodayContainer({
  refs,
  state,
  handlers,
  getTabTitle,
  timeHubRequest,
  onConsumeTimeHubRequest,
}: HomeTodayContainerProps) {
  const todayTabProps = useTodayShellViewModel({
    refs,
    state,
    handlers,
    getTabTitle,
  });

  const timeHub = useTodayTimeHub({
    liveTodayKey: state.liveTodayKey,
    savePlannedBlock: handlers.onSavePlannedBlock,
    onOpenScheduleDay: handlers.onOpenScheduleDay,
    attachableBlocks: state.attachableAlarmBlocks,
    externalRequest: timeHubRequest,
    onConsumeExternalRequest: onConsumeTimeHubRequest,
  });

  return <TodayTab {...todayTabProps} timeHub={timeHub} />;
});

export default HomeTodayContainer;
