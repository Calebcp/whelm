"use client";

import { memo } from "react";

import TodayTab from "@/components/TodayTab";
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
};

const HomeTodayContainer = memo(function HomeTodayContainer({
  refs,
  state,
  handlers,
  getTabTitle,
}: HomeTodayContainerProps) {
  const todayTabProps = useTodayShellViewModel({
    refs,
    state,
    handlers,
    getTabTitle,
  });

  return <TodayTab {...todayTabProps} />;
});

export default HomeTodayContainer;
