"use client";

import { memo } from "react";

import NotesTab from "@/components/NotesTab";
import {
  type NotesShellHandlers,
  type NotesShellRefs,
  type NotesShellState,
  useNotesShellViewModel,
} from "@/hooks/useNotesShellViewModel";

type HomeNotesContainerProps = {
  refs: NotesShellRefs;
  state: NotesShellState;
  handlers: NotesShellHandlers;
};

const HomeNotesContainer = memo(function HomeNotesContainer({
  refs,
  state,
  handlers,
}: HomeNotesContainerProps) {
  const notesTabProps = useNotesShellViewModel({
    refs,
    state,
    handlers,
  });

  return <NotesTab {...notesTabProps} />;
});

export default HomeNotesContainer;
