"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { SavePlannedBlockInput } from "@/hooks/usePlannedBlocks";
import {
  readStoredTodayAlarms,
  type TodayAlarm,
  writeStoredTodayAlarms,
} from "@/lib/today-alarms";

export type TodayTool = "none" | "timer" | "block" | "alarm";

export type BlockDraft = {
  editingBlockId?: string | null;
  title: string;
  note: string;
  timeOfDay: string;
  endTimeOfDay: string;
  durationMinutes: number;
  dateKey: string;
};

export type TimerDraft = {
  minutes: number;
  label: string;
};

export type AlarmItem = TodayAlarm;

export type AlarmDraft = {
  id?: string | null;
  timeOfDay: string;
  label: string;
  enabled: boolean;
  mode: "soft" | "hard";
  linkedBlockId?: string | null;
  linkedBlockTitle?: string;
  linkedDateKey?: string;
  linkedBlockDurationMinutes?: number | null;
};

export type AlarmAttachableBlock = {
  id: string;
  title: string;
  dateKey: string;
  timeOfDay: string;
  durationMinutes: number;
};

export type TodayTimeHubState = {
  activeTool: TodayTool;
  isFullscreen: boolean;
  blockDraft: BlockDraft;
  timerDraft: TimerDraft;
  timerAutoStartToken: string | null;
  alarms: AlarmItem[];
  alarmDraft: AlarmDraft;
};

export type TodayTimeHubActions = {
  openTool: (tool: Exclude<TodayTool, "none">) => void;
  closeTool: () => void;
  setBlockDraft: (patch: Partial<BlockDraft>) => void;
  resetBlockDraft: (dateKey?: string) => void;
  saveBlock: () => boolean;
  setTimerDraft: (patch: Partial<TimerDraft>) => void;
  startTimer: () => void;
  setAlarmDraft: (patch: Partial<AlarmDraft>) => void;
  startNewAlarm: () => void;
  editAlarm: (id: string) => void;
  saveAlarm: () => void;
  deleteAlarm: (id: string) => void;
  toggleAlarm: (id: string) => void;
};

export type TodayTimeHub = {
  state: TodayTimeHubState;
  actions: TodayTimeHubActions;
};

export type TodayTimeHubRequest = {
  id: string;
  tool: Extract<TodayTool, "block" | "timer" | "alarm">;
  draft?: Partial<BlockDraft>;
  timerDraft?: Partial<TimerDraft>;
  autoStart?: boolean;
  alarmId?: string;
};

type UseTodayTimeHubOptions = {
  liveTodayKey: string;
  savePlannedBlock: (input: SavePlannedBlockInput) => boolean;
  onOpenScheduleDay: (dateKey: string) => void;
  onStartTimerSession?: (minutes: number, label: string) => void;
  attachableBlocks?: AlarmAttachableBlock[];
  externalRequest?: TodayTimeHubRequest | null;
  onConsumeExternalRequest?: (id: string) => void;
};

function createInitialBlockDraft(dateKey: string): BlockDraft {
  return {
    editingBlockId: null,
    title: "",
    note: "",
    timeOfDay: "09:00",
    endTimeOfDay: "09:25",
    durationMinutes: 25,
    dateKey,
  };
}

function parseTimeToMinutes(timeOfDay: string) {
  const [hours, minutes] = timeOfDay.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 9 * 60;
  return Math.min(24 * 60 - 1, Math.max(0, hours * 60 + minutes));
}

function minutesToTimeOfDay(totalMinutes: number) {
  const clamped = Math.min(24 * 60 - 1, Math.max(0, totalMinutes));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function computeEndTime(startTimeOfDay: string, durationMinutes: number) {
  return minutesToTimeOfDay(parseTimeToMinutes(startTimeOfDay) + Math.max(15, durationMinutes));
}

function computeDurationMinutes(startTimeOfDay: string, endTimeOfDay: string) {
  const startMinutes = parseTimeToMinutes(startTimeOfDay);
  const endMinutes = parseTimeToMinutes(endTimeOfDay);
  return Math.min(240, Math.max(15, endMinutes - startMinutes));
}

function createInitialAlarmDraft(): AlarmDraft {
  return {
    id: null,
    timeOfDay: "07:00",
    label: "",
    enabled: true,
    mode: "soft",
    linkedBlockId: null,
    linkedBlockTitle: "",
    linkedDateKey: "",
    linkedBlockDurationMinutes: null,
  };
}

export function useTodayTimeHub({
  liveTodayKey,
  savePlannedBlock,
  onOpenScheduleDay,
  onStartTimerSession,
  attachableBlocks = [],
  externalRequest,
  onConsumeExternalRequest,
}: UseTodayTimeHubOptions): TodayTimeHub {
  const [activeTool, setActiveTool] = useState<TodayTool>("none");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [blockDraft, setBlockDraftState] = useState<BlockDraft>(() => createInitialBlockDraft(liveTodayKey));
  const [timerDraft, setTimerDraftState] = useState<TimerDraft>({ minutes: 30, label: "Focus timer" });
  const [timerAutoStartToken, setTimerAutoStartToken] = useState<string | null>(null);
  const [alarms, setAlarms] = useState<AlarmItem[]>(() => readStoredTodayAlarms());
  const [alarmDraft, setAlarmDraftState] = useState<AlarmDraft>(() => createInitialAlarmDraft());

  const openTool = useCallback((tool: Exclude<TodayTool, "none">) => {
    setActiveTool(tool);
    setIsFullscreen(true);
    if (tool === "block") {
      setBlockDraftState((current) =>
        current.dateKey === liveTodayKey ? current : { ...current, dateKey: liveTodayKey },
      );
    }
  }, [liveTodayKey]);

  const closeTool = useCallback(() => {
    setActiveTool("none");
    setIsFullscreen(false);
    setTimerAutoStartToken(null);
  }, []);

  const setBlockDraft = useCallback((patch: Partial<BlockDraft>) => {
    setBlockDraftState((current) => {
      const next = { ...current, ...patch };

      if ("timeOfDay" in patch && !("endTimeOfDay" in patch) && !("durationMinutes" in patch)) {
        return {
          ...next,
          endTimeOfDay: computeEndTime(next.timeOfDay, next.durationMinutes),
        };
      }

      if ("endTimeOfDay" in patch && !("durationMinutes" in patch)) {
        return {
          ...next,
          durationMinutes: computeDurationMinutes(next.timeOfDay, next.endTimeOfDay),
        };
      }

      if ("durationMinutes" in patch && !("endTimeOfDay" in patch)) {
        return {
          ...next,
          endTimeOfDay: computeEndTime(next.timeOfDay, next.durationMinutes),
        };
      }

      return next;
    });
  }, []);

  const resetBlockDraft = useCallback((dateKey?: string) => {
    setBlockDraftState(createInitialBlockDraft(dateKey ?? liveTodayKey));
  }, [liveTodayKey]);

  const saveBlock = useCallback(() => {
    const durationMinutes = computeDurationMinutes(blockDraft.timeOfDay, blockDraft.endTimeOfDay);
    const saved = savePlannedBlock({
      id: blockDraft.editingBlockId ?? undefined,
      dateKey: blockDraft.dateKey,
      title: blockDraft.title,
      note: blockDraft.note,
      timeOfDay: blockDraft.timeOfDay,
      durationMinutes,
    });
    if (!saved) return false;
    closeTool();
    onOpenScheduleDay(blockDraft.dateKey);
    resetBlockDraft(blockDraft.dateKey);
    return true;
  }, [blockDraft, closeTool, onOpenScheduleDay, resetBlockDraft, savePlannedBlock]);

  const setTimerDraft = useCallback((patch: Partial<TimerDraft>) => {
    setTimerDraftState((current) => ({ ...current, ...patch }));
  }, []);

  const startTimer = useCallback(() => {
    onStartTimerSession?.(timerDraft.minutes, timerDraft.label);
    closeTool();
  }, [closeTool, onStartTimerSession, timerDraft.label, timerDraft.minutes]);

  const setAlarmDraft = useCallback((patch: Partial<AlarmDraft>) => {
    setAlarmDraftState((current) => ({ ...current, ...patch }));
  }, []);

  const startNewAlarm = useCallback(() => {
    setAlarmDraftState(createInitialAlarmDraft());
  }, []);

  const editAlarm = useCallback((id: string) => {
    const existing = alarms.find((item) => item.id === id);
    if (!existing) return;
    setAlarmDraftState({
      id: existing.id,
      timeOfDay: existing.timeOfDay,
      label: existing.label,
      enabled: existing.enabled,
      mode: existing.mode === "hard" ? "hard" : "soft",
      linkedBlockId: existing.linkedBlockId ?? null,
      linkedBlockTitle: existing.linkedBlockTitle ?? "",
      linkedDateKey: existing.linkedDateKey ?? "",
      linkedBlockDurationMinutes: existing.linkedBlockDurationMinutes ?? null,
    });
  }, [alarms]);

  const saveAlarm = useCallback(() => {
    const nextLabel = alarmDraft.label.trim();
    const nextTime = alarmDraft.timeOfDay || "07:00";
    const nextItem: AlarmItem = {
      id: alarmDraft.id ?? (typeof crypto !== "undefined" ? crypto.randomUUID() : `alarm-${Date.now()}`),
      timeOfDay: nextTime,
      label: nextLabel,
      enabled: alarmDraft.enabled,
      mode: alarmDraft.mode,
      linkedBlockId: alarmDraft.linkedBlockId ?? undefined,
      linkedBlockTitle: alarmDraft.linkedBlockTitle?.trim() || undefined,
      linkedDateKey: alarmDraft.linkedDateKey || undefined,
      linkedBlockDurationMinutes:
        typeof alarmDraft.linkedBlockDurationMinutes === "number" &&
        Number.isFinite(alarmDraft.linkedBlockDurationMinutes)
          ? alarmDraft.linkedBlockDurationMinutes
          : undefined,
    };
    setAlarms((current) => {
      const updated = current.some((item) => item.id === nextItem.id)
        ? current.map((item) => (item.id === nextItem.id ? nextItem : item))
        : [...current, nextItem];
      writeStoredTodayAlarms(updated);
      return readStoredTodayAlarms();
    });
    setAlarmDraftState(createInitialAlarmDraft());
  }, [alarmDraft]);

  const deleteAlarm = useCallback((id: string) => {
    setAlarms((current) => {
      const updated = current.filter((item) => item.id !== id);
      writeStoredTodayAlarms(updated);
      return updated;
    });
    setAlarmDraftState((current) => (current.id === id ? createInitialAlarmDraft() : current));
  }, []);

  const toggleAlarm = useCallback((id: string) => {
    setAlarms((current) => {
      const updated = current.map((item) => (
        item.id === id ? { ...item, enabled: !item.enabled } : item
      ));
      writeStoredTodayAlarms(updated);
      return readStoredTodayAlarms();
    });
  }, []);

  useEffect(() => {
    if (!alarmDraft.linkedBlockId) return;
    const linkedBlock = attachableBlocks.find((item) => item.id === alarmDraft.linkedBlockId);
    if (!linkedBlock) return;
    setAlarmDraftState((current) => ({
      ...current,
      linkedBlockTitle: linkedBlock.title,
      linkedDateKey: linkedBlock.dateKey,
      linkedBlockDurationMinutes: linkedBlock.durationMinutes,
      timeOfDay: linkedBlock.timeOfDay,
    }));
  }, [alarmDraft.linkedBlockId, attachableBlocks]);

  useEffect(() => {
    if (!externalRequest) return;
    if (externalRequest.tool === "block") {
      setBlockDraftState((current) => {
        const next = {
          ...createInitialBlockDraft(liveTodayKey),
          ...current,
          ...externalRequest.draft,
          dateKey: externalRequest.draft?.dateKey ?? liveTodayKey,
        };
        return {
          ...next,
          endTimeOfDay: computeEndTime(
            next.timeOfDay,
            externalRequest.draft?.durationMinutes ?? next.durationMinutes,
          ),
        };
      });
      setActiveTool("block");
      setIsFullscreen(true);
      setTimerAutoStartToken(null);
    } else if (externalRequest.tool === "timer") {
      setTimerDraftState((current) => ({
        ...current,
        ...externalRequest.timerDraft,
      }));
      setActiveTool("timer");
      setIsFullscreen(true);
      setTimerAutoStartToken(externalRequest.autoStart ? externalRequest.id : null);
    } else if (externalRequest.tool === "alarm") {
      if (externalRequest.alarmId) {
        const existing = alarms.find((item) => item.id === externalRequest.alarmId);
        if (existing) {
          setAlarmDraftState({
            id: existing.id,
            timeOfDay: existing.timeOfDay,
            label: existing.label,
            enabled: existing.enabled,
            mode: existing.mode === "hard" ? "hard" : "soft",
            linkedBlockId: existing.linkedBlockId ?? null,
            linkedBlockTitle: existing.linkedBlockTitle ?? "",
            linkedDateKey: existing.linkedDateKey ?? "",
            linkedBlockDurationMinutes: existing.linkedBlockDurationMinutes ?? null,
          });
        }
      }
      setActiveTool("alarm");
      setIsFullscreen(true);
      setTimerAutoStartToken(null);
    }
    onConsumeExternalRequest?.(externalRequest.id);
  }, [alarms, externalRequest, liveTodayKey, onConsumeExternalRequest]);

  return useMemo(
    () => ({
      state: {
        activeTool,
        isFullscreen,
        blockDraft,
        timerDraft,
        timerAutoStartToken,
        alarms,
        alarmDraft,
      },
      actions: {
        openTool,
        closeTool,
        setBlockDraft,
        resetBlockDraft,
        saveBlock,
        setTimerDraft,
        startTimer,
        setAlarmDraft,
        startNewAlarm,
        editAlarm,
        saveAlarm,
        deleteAlarm,
        toggleAlarm,
      },
    }),
    [
      activeTool,
      alarmDraft,
      alarms,
      blockDraft,
      closeTool,
      deleteAlarm,
      editAlarm,
      isFullscreen,
      openTool,
      resetBlockDraft,
      saveAlarm,
      saveBlock,
      setAlarmDraft,
      setBlockDraft,
      setTimerDraft,
      startNewAlarm,
      startTimer,
      timerAutoStartToken,
      timerDraft,
      toggleAlarm,
    ],
  );
}
