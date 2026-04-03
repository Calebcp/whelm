"use client";

import { memo } from "react";

import ScheduleTab from "@/components/ScheduleTab";
import {
  type ScheduleShellHandlers,
  type ScheduleShellRefs,
  type ScheduleShellState,
  useScheduleShellViewModel,
} from "@/hooks/useScheduleShellViewModel";

type HomeScheduleContainerProps = {
  refs: ScheduleShellRefs;
  state: ScheduleShellState;
  handlers: ScheduleShellHandlers;
};

const HomeScheduleContainer = memo(function HomeScheduleContainer({
  refs,
  state,
  handlers,
}: HomeScheduleContainerProps) {
  const scheduleTabProps = useScheduleShellViewModel({
    refs,
    state,
    handlers,
  });

  return <ScheduleTab {...scheduleTabProps} />;
});

export default HomeScheduleContainer;
