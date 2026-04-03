"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import {
  loadPlannedBlocks as loadSyncedPlannedBlocks,
  mergeBlocksPreferNewest,
  readLocalBlocks,
  savePlannedBlocks as saveSyncedPlannedBlocks,
  savePlannedBlocksLocally,
} from "@/lib/planned-blocks-store";
import { dayKeyLocal } from "@/lib/date-utils";

const MIN_PLANNED_BLOCK_MINUTES = 15;
const MAX_PLANNED_BLOCK_MINUTES = 240;
const MIN_PLANNED_BLOCK_GAP_MINUTES = 10;

export type CalendarTone = "Clear" | "Push" | "Deep" | "Sharp" | "Steady" | "Recover";

export type PlannedBlock = {
  id: string;
  dateKey: string;
  title: string;
  note: string;
  attachmentCount?: number;
  tone?: CalendarTone;
  durationMinutes: number;
  timeOfDay: string;
  sortOrder: number;
  createdAtISO: string;
  updatedAtISO: string;
  status: "active" | "completed" | "deleted";
  completedAtISO?: string;
};

export type DailyRitualBlockDraft = {
  id: string;
  existingBlockId?: string;
  title: string;
  note: string;
  tone: CalendarTone | null;
  timeOfDay: string;
  durationMinutes: number;
};

type PlannerSectionsOpen = {
  active: boolean;
  completed: boolean;
  incomplete: boolean;
};

type UsePlannedBlocksOptions = {
  isPro: boolean;
  liveTodayKey: string;
  showToast: (message: string, tone?: "success" | "warning" | "error" | "info") => void;
  onNavigateToCalendarDay?: () => void;
  onTrackTaskCreated?: (block: PlannedBlock, source: "manual" | "daily_ritual") => void;
};

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function plannedBlocksStorageKey(uid: string) {
  return `whelm:planned-focus:${uid}`;
}

function dailyPlanningPromptSeenStorageKey(uid: string, dateKey: string) {
  return `whelm:daily-planning-prompt-seen:${uid}:${dateKey}`;
}

function readDailyPlanningPromptSeen(uid: string, dateKey: string) {
  try {
    return window.localStorage.getItem(dailyPlanningPromptSeenStorageKey(uid, dateKey)) === "1";
  } catch {
    return false;
  }
}

function markDailyPlanningPromptSeen(uid: string, dateKey: string) {
  try {
    window.localStorage.setItem(dailyPlanningPromptSeenStorageKey(uid, dateKey), "1");
  } catch {
    // Ignore storage failures in private / constrained webviews.
  }
}

function parseTimeToMinutes(raw: string) {
  const [hh, mm] = raw.split(":").map((part) => Number(part));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 9 * 60;
  return Math.min(24 * 60 - 1, Math.max(0, hh * 60 + mm));
}

function getPlannedBlockDurationError(minutes: number) {
  if (!Number.isFinite(minutes)) {
    return "Enter a real duration in minutes.";
  }
  if (minutes < MIN_PLANNED_BLOCK_MINUTES) {
    return `Blocks must be at least ${MIN_PLANNED_BLOCK_MINUTES} minutes.`;
  }
  if (minutes > MAX_PLANNED_BLOCK_MINUTES) {
    return `Keep blocks at ${MAX_PLANNED_BLOCK_MINUTES} minutes or less.`;
  }
  return null;
}

function normalizeTimeLabel(raw: string) {
  if (!raw) return "Any time";
  const parsed = new Date(`2000-01-01T${raw}:00`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function buildBlockSpacingMessage(conflicts: PlannedBlock[]) {
  if (conflicts.length === 0) return "";
  if (conflicts.length === 1) {
    const block = conflicts[0];
    return `Blocks need at least ${MIN_PLANNED_BLOCK_GAP_MINUTES} minutes between them. This is too close to "${block?.title}" at ${normalizeTimeLabel(block?.timeOfDay || "09:00")}.`;
  }
  return `Blocks need at least ${MIN_PLANNED_BLOCK_GAP_MINUTES} minutes between them. This placement is too close to ${conflicts.length} existing blocks.`;
}

function findPlanSpacingConflicts(
  items: PlannedBlock[],
  candidate: {
    dateKey: string;
    timeOfDay: string;
    durationMinutes: number;
    excludeId?: string;
  },
) {
  const nextStartMinute = parseTimeToMinutes(candidate.timeOfDay || "09:00");
  const nextEndMinute = Math.min(
    24 * 60,
    nextStartMinute + Math.max(MIN_PLANNED_BLOCK_MINUTES, candidate.durationMinutes),
  );

  return items.filter((item) => {
    if (item.id === candidate.excludeId) return false;
    if (item.dateKey !== candidate.dateKey) return false;
    if (item.status !== "active") return false;
    const startMinute = parseTimeToMinutes(item.timeOfDay || "09:00");
    const endMinute = Math.min(
      24 * 60,
      startMinute + Math.max(MIN_PLANNED_BLOCK_MINUTES, item.durationMinutes),
    );
    return (
      nextStartMinute < endMinute + MIN_PLANNED_BLOCK_GAP_MINUTES &&
      nextEndMinute + MIN_PLANNED_BLOCK_GAP_MINUTES > startMinute
    );
  });
}

function isDateKeyBeforeToday(dateKey: string) {
  return dateKey < dayKeyLocal(new Date());
}

function normalizePlannableDateKey(dateKey: string) {
  return isDateKeyBeforeToday(dateKey) ? dayKeyLocal(new Date()) : dateKey;
}

function blocksMatch(a: PlannedBlock[], b: PlannedBlock[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function dailyRitualDraftsMatch(a: DailyRitualBlockDraft[], b: DailyRitualBlockDraft[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function createDailyRitualDrafts(existing: PlannedBlock[]): DailyRitualBlockDraft[] {
  const seeded: DailyRitualBlockDraft[] = existing.slice(0, 3).map((item, index) => ({
    id: `existing-${item.id}-${index}`,
    existingBlockId: item.id,
    title: item.title,
    note: item.note,
    tone: item.tone ?? null,
    timeOfDay: item.timeOfDay,
    durationMinutes: item.durationMinutes,
  }));

  while (seeded.length < 3) {
    const nextIndex = seeded.length;
    seeded.push({
      id: `new-${nextIndex}`,
      title: "",
      note: "",
      tone: null,
      timeOfDay: ["09:00", "13:00", "17:00"][nextIndex] || "09:00",
      durationMinutes: 30,
    });
  }

  return seeded;
}

function syncDailyRitualDrafts(existing: PlannedBlock[], current: DailyRitualBlockDraft[]) {
  const synced: DailyRitualBlockDraft[] = existing.slice(0, 3).map((item, index) => ({
    id: `existing-${item.id}-${index}`,
    existingBlockId: item.id,
    title: item.title,
    note: item.note,
    tone: item.tone ?? null,
    timeOfDay: item.timeOfDay,
    durationMinutes: item.durationMinutes,
  }));

  const openDrafts = current
    .filter((draft) => !draft.existingBlockId)
    .map((draft) => ({
      ...draft,
      id: draft.id.startsWith("new-") ? draft.id : `new-${draft.id}`,
    }));

  while (synced.length < 3 && openDrafts.length > 0) {
    const nextIndex = synced.length;
    const nextDraft = openDrafts.shift()!;
    synced.push({ ...nextDraft, id: `new-${nextIndex}` });
  }

  while (synced.length < 3) {
    const nextIndex = synced.length;
    synced.push({
      id: `new-${nextIndex}`,
      title: "",
      note: "",
      tone: null,
      timeOfDay: ["09:00", "13:00", "17:00"][nextIndex] || "09:00",
      durationMinutes: 30,
    });
  }

  return synced;
}

export function usePlannedBlocks({
  isPro,
  liveTodayKey,
  showToast,
  onNavigateToCalendarDay,
  onTrackTaskCreated,
}: UsePlannedBlocksOptions) {
  const [plannedBlocks, setPlannedBlocks] = useState<PlannedBlock[]>([]);
  const [plannedBlocksHydrated, setPlannedBlocksHydrated] = useState(false);
  const [dailyPlanningOpen, setDailyPlanningOpen] = useState(false);
  const [dailyPlanningStatus, setDailyPlanningStatus] = useState("");
  const [dailyPlanningPromptSeenToday, setDailyPlanningPromptSeenToday] = useState<boolean | null>(null);
  const [dailyRitualDrafts, setDailyRitualDrafts] = useState<DailyRitualBlockDraft[]>(() =>
    createDailyRitualDrafts([]),
  );
  const [dailyRitualExpandedId, setDailyRitualExpandedId] = useState<string | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [calendarCursor, setCalendarCursor] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarHoverEntryId, setCalendarHoverEntryId] = useState<string | null>(null);
  const [calendarPinnedEntryId, setCalendarPinnedEntryId] = useState<string | null>(null);
  const [calendarAuxPanel, setCalendarAuxPanel] = useState<"agenda" | "streak" | "guide">("agenda");
  const [planTitle, setPlanTitle] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [planAttachmentCount, setPlanAttachmentCount] = useState(0);
  const [planNoteExpanded, setPlanNoteExpanded] = useState(false);
  const [planTone, setPlanTone] = useState<CalendarTone | null>(null);
  const [planDuration, setPlanDuration] = useState(25);
  const [planTime, setPlanTime] = useState("09:00");
  const [planStatus, setPlanStatus] = useState("");
  const [editingPlannedBlockId, setEditingPlannedBlockId] = useState<string | null>(null);
  const [planConflictWarning, setPlanConflictWarning] = useState<{
    conflictIds: string[];
    message: string;
  } | null>(null);
  const [calendarJumpDate, setCalendarJumpDate] = useState<string>(() => dayKeyLocal(new Date()));
  const [draggedPlanId, setDraggedPlanId] = useState<string | null>(null);
  const [pendingCalendarEntryFocusId, setPendingCalendarEntryFocusId] = useState<string | null>(null);
  const [activatedCalendarEntryId, setActivatedCalendarEntryId] = useState<string | null>(null);
  const [overlapPickerEntryId, setOverlapPickerEntryId] = useState<string | null>(null);
  const [dayPortalComposerOpen, setDayPortalComposerOpen] = useState(false);
  const [selectedPlanDetailId, setSelectedPlanDetailId] = useState<string | null>(null);
  const [plannerSectionsOpen, setPlannerSectionsOpen] = useState<PlannerSectionsOpen>({
    active: false,
    completed: false,
    incomplete: false,
  });
  const [deletedPlanUndo, setDeletedPlanUndo] = useState<PlannedBlock | null>(null);
  const [dailyPlanningPreviewOpen, setDailyPlanningPreviewOpen] = useState(false);
  const [mobileBlockSheetOpen, setMobileBlockSheetOpen] = useState(false);
  const [mobileCalendarControlsOpen, setMobileCalendarControlsOpen] = useState(false);
  const [mobileAgendaEntriesOpen, setMobileAgendaEntriesOpen] = useState(false);
  const plannedBlocksRef = useRef<PlannedBlock[]>([]);
  const blocksSyncInFlightRef = useRef(false);
  const pendingDeletedPlanIdsRef = useRef<Set<string>>(new Set());

  const completedBlocksByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const block of plannedBlocks) {
      if (block.status !== "completed") continue;
      map.set(block.dateKey, (map.get(block.dateKey) ?? 0) + 1);
    }
    return map;
  }, [plannedBlocks]);

  const todayPlannedBlocks = useMemo(
    () => plannedBlocks.filter((item) => item.dateKey === dayKeyLocal(new Date()) && item.status !== "deleted"),
    [plannedBlocks],
  );
  const todayActivePlannedBlocks = useMemo(
    () => todayPlannedBlocks.filter((item) => item.status === "active"),
    [todayPlannedBlocks],
  );
  const claimedBlocksToday = useMemo(
    () => todayPlannedBlocks.filter((item) => item.durationMinutes >= 15),
    [todayPlannedBlocks],
  );
  const dailyPlanningLocked = plannedBlocksHydrated && claimedBlocksToday.length < 3;

  const selectedDateKey = selectedCalendarDate || dayKeyLocal(new Date());
  const selectedDateCanAddBlocks = !isDateKeyBeforeToday(selectedDateKey);
  const selectedDatePlans = useMemo(
    () =>
      plannedBlocks
        .filter((item) => item.dateKey === selectedDateKey && item.status === "active" && !isDateKeyBeforeToday(item.dateKey))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.timeOfDay.localeCompare(b.timeOfDay)),
    [plannedBlocks, selectedDateKey],
  );

  useEffect(() => {
    plannedBlocksRef.current = plannedBlocks;
  }, [plannedBlocks]);

  useEffect(() => {
    if (!auth.currentUser) {
      setDailyPlanningPromptSeenToday((current) => (current === null ? current : null));
      return;
    }
    const nextSeen = readDailyPlanningPromptSeen(auth.currentUser.uid, liveTodayKey);
    setDailyPlanningPromptSeenToday((current) => (current === nextSeen ? current : nextSeen));
  }, [liveTodayKey]);

  useEffect(() => {
    if (!auth.currentUser || !plannedBlocksHydrated || dailyPlanningPromptSeenToday === null) return;
    setDailyRitualDrafts((current) => {
      const next = syncDailyRitualDrafts(claimedBlocksToday, current);
      return dailyRitualDraftsMatch(current, next) ? current : next;
    });
    setDailyPlanningStatus((current) => (current === "" ? current : ""));
    if (claimedBlocksToday.length < 3 && !dailyPlanningPromptSeenToday) {
      markDailyPlanningPromptSeen(auth.currentUser.uid, liveTodayKey);
      setDailyPlanningPromptSeenToday(true);
      setDailyPlanningOpen(true);
      setSelectedCalendarDate(liveTodayKey);
      onNavigateToCalendarDay?.();
    } else if (claimedBlocksToday.length >= 3) {
      setDailyPlanningOpen(false);
    }
  }, [
    claimedBlocksToday,
    dailyPlanningPromptSeenToday,
    liveTodayKey,
    onNavigateToCalendarDay,
    plannedBlocksHydrated,
  ]);

  useEffect(() => {
    setPlanTone(null);
    setPlanAttachmentCount(0);
  }, [selectedDateKey]);

  useEffect(() => {
    setCalendarJumpDate(selectedDateKey);
  }, [selectedDateKey]);

  useEffect(() => {
    setPlanConflictWarning(null);
  }, [planDuration, planTime, planTitle, planNote, selectedDateKey]);

  useEffect(() => {
    if (dailyRitualDrafts.length === 0) {
      setDailyRitualExpandedId(null);
      return;
    }
    setDailyRitualExpandedId((current) => {
      if (current && dailyRitualDrafts.some((draft) => draft.id === current)) return current;
      const firstOpen = dailyRitualDrafts.find((draft) => !draft.existingBlockId)?.id;
      return firstOpen ?? dailyRitualDrafts[0]?.id ?? null;
    });
  }, [dailyRitualDrafts]);

  const handleBlocksSnapshot = useCallback((blocks: PlannedBlock[]) => {
    const currentUser = auth.currentUser;
    const uid = currentUser?.uid;
    const localBlocks = uid ? readLocalBlocks(uid) : [];
    const newestLocalBlocks = mergeBlocksPreferNewest(localBlocks, plannedBlocksRef.current);
    const pendingDeletedIds = pendingDeletedPlanIdsRef.current;
    const filteredRemoteBlocks = blocks.filter((block) => {
      if (!pendingDeletedIds.has(block.id)) return true;
      return newestLocalBlocks.some((localBlock) => localBlock.id === block.id);
    });
    for (const blockId of [...pendingDeletedIds]) {
      if (!blocks.some((block) => block.id === blockId)) {
        pendingDeletedIds.delete(blockId);
      }
    }
    const mergedBlocks = mergeBlocksPreferNewest(newestLocalBlocks, filteredRemoteBlocks) as PlannedBlock[];
    const remoteWasStale = !blocksMatch(mergedBlocks, filteredRemoteBlocks);
    const mergedMatchesCurrent = blocksMatch(mergedBlocks, plannedBlocksRef.current);

    if (!mergedMatchesCurrent) {
      plannedBlocksRef.current = mergedBlocks;
      setPlannedBlocks(mergedBlocks);
    }
    setPlannedBlocksHydrated((current) => (current ? current : true));

    if (!uid) return;
    savePlannedBlocksLocally(uid, mergedBlocks);

    if (!currentUser || !remoteWasStale || blocksSyncInFlightRef.current) return;

    blocksSyncInFlightRef.current = true;
    void saveSyncedPlannedBlocks(currentUser, mergedBlocks).finally(() => {
      blocksSyncInFlightRef.current = false;
    });
  }, []);

  const handleUserSignedOut = useCallback(() => {
    plannedBlocksRef.current = [];
    pendingDeletedPlanIdsRef.current.clear();
    setPlannedBlocks([]);
    setPlannedBlocksHydrated((current) => (current ? false : current));
    setDailyPlanningOpen(false);
    setDailyPlanningStatus("");
    setDailyPlanningPromptSeenToday(null);
    setDailyRitualDrafts(createDailyRitualDrafts([]));
    setDailyRitualExpandedId(null);
    setSelectedCalendarDate(null);
    setPlanTitle("");
    setPlanNote("");
    setPlanAttachmentCount(0);
    setPlanNoteExpanded(false);
    setPlanTone(null);
    setPlanDuration(25);
    setPlanTime("09:00");
    setPlanStatus("");
    setEditingPlannedBlockId(null);
    setPlanConflictWarning(null);
    setDraggedPlanId(null);
    setPendingCalendarEntryFocusId(null);
    setActivatedCalendarEntryId(null);
    setOverlapPickerEntryId(null);
    setDayPortalComposerOpen(false);
    setSelectedPlanDetailId(null);
    setDeletedPlanUndo(null);
    setDailyPlanningPreviewOpen(false);
    setMobileBlockSheetOpen(false);
  }, []);

  const refreshPlannedBlocks = useCallback(async (uid: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== uid) {
      throw new Error("Your login session is missing. Sign in again.");
    }

    const refreshStartedAt = performance.now();
    const result = await loadSyncedPlannedBlocks(currentUser);
    console.info("[whelm:planned-blocks] refresh complete", {
      uid,
      blockCount: result.blocks.length,
      synced: result.synced,
      durationMs: Math.round(performance.now() - refreshStartedAt),
      message: result.message ?? "",
      online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
    });
    const syncedIds = new Set(result.blocks.map((block) => block.id));
    for (const blockId of [...pendingDeletedPlanIdsRef.current]) {
      if (!syncedIds.has(blockId)) {
        pendingDeletedPlanIdsRef.current.delete(blockId);
      }
    }
    plannedBlocksRef.current = result.blocks as PlannedBlock[];
    setPlannedBlocks(result.blocks as PlannedBlock[]);
    setPlannedBlocksHydrated((current) => (current ? current : true));
  }, []);

  const handleUserSignedIn = useCallback((uid: string) => {
    pendingDeletedPlanIdsRef.current.clear();
    try {
      const localBlocks = readLocalBlocks(uid) as PlannedBlock[];
      if (localBlocks.length > 0) {
        plannedBlocksRef.current = localBlocks;
        setPlannedBlocks(localBlocks);
        setPlannedBlocksHydrated((current) => (current ? current : true));
      }
    } catch {
      // Keep going; cloud refresh below is authoritative.
    }

    void refreshPlannedBlocks(uid).catch((error) => {
      console.warn("[whelm:planned-blocks] refresh failed after sign-in", {
        uid,
        message: error instanceof Error ? error.message : "Unknown error",
        online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
      });
      // Preserve locally seeded blocks if remote refresh fails.
    });
  }, [refreshPlannedBlocks]);

  const persistPlannedBlocks = useCallback(async (nextBlocks: PlannedBlock[]) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const previousBlocks = plannedBlocksRef.current;
    const nextIds = new Set(nextBlocks.map((block) => block.id));
    for (const block of previousBlocks) {
      if (!nextIds.has(block.id)) {
        pendingDeletedPlanIdsRef.current.add(block.id);
      }
    }
    for (const block of nextBlocks) {
      pendingDeletedPlanIdsRef.current.delete(block.id);
    }

    plannedBlocksRef.current = nextBlocks;
    setPlannedBlocks(nextBlocks);
    savePlannedBlocksLocally(currentUser.uid, nextBlocks);
    const result = await saveSyncedPlannedBlocks(currentUser, nextBlocks);
    plannedBlocksRef.current = result.blocks as PlannedBlock[];
    if (result.synced) {
      const syncedIds = new Set(result.blocks.map((block) => block.id));
      for (const blockId of [...pendingDeletedPlanIdsRef.current]) {
        if (!syncedIds.has(blockId)) {
          pendingDeletedPlanIdsRef.current.delete(blockId);
        }
      }
    }
    setPlannedBlocks(result.blocks as PlannedBlock[]);
  }, []);

  const selectCalendarDate = useCallback((dateKey: string) => {
    const parsed = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return;
    setCalendarHoverEntryId(null);
    setCalendarPinnedEntryId(null);
    setSelectedCalendarDate(dateKey);
    setCalendarJumpDate(dateKey);
    setCalendarCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    setDayPortalComposerOpen(false);
    setOverlapPickerEntryId(null);
  }, []);

  const jumpToToday = useCallback(() => {
    selectCalendarDate(dayKeyLocal(new Date()));
  }, [selectCalendarDate]);

  const openCalendarBlockComposer = useCallback(() => {
    if (!selectedDateCanAddBlocks) {
      showToast("Past dates stay read-only. Blocks can only be added to today or a future day.", "warning");
      return;
    }
    setDayPortalComposerOpen(true);
    setMobileBlockSheetOpen(true);
    setPlanTitle("");
    setPlanNote("");
    setPlanAttachmentCount(0);
    setPlanNoteExpanded(false);
    setPlanTone(null);
    setPlanTime("09:00");
    setPlanDuration(25);
    setPlanStatus("");
    setEditingPlannedBlockId(null);
    setPlanConflictWarning(null);
  }, [selectedDateCanAddBlocks, showToast]);

  const closeBlockComposer = useCallback(() => {
    setDayPortalComposerOpen(false);
    setMobileBlockSheetOpen(false);
    setPlanTitle("");
    setPlanNote("");
    setPlanAttachmentCount(0);
    setPlanNoteExpanded(false);
    setPlanTone(null);
    setPlanTime("09:00");
    setPlanDuration(25);
    setPlanStatus("");
    setEditingPlannedBlockId(null);
    setPlanConflictWarning(null);
  }, []);

  const openPrefilledBlockComposer = useCallback((options: {
    id?: string;
    dateKey: string;
    title: string;
    note: string;
    timeOfDay: string;
    durationMinutes: number;
    tone?: CalendarTone | null;
    attachmentCount?: number;
  }) => {
    const normalizedDateKey = normalizePlannableDateKey(options.dateKey);
    selectCalendarDate(normalizedDateKey);
    setEditingPlannedBlockId(options.id ?? null);
    setPlanTitle(options.title);
    setPlanNote(options.note);
    setPlanAttachmentCount(options.attachmentCount ?? 0);
    setPlanNoteExpanded(Boolean(options.note));
    setPlanTone(options.tone ?? null);
    setPlanTime(options.timeOfDay || "09:00");
    setPlanDuration(options.durationMinutes);
    setPlanStatus("");
    setPlanConflictWarning(null);
    setDayPortalComposerOpen(true);
    setMobileBlockSheetOpen(true);
    onNavigateToCalendarDay?.();
  }, [onNavigateToCalendarDay, selectCalendarDate]);

  const closeDailyPlanningPreview = useCallback(() => {
    setDailyPlanningPreviewOpen(false);
  }, []);

  const addPlannedBlock = useCallback(() => {
    if (!auth.currentUser) return false;
    if (!selectedDateCanAddBlocks) {
      showToast("Past dates stay read-only. Blocks can only be added to today or a future day.", "warning");
      return false;
    }
    const title = planTitle.trim();
    const note = planNote.trim();
    if (!title) {
      showToast("Write a task title first.", "warning");
      return false;
    }

    const durationError = getPlannedBlockDurationError(planDuration);
    if (durationError) {
      showToast(durationError, "warning");
      return false;
    }

    const nextTime = planTime || "09:00";

    // Prevent scheduling in the past on today's date
    if (selectedDateKey === liveTodayKey && nextTime) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (parseTimeToMinutes(nextTime) < nowMinutes) {
        showToast("Can't schedule in the past.", "warning");
        return false;
      }
    }
    const conflicts = findPlanSpacingConflicts(selectedDatePlans, {
      dateKey: selectedDateKey,
      timeOfDay: nextTime,
      durationMinutes: planDuration,
      excludeId: editingPlannedBlockId ?? undefined,
    });
    if (conflicts.length > 0) {
      setPlanConflictWarning({
        conflictIds: conflicts.map((item) => item.id),
        message: buildBlockSpacingMessage(conflicts),
      });
      setPlanStatus("");
      return false;
    }

    const now = new Date().toISOString();
    const existing = editingPlannedBlockId
      ? plannedBlocks.find((item) => item.id === editingPlannedBlockId) ?? null
      : null;
    const next: PlannedBlock = existing
      ? {
          ...existing,
          dateKey: selectedDateKey,
          title,
          note,
          attachmentCount: planAttachmentCount > 0 ? planAttachmentCount : undefined,
          tone: isPro ? planTone ?? undefined : undefined,
          durationMinutes: planDuration,
          timeOfDay: nextTime,
          updatedAtISO: now,
        }
      : {
          id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`,
          dateKey: selectedDateKey,
          title,
          note,
          attachmentCount: planAttachmentCount > 0 ? planAttachmentCount : undefined,
          tone: isPro ? planTone ?? undefined : undefined,
          durationMinutes: planDuration,
          timeOfDay: nextTime,
          sortOrder: selectedDatePlans.length === 0 ? 0 : Math.max(...selectedDatePlans.map((item) => item.sortOrder)) + 1,
          createdAtISO: now,
          updatedAtISO: now,
          status: "active",
        };

    void persistPlannedBlocks(
      existing
        ? plannedBlocks.map((item) => (item.id === existing.id ? next : item))
        : [...plannedBlocks, next],
    );
    if (!existing) {
      onTrackTaskCreated?.(next, "manual");
    }
    setPlanTitle("");
    setPlanNote("");
    setPlanAttachmentCount(0);
    setPlanNoteExpanded(false);
    setPlanTone(null);
    setEditingPlannedBlockId(null);
    setPlanConflictWarning(null);
    showToast(existing ? "Block updated." : "Planned block added.", "success");
    setSelectedCalendarDate(selectedDateKey);
    setPendingCalendarEntryFocusId(`plan-${next.id}`);
    onNavigateToCalendarDay?.();
    return true;
  }, [
    isPro,
    onNavigateToCalendarDay,
    onTrackTaskCreated,
    persistPlannedBlocks,
    planAttachmentCount,
    planDuration,
    editingPlannedBlockId,
    planNote,
    planTime,
    planTitle,
    planTone,
    plannedBlocks,
    liveTodayKey,
    selectedDateCanAddBlocks,
    selectedDateKey,
    selectedDatePlans,
    showToast,
  ]);

  const deletePlannedBlock = useCallback((id: string) => {
    const removed = plannedBlocks.find((item) => item.id === id) || null;
    if (!removed) return;
    const deletedAt = new Date().toISOString();
    void persistPlannedBlocks(
      plannedBlocks.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "deleted" as PlannedBlock["status"],
              completedAtISO: undefined,
              updatedAtISO: deletedAt,
            }
          : item,
      ),
    );
    setDeletedPlanUndo(removed);
    window.setTimeout(() => setDeletedPlanUndo(null), 5000);
  }, [persistPlannedBlocks, plannedBlocks]);

  const undoDeletePlannedBlock = useCallback(() => {
    if (!deletedPlanUndo) return;
    const restoredAt = new Date().toISOString();
    const restoredBlock = {
      ...deletedPlanUndo,
      status: "active" as PlannedBlock["status"],
      completedAtISO: undefined,
      updatedAtISO: restoredAt,
    };
    const nextBlocks = plannedBlocks.some((item) => item.id === deletedPlanUndo.id)
      ? plannedBlocks.map((item) => (item.id === deletedPlanUndo.id ? restoredBlock : item))
      : [...plannedBlocks, restoredBlock];
    void persistPlannedBlocks(nextBlocks);
    setDeletedPlanUndo(null);
  }, [deletedPlanUndo, persistPlannedBlocks, plannedBlocks]);

  const updatePlannedBlockTime = useCallback((id: string, timeOfDay: string) => {
    const block = plannedBlocks.find((item) => item.id === id);
    if (!block) return;
    if (isDateKeyBeforeToday(block.dateKey)) {
      showToast("Past dates stay read-only. This block can no longer be rescheduled there.", "warning");
      return;
    }
    const conflicts = findPlanSpacingConflicts(plannedBlocks, {
      dateKey: block.dateKey,
      timeOfDay,
      durationMinutes: block.durationMinutes,
      excludeId: id,
    });
    if (conflicts.length > 0) {
      showToast(buildBlockSpacingMessage(conflicts), "warning");
      return;
    }
    const updatedAtISO = new Date().toISOString();
    void persistPlannedBlocks(
      plannedBlocks.map((item) => (item.id === id ? { ...item, timeOfDay, updatedAtISO } : item)),
    );
  }, [persistPlannedBlocks, plannedBlocks, showToast]);

  const reorderPlannedBlocks = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    const sameDate = plannedBlocks
      .filter((item) => item.dateKey === selectedDateKey)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.timeOfDay.localeCompare(b.timeOfDay));

    const sourceIndex = sameDate.findIndex((item) => item.id === sourceId);
    const targetIndex = sameDate.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const reordered = [...sameDate];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const updatedAtISO = new Date().toISOString();
    const withOrder = reordered.map((item, index) => ({
      ...item,
      sortOrder: index,
      updatedAtISO,
    }));

    const untouched = plannedBlocks.filter((item) => item.dateKey !== selectedDateKey);
    void persistPlannedBlocks([...untouched, ...withOrder]);
  }, [persistPlannedBlocks, plannedBlocks, selectedDateKey]);

  const updatePlannedBlockTone = useCallback((id: string, tone: CalendarTone | null) => {
    if (!isPro) return;
    const updatedAtISO = new Date().toISOString();
    void persistPlannedBlocks(
      plannedBlocks.map((item) => (item.id === id ? { ...item, tone: tone ?? undefined, updatedAtISO } : item)),
    );
  }, [isPro, persistPlannedBlocks, plannedBlocks]);

  const updateDailyRitualDraft = useCallback((
    draftId: string,
    patch: Partial<Pick<DailyRitualBlockDraft, "title" | "note" | "tone" | "timeOfDay" | "durationMinutes">>,
  ) => {
    setDailyRitualDrafts((current) =>
      current.map((draft) => (draft.id === draftId ? { ...draft, ...patch } : draft)),
    );
  }, []);

  const submitDailyRitual = useCallback(() => {
    if (dailyPlanningPreviewOpen) {
      closeDailyPlanningPreview();
      return;
    }
    if (!auth.currentUser) return;

    const invalidDraft = dailyRitualDrafts.find((draft) => {
      if (draft.existingBlockId) return false;
      return !draft.title.trim() || !draft.timeOfDay || getPlannedBlockDurationError(draft.durationMinutes) !== null;
    });

    if (invalidDraft) {
      setDailyPlanningStatus("Place 3 real commitments for today. Each one needs a title, time, and a reasonable duration.");
      return;
    }

    const newBlocks = dailyRitualDrafts
      .filter((draft) => !draft.existingBlockId)
      .map((draft, index) => {
        const createdAtISO = new Date().toISOString();
        return {
          id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-${index}`,
          dateKey: liveTodayKey,
          title: draft.title.trim(),
          note: draft.note.trim(),
          attachmentCount: undefined,
          tone: isPro ? draft.tone ?? undefined : undefined,
          durationMinutes: draft.durationMinutes,
          timeOfDay: draft.timeOfDay,
          sortOrder: claimedBlocksToday.length + index,
          createdAtISO,
          updatedAtISO: createdAtISO,
          status: "active" as const,
        } satisfies PlannedBlock;
      });

    const spacingConflicts: PlannedBlock[] = [];
    const candidatePool = plannedBlocks.filter(
      (item) => item.dateKey === liveTodayKey && item.status === "active",
    );
    for (const block of newBlocks) {
      const conflicts = findPlanSpacingConflicts([...candidatePool, ...newBlocks], {
        dateKey: block.dateKey,
        timeOfDay: block.timeOfDay,
        durationMinutes: block.durationMinutes,
        excludeId: block.id,
      });
      if (conflicts.length > 0) {
        spacingConflicts.push(...conflicts);
        break;
      }
    }

    if (spacingConflicts.length > 0) {
      setDailyPlanningStatus(buildBlockSpacingMessage(spacingConflicts));
      return;
    }

    void persistPlannedBlocks([...plannedBlocks, ...newBlocks]);
    newBlocks.forEach((block) => onTrackTaskCreated?.(block, "daily_ritual"));
    setDailyPlanningStatus("");
    setDailyPlanningOpen(false);
    setSelectedCalendarDate(liveTodayKey);
    onNavigateToCalendarDay?.();
  }, [
    claimedBlocksToday.length,
    closeDailyPlanningPreview,
    dailyPlanningPreviewOpen,
    dailyRitualDrafts,
    isPro,
    liveTodayKey,
    onNavigateToCalendarDay,
    onTrackTaskCreated,
    persistPlannedBlocks,
    plannedBlocks,
  ]);

  return {
    plannedBlocks,
    setPlannedBlocks,
    plannedBlocksHydrated,
    setPlannedBlocksHydrated,
    completedBlocksByDay,
    todayPlannedBlocks,
    todayActivePlannedBlocks,
    claimedBlocksToday,
    dailyPlanningLocked,
    dailyPlanningOpen,
    setDailyPlanningOpen,
    dailyPlanningStatus,
    setDailyPlanningStatus,
    dailyPlanningPromptSeenToday,
    setDailyPlanningPromptSeenToday,
    dailyRitualDrafts,
    setDailyRitualDrafts,
    dailyRitualExpandedId,
    setDailyRitualExpandedId,
    selectedCalendarDate,
    setSelectedCalendarDate,
    calendarCursor,
    setCalendarCursor,
    calendarHoverEntryId,
    setCalendarHoverEntryId,
    calendarPinnedEntryId,
    setCalendarPinnedEntryId,
    calendarAuxPanel,
    setCalendarAuxPanel,
    planTitle,
    setPlanTitle,
    planNote,
    setPlanNote,
    planAttachmentCount,
    setPlanAttachmentCount,
    planNoteExpanded,
    setPlanNoteExpanded,
    planTone,
    setPlanTone,
    planDuration,
    setPlanDuration,
    planTime,
    setPlanTime,
    planStatus,
    setPlanStatus,
    editingPlannedBlockId,
    setEditingPlannedBlockId,
    planConflictWarning,
    setPlanConflictWarning,
    calendarJumpDate,
    setCalendarJumpDate,
    draggedPlanId,
    setDraggedPlanId,
    pendingCalendarEntryFocusId,
    setPendingCalendarEntryFocusId,
    activatedCalendarEntryId,
    setActivatedCalendarEntryId,
    overlapPickerEntryId,
    setOverlapPickerEntryId,
    dayPortalComposerOpen,
    setDayPortalComposerOpen,
    selectedPlanDetailId,
    setSelectedPlanDetailId,
    plannerSectionsOpen,
    setPlannerSectionsOpen,
    deletedPlanUndo,
    dailyPlanningPreviewOpen,
    setDailyPlanningPreviewOpen,
    mobileBlockSheetOpen,
    setMobileBlockSheetOpen,
    mobileCalendarControlsOpen,
    setMobileCalendarControlsOpen,
    mobileAgendaEntriesOpen,
    setMobileAgendaEntriesOpen,
    selectedDateKey,
    selectedDateCanAddBlocks,
    selectedDatePlans,
    handleBlocksSnapshot,
    handleUserSignedIn,
    handleUserSignedOut,
    refreshPlannedBlocks,
    persistPlannedBlocks,
    selectCalendarDate,
    jumpToToday,
    openCalendarBlockComposer,
    closeBlockComposer,
    openPrefilledBlockComposer,
    closeDailyPlanningPreview,
    addPlannedBlock,
    deletePlannedBlock,
    undoDeletePlannedBlock,
    updatePlannedBlockTime,
    reorderPlannedBlocks,
    updatePlannedBlockTone,
    updateDailyRitualDraft,
    submitDailyRitual,
  };
}
