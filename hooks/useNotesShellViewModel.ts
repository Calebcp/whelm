"use client";

import { useMemo } from "react";

import type { NotesTabProps } from "@/components/NotesTab";

export type NotesShellRefs = Pick<
  NotesTabProps,
  | "sectionRef"
  | "noteAttachmentInputRef"
  | "notesStartRef"
  | "notesRecentRef"
  | "notesEditorRef"
  | "editorRef"
  | "noteBodyShellRef"
>;

export type NotesShellState = Omit<
  NotesTabProps,
  | keyof NotesShellRefs
  | "onSetNotesSurface"
  | "onCardsXPEarned"
  | "onSetNotesSearch"
  | "onSetNotesCategoryFilter"
  | "onSetMobileNotesRecentOpen"
  | "onSetMobileNotesEditorOpen"
  | "onSetMobileNotesToolsOpen"
  | "onSetColorPickerOpen"
  | "onSetShellColorPickerOpen"
  | "onSetTextColorPickerOpen"
  | "onSetHighlightPickerOpen"
  | "onSetEditorBandanaCaret"
  | "onNoteAttachmentInput"
  | "onOpenAttachmentPicker"
  | "onOpenNoteAttachment"
  | "onRemoveNoteAttachment"
  | "onConvertNoteToBlock"
  | "onDeleteNote"
  | "onCreateNote"
  | "onTogglePinned"
  | "onUpdateSelectedNote"
  | "onFlushPendingTitleSync"
  | "onCaptureEditorDraft"
  | "onSaveEditorSelection"
  | "onApplyEditorCommand"
  | "onCheckEditorSelection"
  | "onUpdateEditorBandanaCaret"
  | "onFlushNoteDraft"
  | "onMobileCreateNote"
  | "onOpenMobileEditor"
  | "onOpenCurrentMobileNote"
  | "onRetrySync"
  | "onApplyHighlightColor"
  | "onScrollToSection"
  | "onSetSelectedNoteId"
  | "onToggleProNotesPanel"
  | "onStartProPreview"
  | "onOpenUpgradeFlow"
>;

export type NotesShellHandlers = Pick<
  NotesTabProps,
  | "onSetNotesSurface"
  | "onCardsXPEarned"
  | "onSetNotesSearch"
  | "onSetNotesCategoryFilter"
  | "onSetMobileNotesRecentOpen"
  | "onSetMobileNotesEditorOpen"
  | "onSetMobileNotesToolsOpen"
  | "onSetColorPickerOpen"
  | "onSetShellColorPickerOpen"
  | "onSetTextColorPickerOpen"
  | "onSetHighlightPickerOpen"
  | "onSetEditorBandanaCaret"
  | "onNoteAttachmentInput"
  | "onOpenAttachmentPicker"
  | "onOpenNoteAttachment"
  | "onRemoveNoteAttachment"
  | "onConvertNoteToBlock"
  | "onDeleteNote"
  | "onCreateNote"
  | "onTogglePinned"
  | "onUpdateSelectedNote"
  | "onFlushPendingTitleSync"
  | "onCaptureEditorDraft"
  | "onSaveEditorSelection"
  | "onApplyEditorCommand"
  | "onCheckEditorSelection"
  | "onUpdateEditorBandanaCaret"
  | "onFlushNoteDraft"
  | "onMobileCreateNote"
  | "onOpenMobileEditor"
  | "onOpenCurrentMobileNote"
  | "onRetrySync"
  | "onApplyHighlightColor"
  | "onScrollToSection"
  | "onSetSelectedNoteId"
  | "onToggleProNotesPanel"
  | "onStartProPreview"
  | "onOpenUpgradeFlow"
>;

type UseNotesShellViewModelOptions = {
  refs: NotesShellRefs;
  state: NotesShellState;
  handlers: NotesShellHandlers;
};

export function useNotesShellViewModel({
  refs,
  state,
  handlers,
}: UseNotesShellViewModelOptions) {
  return useMemo<NotesTabProps>(
    () => ({
      ...refs,
      ...state,
      ...handlers,
    }),
    [refs, state, handlers],
  );
}
