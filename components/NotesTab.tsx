"use client";

import {
  type CSSProperties,
  type ChangeEvent,
  type Ref,
  type RefObject,
  memo,
  useEffect,
  useState,
} from "react";
import { motion } from "motion/react";

import sharedStyles from "@/app/page.module.css";
import AnimatedTabSection from "@/components/AnimatedTabSection";
import CardsTab from "@/components/CardsTab";
import styles from "@/components/NotesTab.module.css";
import ProUnlockCard from "@/components/ProUnlockCard";
import SenseiFigure from "@/components/SenseiFigure";
import { countWords } from "@/lib/date-utils";
import { type WorkspaceNote, type NoteAttachment } from "@/lib/notes-store";
import { type StreakBandanaTier } from "@/lib/streak-bandanas";
import {
  STANDARD_NOTE_COLOR_VALUES,
  WHELM_PRO_NAME,
  WHELM_STANDARD_HISTORY_DAYS,
  WHELM_STANDARD_NAME,
} from "@/lib/whelm-plans";
import { type WhelBandanaColor } from "@/lib/whelm-mascot";

// ── Constants ─────────────────────────────────────────────────────────────────

const WHELM_PRO_POSITIONING =
  "Whelm Pro adds unlimited history, full note customization, and the deeper version of the Whelm writing system.";

const NOTE_COLORS: Array<{ label: string; value: string }> = [
  { label: "Porcelain", value: "#f8fafc" },
  { label: "Cloud", value: "#f1f5f9" },
  { label: "Mist", value: "#e2e8f0" },
  { label: "Stone", value: "#e7e5e4" },
  { label: "Sand", value: "#f5e6c8" },
  { label: "Blush", value: "#ffe4e6" },
  { label: "Rose", value: "#fecdd3" },
  { label: "Cherry", value: "#fecaca" },
  { label: "Apricot", value: "#fed7aa" },
  { label: "Amber", value: "#fde68a" },
  { label: "Lemon", value: "#fef3c7" },
  { label: "Lime", value: "#d9f99d" },
  { label: "Mint", value: "#bbf7d0" },
  { label: "Seafoam", value: "#ccfbf1" },
  { label: "Aqua", value: "#a5f3fc" },
  { label: "Sky", value: "#bae6fd" },
  { label: "Glacier", value: "#dbeafe" },
  { label: "Periwinkle", value: "#c7d2fe" },
  { label: "Lavender", value: "#ddd6fe" },
  { label: "Orchid", value: "#f5d0fe" },
];

const STANDARD_NOTE_COLORS = NOTE_COLORS.filter((color) =>
  STANDARD_NOTE_COLOR_VALUES.includes(color.value as (typeof STANDARD_NOTE_COLOR_VALUES)[number]),
);

const NOTE_FONTS = [
  { label: "Avenir", value: "Avenir Next, Avenir, sans-serif" },
  { label: "Fraunces", value: "Georgia, Times New Roman, serif" },
  { label: "Editorial", value: "Baskerville, Georgia, serif" },
  { label: "Modern Sans", value: "Trebuchet MS, Helvetica Neue, sans-serif" },
  { label: "System", value: "SF Pro Text, Helvetica Neue, Arial, sans-serif" },
  { label: "Mono", value: "Courier New, Menlo, monospace" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Palatino", value: "Palatino, Book Antiqua, serif" },
] as const;

const NOTE_FONT_SIZES = [
  { label: "Small", value: 14, command: "3" },
  { label: "Normal", value: 16, command: "4" },
  { label: "Large", value: 18, command: "5" },
  { label: "XL", value: 22, command: "6" },
] as const;

const NOTE_TEXT_COLORS = [
  { label: "Ink", value: "#102033" },
  { label: "Slate", value: "#334155" },
  { label: "Ocean", value: "#145da0" },
  { label: "Royal", value: "#1d4ed8" },
  { label: "Violet", value: "#6d28d9" },
  { label: "Rosewood", value: "#9f1239" },
  { label: "Forest", value: "#166534" },
  { label: "Amber", value: "#b45309" },
  { label: "Crimson", value: "#b91c1c" },
  { label: "Charcoal", value: "#111827" },
] as const;

const NOTE_HIGHLIGHTS = [
  { label: "Sun", value: "#fef08a" },
  { label: "Peach", value: "#fed7aa" },
  { label: "Mint", value: "#bbf7d0" },
  { label: "Sky", value: "#bae6fd" },
  { label: "Lavender", value: "#ddd6fe" },
  { label: "Rose", value: "#fecdd3" },
] as const;

const NOTE_ATTACHMENT_ACCEPT = [
  "image/*",
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".md",
  ".rtf",
  ".pages",
  ".numbers",
  ".key",
].join(",");

const NOTE_SELECTION_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

const NOTE_PRIMARY_TOOLBAR_ITEMS = ["Type"] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type ThemeMode = "dark" | "light" | "system";
type NoteCategory = "personal" | "school" | "work";

type PendingNoteAttachment = {
  id: string;
  name: string;
  progress: number;
  kind: NoteAttachment["kind"];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseHexColor(value: string) {
  const normalized = value.trim();
  const match = normalized.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return null;
  const hex = match[1];
  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : hex;
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return { red, green, blue };
}

function relativeLuminance({ red, green, blue }: { red: number; green: number; blue: number }) {
  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
}

function notePreviewStyle(tint: string): CSSProperties {
  const parsed = parseHexColor(tint);
  const luminance = parsed ? relativeLuminance(parsed) : 1;
  const usesDarkInk = luminance > 0.64;
  return {
    ["--note-item-tint" as const]: tint,
    ["--note-item-title" as const]: usesDarkInk ? "#102033" : "#f7fbff",
    ["--note-item-meta" as const]: usesDarkInk ? "rgba(16, 32, 51, 0.72)" : "rgba(247, 251, 255, 0.78)",
    ["--note-item-chip-bg" as const]: usesDarkInk ? "rgba(16, 32, 51, 0.12)" : "rgba(255, 255, 255, 0.16)",
    ["--note-item-chip-color" as const]: usesDarkInk ? "#183a67" : "#f7fbff",
    ["--note-item-text-shadow" as const]: usesDarkInk
      ? "0 1px 0 rgba(255, 255, 255, 0.26)"
      : "0 1px 10px rgba(8, 12, 24, 0.28)",
  } as CSSProperties;
}

function notesShellBackground(
  themeMode: ThemeMode,
  shellColor?: string,
  pageColor?: string,
  accent?: string,
  accentStrong?: string,
  glow?: string,
): CSSProperties {
  return {
    ["--note-surface-tint" as const]:
      shellColor ?? (themeMode === "dark" ? "#182038" : "#fff7d6"),
    ["--note-page-tone" as const]:
      pageColor ?? (themeMode === "dark" ? "#182038" : "#fffaf0"),
    ["--note-bandana-accent" as const]: accent ?? "#59c7ff",
    ["--note-bandana-accent-strong" as const]: accentStrong ?? "#2f86ff",
    ["--note-bandana-glow" as const]: glow ?? "rgba(84, 173, 255, 0.34)",
  } as CSSProperties;
}

function bandanaCursorAssetPath(color: string | null | undefined, size: 128 | 256 = 128) {
  const resolved = color ?? "yellow";
  return `/streak/cursor/bandana-${resolved}-${size}.png`;
}

function attachmentIndicatorLabel(count: number) {
  return `📎 ${count}`;
}

function noteAttachmentBadgeLabel(attachment: NoteAttachment) {
  switch (attachment.kind) {
    case "image": return "Image";
    case "document": return "Document";
    case "spreadsheet": return "Sheet";
    case "presentation": return "Slides";
    case "archive": return "Archive";
    case "text": return "Text";
    default: return "File";
  }
}

function noteAttachmentGlyph(attachment: Pick<NoteAttachment, "kind">) {
  switch (attachment.kind) {
    case "image": return "◫";
    case "document": return "▤";
    case "spreadsheet": return "▥";
    case "presentation": return "◩";
    case "archive": return "⬚";
    case "text": return "≣";
    default: return "•";
  }
}

function formatAttachmentSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(sizeBytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function notePlainTextPreview(body: string) {
  return body
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|blockquote|h1|h2|h3)>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUntitledNote(note: WorkspaceNote) {
  return note.title.trim().length === 0 || note.title.trim() === "Untitled note";
}

function isInboxNote(note: WorkspaceNote) {
  return isUntitledNote(note) || countWords(note.body) <= 40;
}

function isDraftNote(note: WorkspaceNote) {
  const words = countWords(note.body);
  return words > 40 && words < 800;
}

// ── NoteAttachmentsSection ────────────────────────────────────────────────────

function NoteAttachmentsSection({
  note,
  pendingUploads,
  uploadBusy,
  uploadStatus,
  onAttach,
  onOpen,
  onRemove,
}: {
  note: WorkspaceNote;
  pendingUploads: PendingNoteAttachment[];
  uploadBusy: boolean;
  uploadStatus: string;
  onAttach: () => void;
  onOpen: (attachment: NoteAttachment) => void;
  onRemove: (attachment: NoteAttachment) => void;
}) {
  const hasAttachments = note.attachments.length > 0;
  const hasPendingUploads = pendingUploads.length > 0;

  return (
    <section className={styles.noteAttachmentsSection}>
      <div className={styles.noteAttachmentsHeader}>
        <div className={styles.noteAttachmentsSummary}>
          <p className={styles.noteAttachmentsEyebrow}>Files</p>
          <strong className={styles.noteAttachmentsTitle}>
            {hasAttachments
              ? `${note.attachments.length} attached`
              : "Keep files with this note"}
          </strong>
        </div>
        <button
          type="button"
          className={styles.noteAttachmentAddButton}
          onClick={onAttach}
          disabled={uploadBusy}
        >
          {uploadBusy ? "Adding..." : "Add file"}
        </button>
      </div>
      {uploadStatus ? <p className={styles.noteAttachmentStatus}>{uploadStatus}</p> : null}
      {hasPendingUploads ? (
        <div className={styles.noteAttachmentsRail}>
          {pendingUploads.map((attachment) => (
            <article key={attachment.id} className={styles.noteAttachmentPendingCard}>
              <div className={styles.noteAttachmentPendingTop}>
                <span className={styles.noteAttachmentGlyph}>{noteAttachmentGlyph(attachment)}</span>
                <span className={styles.noteAttachmentBadge}>Uploading</span>
              </div>
              <strong className={styles.noteAttachmentName}>{attachment.name}</strong>
              <div className={styles.noteAttachmentProgressTrack}>
                <span
                  className={styles.noteAttachmentProgressFill}
                  style={{ width: `${Math.max(6, attachment.progress)}%` }}
                />
              </div>
              <span className={styles.noteAttachmentInfo}>{Math.round(attachment.progress)}%</span>
            </article>
          ))}
        </div>
      ) : null}
      {hasAttachments ? (
        <div className={styles.noteAttachmentsRail}>
          {note.attachments.map((attachment) => (
            <article
              key={attachment.id}
              className={`${styles.noteAttachmentCard} ${
                attachment.kind === "image" ? styles.noteAttachmentCardImage : ""
              }`}
            >
              {attachment.kind === "image" ? (
                <button
                  type="button"
                  className={styles.noteAttachmentPreviewButton}
                  onClick={() => onOpen(attachment)}
                >
                  <img
                    src={attachment.downloadUrl}
                    alt={attachment.name}
                    className={styles.noteAttachmentPreviewImage}
                  />
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.noteAttachmentFileFace}
                  onClick={() => onOpen(attachment)}
                >
                  <span className={styles.noteAttachmentGlyph}>{noteAttachmentGlyph(attachment)}</span>
                  <span className={styles.noteAttachmentBadge}>{noteAttachmentBadgeLabel(attachment)}</span>
                </button>
              )}
              <div className={styles.noteAttachmentMeta}>
                <strong className={styles.noteAttachmentName}>{attachment.name}</strong>
                <span className={styles.noteAttachmentInfo}>
                  {noteAttachmentBadgeLabel(attachment)} · {formatAttachmentSize(attachment.sizeBytes)}
                </span>
              </div>
              <div className={styles.noteAttachmentActions}>
                <button
                  type="button"
                  className={styles.noteAttachmentOpenButton}
                  onClick={() => onOpen(attachment)}
                >
                  Open
                </button>
                <button
                  type="button"
                  className={styles.noteAttachmentRemoveButton}
                  onClick={() => onRemove(attachment)}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <span className={styles.noteAttachmentsEmpty}>
          <span className={styles.noteAttachmentEmptyGlyph}>＋</span>
          <p>No files attached</p>
        </span>
      )}
    </section>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export type NotesTabProps = {
  sectionRef?: Ref<HTMLElement>;
  // Surface toggle
  notesSurface: "notes" | "cards";
  onSetNotesSurface: (value: "notes" | "cards") => void;
  // Cards surface
  uid: string;
  onCardsXPEarned: (amount: number) => void;
  // Layout
  isMobileViewport: boolean;
  // Notes data
  notes: WorkspaceNote[];
  selectedNoteId: string | null;
  selectedNote: WorkspaceNote | null | undefined;
  filteredNotes: WorkspaceNote[];
  recentNotes: WorkspaceNote[];
  selectedNoteWordCount: number;
  hasLockedNotesHistory: boolean;
  noteUndoItem: WorkspaceNote | null;
  // Computed note style
  resolvedTheme: ThemeMode;
  selectedNoteSurfaceColor: string | undefined;
  selectedNotePageColor: string | undefined;
  xpTierTheme: { accent: string; accentStrong: string; accentGlow: string };
  streakBandanaTier: StreakBandanaTier | null;
  bandanaColor: WhelBandanaColor;
  // UI state
  notesSearch: string;
  onSetNotesSearch: (value: string) => void;
  notesCategoryFilter: "all" | NoteCategory;
  onSetNotesCategoryFilter: (value: "all" | NoteCategory) => void;
  mobileNotesRecentOpen: boolean;
  onSetMobileNotesRecentOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  mobileNotesEditorOpen: boolean;
  onSetMobileNotesEditorOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  mobileNotesToolsOpen: "format" | "type" | "color" | null;
  onSetMobileNotesToolsOpen: (
    value:
      | "format"
      | "type"
      | "color"
      | null
      | ((prev: "format" | "type" | "color" | null) => "format" | "type" | "color" | null),
  ) => void;
  colorPickerOpen: boolean;
  onSetColorPickerOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  shellColorPickerOpen: boolean;
  onSetShellColorPickerOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  textColorPickerOpen: boolean;
  onSetTextColorPickerOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  highlightPickerOpen: boolean;
  onSetHighlightPickerOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  editorBandanaCaret: { left: number; top: number; visible: boolean };
  onSetEditorBandanaCaret: (
    value:
      | { left: number; top: number; visible: boolean }
      | ((prev: { left: number; top: number; visible: boolean }) => {
          left: number;
          top: number;
          visible: boolean;
        }),
  ) => void;
  // Sync state
  notesSyncStatus: "synced" | "syncing" | "local-only";
  notesSyncMessage: string;
  // Attachment state
  noteAttachmentBusy: boolean;
  noteAttachmentStatus: string;
  pendingNoteAttachments: PendingNoteAttachment[];
  // Refs
  noteAttachmentInputRef: RefObject<HTMLInputElement | null>;
  notesStartRef: Ref<HTMLElement>;
  notesRecentRef: RefObject<HTMLElement | null>;
  notesEditorRef: Ref<HTMLElement>;
  editorRef: RefObject<HTMLTextAreaElement | null>;
  noteBodyShellRef: RefObject<HTMLDivElement | null>;
  // Handlers
  onNoteAttachmentInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenAttachmentPicker: () => void;
  onOpenNoteAttachment: (attachment: NoteAttachment) => void;
  onRemoveNoteAttachment: (attachment: NoteAttachment) => void;
  onConvertNoteToBlock: (noteId: string) => void | Promise<void>;
  onDeleteNote: (noteId: string) => void | Promise<void>;
  onUndoDelete: () => void | Promise<void>;
  onCreateNote: () => void;
  onTogglePinned: (noteId: string) => void;
  onUpdateSelectedNote: (patch: Partial<WorkspaceNote>) => void;
  onFlushPendingTitleSync: () => void | Promise<void>;
  onCaptureEditorDraft: () => void;
  onSaveEditorSelection: () => void;
  onApplyEditorCommand: (command: string, value?: string) => void;
  onCheckEditorSelection: () => void;
  onUpdateEditorBandanaCaret: () => void;
  onFlushNoteDraft: () => void | Promise<void>;
  onMobileCreateNote: () => void | Promise<void>;
  onOpenMobileEditor: (noteId: string) => void | Promise<void>;
  onOpenCurrentMobileNote: () => void | Promise<void>;
  onRetrySync: () => void | Promise<void>;
  onApplyHighlightColor: (value: string) => void;
  onScrollToSection: (target: HTMLElement | null) => void;
  onSetSelectedNoteId: (id: string | null) => void;
  // Pro
  isPro: boolean;
  proPanelNotesOpen: boolean;
  onToggleProNotesPanel: () => void;
  onStartProPreview: () => void;
  onOpenUpgradeFlow: () => void;
};

type MobileNotesPanelProps = {
  selectedNoteId: string | null;
  selectedNote: WorkspaceNote | null | undefined;
  filteredNotes: WorkspaceNote[];
  selectedNoteWordCount: number;
  resolvedTheme: ThemeMode;
  selectedNoteSurfaceColor: string | undefined;
  selectedNotePageColor: string | undefined;
  xpTierTheme: { accent: string; accentStrong: string; accentGlow: string };
  streakBandanaTier: StreakBandanaTier | null;
  notesSearch: string;
  onSetNotesSearch: (value: string) => void;
  mobileNotesRecentOpen: boolean;
  onSetMobileNotesRecentOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  mobileNotesEditorOpen: boolean;
  onSetMobileNotesEditorOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  mobileNotesToolsOpen: "format" | "type" | "color" | null;
  onSetMobileNotesToolsOpen: (
    value:
      | "format"
      | "type"
      | "color"
      | null
      | ((prev: "format" | "type" | "color" | null) => "format" | "type" | "color" | null),
  ) => void;
  colorPickerOpen: boolean;
  onSetColorPickerOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  shellColorPickerOpen: boolean;
  onSetShellColorPickerOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  textColorPickerOpen: boolean;
  onSetTextColorPickerOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  highlightPickerOpen: boolean;
  onSetHighlightPickerOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  editorBandanaCaret: { left: number; top: number; visible: boolean };
  onSetEditorBandanaCaret: NotesTabProps["onSetEditorBandanaCaret"];
  notesSyncStatus: "synced" | "syncing" | "local-only";
  notesSyncMessage: string;
  noteAttachmentBusy: boolean;
  noteAttachmentStatus: string;
  pendingNoteAttachments: PendingNoteAttachment[];
  notesStartRef: Ref<HTMLElement>;
  notesRecentRef: RefObject<HTMLElement | null>;
  notesEditorRef: Ref<HTMLElement>;
  editorRef: RefObject<HTMLTextAreaElement | null>;
  noteBodyShellRef: RefObject<HTMLDivElement | null>;
  onOpenAttachmentPicker: () => void;
  onOpenNoteAttachment: (attachment: NoteAttachment) => void;
  onRemoveNoteAttachment: (attachment: NoteAttachment) => void;
  onConvertNoteToBlock: (noteId: string) => void | Promise<void>;
  onDeleteNote: (noteId: string) => void | Promise<void>;
  onUpdateSelectedNote: (patch: Partial<WorkspaceNote>) => void;
  onFlushPendingTitleSync: () => void | Promise<void>;
  onCaptureEditorDraft: () => void;
  onSaveEditorSelection: () => void;
  onApplyEditorCommand: (command: string, value?: string) => void;
  onCheckEditorSelection: () => void;
  onUpdateEditorBandanaCaret: () => void;
  onFlushNoteDraft: () => void | Promise<void>;
  onMobileCreateNote: () => void | Promise<void>;
  onOpenMobileEditor: (noteId: string) => void | Promise<void>;
  onOpenCurrentMobileNote: () => void | Promise<void>;
  onRetrySync: () => void | Promise<void>;
  onApplyHighlightColor: (value: string) => void;
  onScrollToSection: (target: HTMLElement | null) => void;
  onSetSelectedNoteId: (id: string | null) => void;
  isPro: boolean;
  proPanelNotesOpen: boolean;
  onToggleProNotesPanel: () => void;
  onStartProPreview: () => void;
  syncStatusLabel: string;
  syncButtonLabel: string;
};

type MobileRecentNotesCardProps = Pick<
  MobileNotesPanelProps,
  | "filteredNotes"
  | "notesSearch"
  | "onSetNotesSearch"
  | "mobileNotesRecentOpen"
  | "onSetMobileNotesRecentOpen"
  | "notesRecentRef"
  | "onOpenMobileEditor"
  | "onScrollToSection"
> & {
  notesStartRef: Ref<HTMLElement>;
};

const MobileRecentNotesCard = memo(function MobileRecentNotesCard({
  filteredNotes,
  notesSearch,
  onSetNotesSearch,
  mobileNotesRecentOpen,
  onSetMobileNotesRecentOpen,
  notesRecentRef,
  onOpenMobileEditor,
}: MobileRecentNotesCardProps) {
  return (
    <article className={styles.mobileNotesRecentCard} ref={notesRecentRef}>
      <button
        type="button"
        className={sharedStyles.mobileSectionToggle}
        onClick={() => onSetMobileNotesRecentOpen((open) => !open)}
        aria-expanded={mobileNotesRecentOpen}
      >
        <div>
          <p className={sharedStyles.sectionLabel}>Recent Notes</p>
          <strong className={sharedStyles.mobileSectionToggleTitle}>Reopen the latest writing fast</strong>
        </div>
        <span>{mobileNotesRecentOpen ? "Hide" : "Open"}</span>
      </button>

      {mobileNotesRecentOpen && (
        <>
          <input
            value={notesSearch}
            onChange={(event) => onSetNotesSearch(event.target.value)}
            placeholder="Search notes"
            className={styles.notesSearchInput}
          />
          <div className={styles.mobileRecentList}>
            {filteredNotes.map((note) => {
              const wordCount = countWords(note.body);
              return (
                <button
                  key={note.id}
                  type="button"
                  className={styles.mobileRecentNote}
                  style={{
                    ...notePreviewStyle(note.shellColor || "#fff7d6"),
                    backgroundColor: note.shellColor || "#fff7d6",
                  }}
                  onClick={() => void onOpenMobileEditor(note.id)}
                >
                  <div className={styles.mobileRecentNoteHeader}>
                    <strong className={styles.mobileRecentNoteTitle}>
                      {note.title || "Untitled note"}
                    </strong>
                    <div className={styles.mobileRecentNoteBadges}>
                      {note.attachments.length > 0 ? (
                        <span className={sharedStyles.attachmentIndicatorChip}>
                          {attachmentIndicatorLabel(note.attachments.length)}
                        </span>
                      ) : null}
                      {wordCount > 0 ? (
                        <span className={styles.wordCountChip}>
                          {wordCount}w
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className={styles.mobileRecentMeta}>
                    {new Date(note.updatedAtISO).toLocaleDateString()}
                    {note.category ? ` · ${note.category.toUpperCase()}` : ""}
                    {note.attachments.length > 0
                      ? ` · ${note.attachments.length} file${note.attachments.length === 1 ? "" : "s"}`
                      : ""}
                  </span>
                </button>
              );
            })}
            {filteredNotes.length === 0 && (
              <p className={sharedStyles.emptyText}>No notes yet. Start your first one.</p>
            )}
          </div>
        </>
      )}
    </article>
  );
});

type MobileNoteEditorCardProps = Omit<
  MobileNotesPanelProps,
  | "selectedNoteId"
  | "filteredNotes"
  | "notesSearch"
  | "onSetNotesSearch"
  | "mobileNotesRecentOpen"
  | "onSetMobileNotesRecentOpen"
  | "notesStartRef"
  | "notesRecentRef"
> & {
  selectedNote: WorkspaceNote;
};

const MobileNoteEditorCard = memo(function MobileNoteEditorCard({
  selectedNote,
  selectedNoteWordCount,
  resolvedTheme,
  selectedNoteSurfaceColor,
  selectedNotePageColor,
  xpTierTheme,
  streakBandanaTier: _streakBandanaTier,
  mobileNotesToolsOpen,
  onSetMobileNotesToolsOpen,
  colorPickerOpen,
  onSetColorPickerOpen,
  shellColorPickerOpen,
  onSetShellColorPickerOpen,
  textColorPickerOpen,
  onSetTextColorPickerOpen,
  highlightPickerOpen,
  onSetHighlightPickerOpen,
  editorBandanaCaret: _editorBandanaCaret,
  onSetEditorBandanaCaret,
  mobileNotesEditorOpen: _mobileNotesEditorOpen,
  onSetMobileNotesEditorOpen,
  notesSyncStatus,
  notesSyncMessage,
  noteAttachmentBusy,
  noteAttachmentStatus,
  pendingNoteAttachments,
  notesEditorRef,
  editorRef,
  noteBodyShellRef,
  onOpenAttachmentPicker,
  onOpenNoteAttachment,
  onRemoveNoteAttachment,
  onConvertNoteToBlock,
  onDeleteNote,
  onUpdateSelectedNote,
  onFlushPendingTitleSync,
  onCaptureEditorDraft,
  onSaveEditorSelection,
  onApplyEditorCommand,
  onCheckEditorSelection,
  onUpdateEditorBandanaCaret: _onUpdateEditorBandanaCaret,
  onFlushNoteDraft,
  onRetrySync,
  onApplyHighlightColor,
  onSetSelectedNoteId,
  isPro,
  proPanelNotesOpen,
  onToggleProNotesPanel,
  onStartProPreview,
  syncStatusLabel,
  syncButtonLabel,
}: MobileNoteEditorCardProps) {
  return (
    <article
      className={styles.mobileNotesEditorCard}
      ref={notesEditorRef}
      style={notesShellBackground(
        resolvedTheme,
        selectedNoteSurfaceColor,
        selectedNotePageColor,
        xpTierTheme.accent,
        xpTierTheme.accentStrong,
        xpTierTheme.accentGlow,
      )}
      data-note-fill={selectedNote.surfaceStyle}
    >
      <div className={styles.notesStudioHero}>
        <div>
          <p className={`${sharedStyles.sectionLabel} ${styles.noteHeroLabel}`}>Editing</p>
          <h2 className={`${sharedStyles.cardTitle} ${styles.noteHeroTitle}`}>
            {selectedNote.title || "Untitled note"}
          </h2>
        </div>
        <div className={sharedStyles.noteFooterActions}>
          <div className={styles.noteToneControlRow}>
            {isPro ? (
              <div className={styles.noteFillModeSwitch}>
                <button
                  type="button"
                  className={`${styles.noteFillModeButton} ${
                    selectedNote.surfaceStyle === "solid" ? styles.noteFillModeButtonActive : ""
                  }`}
                  onClick={() => void onUpdateSelectedNote({ surfaceStyle: "solid" })}
                >
                  Solid
                </button>
                <button
                  type="button"
                  className={`${styles.noteFillModeButton} ${
                    selectedNote.surfaceStyle === "airy" ? styles.noteFillModeButtonActive : ""
                  }`}
                  onClick={() => void onUpdateSelectedNote({ surfaceStyle: "airy" })}
                >
                  Airy
                </button>
              </div>
            ) : null}
            <div className={styles.noteTonePopoverAnchor}>
              <button
                type="button"
                className={`${styles.noteColorPickerTrigger} ${styles.noteToneButton}`}
                style={{ ["--note-tone-color" as const]: selectedNote.color || "#e7e5e4" } as CSSProperties}
                onClick={() => {
                  onSetColorPickerOpen((open) => !open);
                  onSetShellColorPickerOpen(false);
                  onSetTextColorPickerOpen(false);
                  onSetHighlightPickerOpen(false);
                }}
              >
                <span className={styles.noteToneButtonLabel}>Page tone</span>
                <span className={styles.noteColorPickerPreview}>
                  <span
                    className={styles.noteColorPickerPreviewFill}
                    style={{ backgroundColor: selectedNote.color || "#e7e5e4" }}
                  />
                </span>
              </button>
              {colorPickerOpen && (
                <div className={styles.noteColorPickerPopover}>
                  {(isPro ? NOTE_COLORS : STANDARD_NOTE_COLORS).map((color) => (
                    <button
                      type="button"
                      key={color.value}
                      className={`${styles.noteColorSwatch} ${
                        selectedNote.color === color.value ? styles.noteColorSwatchActive : ""
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                      onClick={() => {
                        void onUpdateSelectedNote({ color: color.value });
                        onSetColorPickerOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
            {isPro ? (
              <div className={styles.noteTonePopoverAnchor}>
                <button
                  type="button"
                  className={`${styles.noteColorPickerTrigger} ${styles.noteShellButton}`}
                  style={{ ["--note-tone-color" as const]: selectedNote.shellColor || "#fff7d6" } as CSSProperties}
                  onClick={() => {
                    onSetShellColorPickerOpen((open) => !open);
                    onSetColorPickerOpen(false);
                    onSetTextColorPickerOpen(false);
                    onSetHighlightPickerOpen(false);
                  }}
                >
                  <span className={styles.noteToneButtonLabel}>Notebook color</span>
                  <span className={styles.noteColorPickerPreview}>
                    <span
                      className={styles.noteColorPickerPreviewFill}
                      style={{ backgroundColor: selectedNote.shellColor || "#fff7d6" }}
                    />
                  </span>
                </button>
                {shellColorPickerOpen && (
                  <div className={styles.noteColorPickerPopover}>
                    {NOTE_COLORS.map((color) => (
                      <button
                        type="button"
                        key={color.value}
                        className={`${styles.noteColorSwatch} ${
                          selectedNote.shellColor === color.value ? styles.noteColorSwatchActive : ""
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.label}
                        onClick={() => {
                          void onUpdateSelectedNote({ shellColor: color.value });
                          onSetShellColorPickerOpen(false);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={`${sharedStyles.secondaryPlanButton} ${styles.noteDoneButton}`}
            onClick={() => {
              void onFlushNoteDraft();
              onSetMobileNotesEditorOpen(false);
            }}
          >
            Done
          </button>
        </div>
      </div>

      <div className={styles.mobileNotesControls}>
        {NOTE_PRIMARY_TOOLBAR_ITEMS.map((item) => (
          <button
            key={item}
            type="button"
            className={`${sharedStyles.mobileControlToggle} ${
              mobileNotesToolsOpen === "type" ? sharedStyles.mobileControlToggleActive : ""
            }`}
            disabled={!isPro}
            onClick={() => onSetMobileNotesToolsOpen((current) => (current === "type" ? null : "type"))}
          >
            {item}
          </button>
        ))}
      </div>

      {mobileNotesToolsOpen === "type" ? (
        <div className={sharedStyles.mobileToolPanel}>
          <select
            className={styles.noteToolSelect}
            value={selectedNote.fontFamily}
            onPointerDown={() => onSaveEditorSelection()}
            onChange={(event) => {
              const nextFont = event.target.value;
              onApplyEditorCommand("fontName", nextFont);
              void onUpdateSelectedNote({ fontFamily: nextFont });
            }}
          >
            {NOTE_FONTS.map((font) => (
              <option key={font.label} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
          <select
            className={styles.noteToolSelect}
            value={String(selectedNote.fontSizePx)}
            onPointerDown={() => onSaveEditorSelection()}
            onChange={(event) => {
              const nextSize = Number(event.target.value);
              const option = NOTE_FONT_SIZES.find((item) => item.value === nextSize);
              onApplyEditorCommand("fontSize", option?.command ?? "4");
              void onUpdateSelectedNote({ fontSizePx: nextSize });
            }}
          >
            {NOTE_FONT_SIZES.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {!isPro ? (
        <ProUnlockCard
          title="Full note styling"
          body={`${WHELM_STANDARD_NAME} keeps a focused page-tone palette. ${WHELM_PRO_NAME} adds notebook color, surface styling, custom fonts, text colors, and highlights.`}
          open={proPanelNotesOpen}
          onToggle={onToggleProNotesPanel}
          onPreview={onStartProPreview}
          preview={
            <div className={styles.noteStylePreview}>
              <div className={styles.noteStylePreviewToolbar}>
                <span className={styles.noteStylePreviewChip}>Page tone</span>
                <span className={styles.noteStylePreviewChip}>Fraunces</span>
                <span className={styles.noteStylePreviewChip}>Highlight</span>
              </div>
              <article className={styles.noteStylePreviewCard}>
                <p className={styles.noteStylePreviewEyebrow}>Whelm Pro Writing Studio</p>
                <h3>Shape the page like a finished thought.</h3>
                <p>
                  Make the page calmer, sharper, or warmer with tone, type, and emphasis that change
                  how the note feels before a word is even read.
                </p>
                <p>
                  <mark>Show the premium surface first.</mark>
                </p>
              </article>
            </div>
          }
        />
      ) : null}

      <input
        value={selectedNote.title}
        onChange={(event) => {
          void onUpdateSelectedNote({ title: event.target.value });
        }}
        onBlur={() => {
          void onFlushPendingTitleSync();
        }}
        placeholder="Note title"
        className={styles.noteTitleInput}
      />
      <div className={styles.noteBodyShell} ref={noteBodyShellRef}>
        <textarea
          ref={editorRef}
          className={styles.noteBodyInput}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          data-gramm="false"
          data-gramm_editor="false"
          data-enable-grammarly="false"
          style={{
            fontFamily: selectedNote.fontFamily,
            fontSize: `${selectedNote.fontSizePx}px`,
          }}
          onInput={() => {
            onCaptureEditorDraft();
          }}
          onKeyUp={(event) => {
            if (
              event.shiftKey ||
              event.metaKey ||
              event.ctrlKey ||
              event.altKey ||
              NOTE_SELECTION_KEYS.has(event.key)
            ) {
              onSaveEditorSelection();
              onCheckEditorSelection();
            }
          }}
          onPaste={() => {
            window.setTimeout(() => {
              onCaptureEditorDraft();
              onSaveEditorSelection();
            }, 0);
          }}
          onCompositionEnd={() => {
            onSaveEditorSelection();
          }}
          onBlur={() => {
            onCaptureEditorDraft();
            void onFlushNoteDraft();
            onSetEditorBandanaCaret((current) =>
              current.visible ? { ...current, visible: false } : current,
            );
          }}
          onPointerUp={() => {
            onSaveEditorSelection();
            onCheckEditorSelection();
          }}
          onFocus={() => {
            onSaveEditorSelection();
          }}
        />
        <div className={styles.noteEditorFooter}>
          <NoteAttachmentsSection
            note={selectedNote}
            pendingUploads={pendingNoteAttachments}
            uploadBusy={noteAttachmentBusy}
            uploadStatus={noteAttachmentStatus}
            onAttach={onOpenAttachmentPicker}
            onOpen={onOpenNoteAttachment}
            onRemove={(attachment) => void onRemoveNoteAttachment(attachment)}
          />
          <span className={styles.noteWordCount}>
            {selectedNoteWordCount} word{selectedNoteWordCount === 1 ? "" : "s"}
            {selectedNoteWordCount >= 33 ? " · streak writing met" : ""}
          </span>
          <span className={styles.noteSyncIndicator}>{syncStatusLabel}</span>
          {notesSyncStatus === "local-only" ? (
            <button
              type="button"
              className={sharedStyles.retrySyncButton}
              onClick={() => void onRetrySync()}
            >
              {syncButtonLabel}
            </button>
          ) : null}
        </div>
      </div>
      <div className={sharedStyles.noteFooterActions}>
        <button
          type="button"
          className={`${sharedStyles.secondaryPlanButton} ${styles.noteDoneButton}`}
          onClick={() => {
            void (async () => {
              await onFlushNoteDraft();
              onSetSelectedNoteId(null);
            })();
          }}
        >
          Done
        </button>
        <button
          type="button"
          className={`${sharedStyles.reportButton} ${sharedStyles.blockActionButton}`}
          onClick={() => {
            void (async () => {
              await onFlushNoteDraft();
              await onConvertNoteToBlock(selectedNote.id);
            })();
          }}
        >
          Turn into block
        </button>
        <button
          type="button"
          className={sharedStyles.retrySyncButton}
          onClick={() => void onRetrySync()}
        >
          {syncButtonLabel}
        </button>
        <button
          type="button"
          className={sharedStyles.deleteNoteButton}
          onClick={() => void onDeleteNote(selectedNote.id)}
        >
          Remove note
        </button>
      </div>
    </article>
  );
});

const MobileNotesPanel = memo(function MobileNotesPanel({
  selectedNoteId,
  selectedNote,
  filteredNotes,
  selectedNoteWordCount,
  resolvedTheme,
  selectedNoteSurfaceColor,
  selectedNotePageColor,
  xpTierTheme,
  streakBandanaTier,
  notesSearch,
  onSetNotesSearch,
  mobileNotesRecentOpen,
  onSetMobileNotesRecentOpen,
  mobileNotesEditorOpen,
  onSetMobileNotesEditorOpen,
  mobileNotesToolsOpen,
  onSetMobileNotesToolsOpen,
  colorPickerOpen,
  onSetColorPickerOpen,
  shellColorPickerOpen,
  onSetShellColorPickerOpen,
  textColorPickerOpen,
  onSetTextColorPickerOpen,
  highlightPickerOpen,
  onSetHighlightPickerOpen,
  editorBandanaCaret,
  onSetEditorBandanaCaret,
  notesSyncStatus,
  notesSyncMessage,
  noteAttachmentBusy,
  noteAttachmentStatus,
  pendingNoteAttachments,
  notesStartRef,
  notesRecentRef,
  notesEditorRef,
  editorRef,
  noteBodyShellRef,
  onOpenAttachmentPicker,
  onOpenNoteAttachment,
  onRemoveNoteAttachment,
  onConvertNoteToBlock,
  onDeleteNote,
  onUpdateSelectedNote,
  onFlushPendingTitleSync,
  onCaptureEditorDraft,
  onSaveEditorSelection,
  onApplyEditorCommand,
  onCheckEditorSelection,
  onUpdateEditorBandanaCaret,
  onFlushNoteDraft,
  onMobileCreateNote,
  onOpenMobileEditor,
  onOpenCurrentMobileNote,
  onRetrySync,
  onApplyHighlightColor,
  onScrollToSection,
  onSetSelectedNoteId,
  isPro,
  proPanelNotesOpen,
  onToggleProNotesPanel,
  onStartProPreview,
  syncStatusLabel,
  syncButtonLabel,
}: MobileNotesPanelProps) {
  return (
    <div className={styles.mobileNotesPanel}>
      <article className={styles.mobileNotesStartCard} ref={notesStartRef}>
        <div className={styles.mobileNotesStartHeaderCompact}>
          <div>
            <p className={sharedStyles.sectionLabel}>Writing Studio</p>
            <h2 className={sharedStyles.cardTitle}>Write clean</h2>
            <p className={sharedStyles.accountMeta}>Start a note or reopen one. Keep the page clear and the thought alive.</p>
          </div>
          <button
            type="button"
            data-tour="notes-create"
            className={sharedStyles.newNoteButton}
            onClick={() => void onMobileCreateNote()}
          >
            New note
          </button>
        </div>
        <div className={styles.mobileNotesActions}>
          {selectedNoteId && (
            <button
              type="button"
              className={sharedStyles.secondaryPlanButton}
              onClick={onOpenCurrentMobileNote}
            >
              Return to current note
            </button>
          )}
          <button
            type="button"
            className={sharedStyles.mobileJumpButton}
            onClick={() => {
              onSetMobileNotesRecentOpen(true);
              window.setTimeout(() => onScrollToSection(notesRecentRef.current), 80);
            }}
          >
            Recent notes
          </button>
        </div>
      </article>

      <MobileRecentNotesCard
        filteredNotes={filteredNotes}
        notesSearch={notesSearch}
        onSetNotesSearch={onSetNotesSearch}
        mobileNotesRecentOpen={mobileNotesRecentOpen}
        onSetMobileNotesRecentOpen={onSetMobileNotesRecentOpen}
        notesRecentRef={notesRecentRef}
        onOpenMobileEditor={onOpenMobileEditor}
        onScrollToSection={onScrollToSection}
        notesStartRef={notesStartRef}
      />

      {mobileNotesEditorOpen && selectedNote ? (
        <MobileNoteEditorCard
          selectedNote={selectedNote}
          selectedNoteWordCount={selectedNoteWordCount}
          resolvedTheme={resolvedTheme}
          selectedNoteSurfaceColor={selectedNoteSurfaceColor}
          selectedNotePageColor={selectedNotePageColor}
          xpTierTheme={xpTierTheme}
          streakBandanaTier={streakBandanaTier}
          mobileNotesToolsOpen={mobileNotesToolsOpen}
          onSetMobileNotesToolsOpen={onSetMobileNotesToolsOpen}
          colorPickerOpen={colorPickerOpen}
          onSetColorPickerOpen={onSetColorPickerOpen}
          shellColorPickerOpen={shellColorPickerOpen}
          onSetShellColorPickerOpen={onSetShellColorPickerOpen}
          textColorPickerOpen={textColorPickerOpen}
          onSetTextColorPickerOpen={onSetTextColorPickerOpen}
          highlightPickerOpen={highlightPickerOpen}
          onSetHighlightPickerOpen={onSetHighlightPickerOpen}
          editorBandanaCaret={editorBandanaCaret}
          onSetEditorBandanaCaret={onSetEditorBandanaCaret}
          mobileNotesEditorOpen={mobileNotesEditorOpen}
          onSetMobileNotesEditorOpen={onSetMobileNotesEditorOpen}
          notesSyncStatus={notesSyncStatus}
          notesSyncMessage={notesSyncMessage}
          noteAttachmentBusy={noteAttachmentBusy}
          noteAttachmentStatus={noteAttachmentStatus}
          pendingNoteAttachments={pendingNoteAttachments}
          notesEditorRef={notesEditorRef}
          editorRef={editorRef}
          noteBodyShellRef={noteBodyShellRef}
          onOpenAttachmentPicker={onOpenAttachmentPicker}
          onOpenNoteAttachment={onOpenNoteAttachment}
          onRemoveNoteAttachment={onRemoveNoteAttachment}
          onConvertNoteToBlock={onConvertNoteToBlock}
          onDeleteNote={onDeleteNote}
          onUpdateSelectedNote={onUpdateSelectedNote}
          onFlushPendingTitleSync={onFlushPendingTitleSync}
          onCaptureEditorDraft={onCaptureEditorDraft}
          onSaveEditorSelection={onSaveEditorSelection}
          onApplyEditorCommand={onApplyEditorCommand}
          onCheckEditorSelection={onCheckEditorSelection}
          onUpdateEditorBandanaCaret={onUpdateEditorBandanaCaret}
          onFlushNoteDraft={onFlushNoteDraft}
          onMobileCreateNote={onMobileCreateNote}
          onOpenMobileEditor={onOpenMobileEditor}
          onOpenCurrentMobileNote={onOpenCurrentMobileNote}
          onRetrySync={onRetrySync}
          onApplyHighlightColor={onApplyHighlightColor}
          onScrollToSection={onScrollToSection}
          onSetSelectedNoteId={onSetSelectedNoteId}
          isPro={isPro}
          proPanelNotesOpen={proPanelNotesOpen}
          onToggleProNotesPanel={onToggleProNotesPanel}
          onStartProPreview={onStartProPreview}
          syncStatusLabel={syncStatusLabel}
          syncButtonLabel={syncButtonLabel}
        />
      ) : null}
    </div>
  );
});

type NoteLibraryViewProps = {
  isMobileViewport: boolean;
  filteredNotes: WorkspaceNote[];
  recentNotes: WorkspaceNote[];
  selectedNoteId: string | null;
  notesSearch: string;
  onSetNotesSearch: (value: string) => void;
  notesCategoryFilter: "all" | NoteCategory;
  onSetNotesCategoryFilter: (value: "all" | NoteCategory) => void;
  hasLockedNotesHistory: boolean;
  noteUndoItem: WorkspaceNote | null;
  isPro: boolean;
  syncStatusLabel: string;
  onCreateNote: () => void | Promise<void>;
  onOpenNote: (noteId: string) => void | Promise<void>;
  onTogglePinned: (noteId: string) => void | Promise<void>;
  onUndoDelete: () => void | Promise<void>;
};

type NoteLibraryCollectionProps = {
  title: string;
  description: string;
  notes: WorkspaceNote[];
  selectedNoteId: string | null;
  defaultOpen?: boolean;
  onOpenNote: (noteId: string) => void | Promise<void>;
  onTogglePinned: (noteId: string) => void | Promise<void>;
};

function NoteLibraryCollection({
  title,
  description,
  notes,
  selectedNoteId,
  defaultOpen = false,
  onOpenNote,
  onTogglePinned,
}: NoteLibraryCollectionProps) {
  return (
    <details className={styles.noteLibrarySection} open={defaultOpen}>
      <summary className={styles.noteLibrarySectionSummary}>
        <span>
          <span className={styles.noteLibrarySectionTitle}>{title}</span>
          <span className={styles.noteLibrarySectionMeta}>{description}</span>
        </span>
        <span className={styles.noteLibrarySectionCount}>{notes.length}</span>
      </summary>
      <div className={styles.noteLibraryGrid}>
        {notes.length === 0 ? (
          <p className={sharedStyles.emptyText}>Nothing here yet.</p>
        ) : (
          notes.map((note) => {
            const preview = notePlainTextPreview(note.body);
            const wordCount = countWords(note.body);
            return (
              <article
                key={note.id}
                className={`${styles.noteLibraryCard} ${
                  selectedNoteId === note.id ? styles.noteLibraryCardActive : ""
                }`}
                style={notePreviewStyle(note.shellColor || "#fff7d6")}
                data-note-fill={note.surfaceStyle ?? "solid"}
              >
                <button
                  type="button"
                  className={styles.noteLibraryCardBody}
                  onClick={() => void onOpenNote(note.id)}
                >
                  <div className={styles.noteLibraryCardHeader}>
                    <span className={styles.noteLibraryCardEyebrow}>
                      {(note.category || "personal").toUpperCase()}
                    </span>
                    {note.attachments.length > 0 ? (
                      <span className={sharedStyles.attachmentIndicatorChip}>
                        {attachmentIndicatorLabel(note.attachments.length)}
                      </span>
                    ) : null}
                  </div>
                  <strong className={styles.noteLibraryCardTitle}>
                    {note.title || "Untitled note"}
                  </strong>
                  <p className={styles.noteLibraryCardPreview}>
                    {preview || "Open this note and start writing."}
                  </p>
                  <div className={styles.noteLibraryCardFooter}>
                    <span>
                      {new Date(note.updatedAtISO).toLocaleDateString()}
                    </span>
                    <span>
                      {wordCount} word{wordCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  className={styles.noteLibraryPinButton}
                  onClick={() => void onTogglePinned(note.id)}
                  title={note.isPinned ? "Unpin note" : "Pin note"}
                  aria-label={note.isPinned ? "Unpin note" : "Pin note"}
                >
                  {note.isPinned ? "★" : "☆"}
                </button>
              </article>
            );
          })
        )}
      </div>
    </details>
  );
}

const NoteLibraryView = memo(function NoteLibraryView({
  isMobileViewport,
  filteredNotes,
  recentNotes,
  selectedNoteId,
  notesSearch,
  onSetNotesSearch,
  notesCategoryFilter,
  onSetNotesCategoryFilter,
  hasLockedNotesHistory,
  noteUndoItem,
  isPro,
  syncStatusLabel,
  onCreateNote,
  onOpenNote,
  onTogglePinned,
  onUndoDelete,
}: NoteLibraryViewProps) {
  const pinnedNotes = filteredNotes.filter((note) => note.isPinned);
  const draftNotes = filteredNotes.filter((note) => isDraftNote(note) && !isInboxNote(note));
  const inboxNotes = filteredNotes.filter((note) => isInboxNote(note) && !note.isPinned);

  return (
    <section className={styles.notesLibraryShell}>
      <header className={styles.notesLibraryHero}>
        <div>
          <p className={sharedStyles.sectionLabel}>Writing Library</p>
          <h2 className={styles.notesLibraryTitle}>Your notes, all in one place.</h2>
          <p className={styles.notesLibraryCopy}>
            Search, reopen recent work, and keep drafts, inbox captures, and deleted notes close by.
          </p>
        </div>
        <div className={styles.notesLibraryHeaderActions}>
          <span className={styles.notesLibrarySyncChip}>{syncStatusLabel}</span>
          <button
            type="button"
            data-tour="notes-create"
            className={sharedStyles.newNoteButton}
            onClick={() => void onCreateNote()}
          >
            New note
          </button>
        </div>
      </header>

      <div className={styles.notesLibraryToolbar}>
        <input
          value={notesSearch}
          onChange={(event) => onSetNotesSearch(event.target.value)}
          placeholder="Search notes"
          className={styles.notesSearchInput}
        />
        <select
          className={styles.noteToolSelect}
          value={notesCategoryFilter}
          onChange={(event) => onSetNotesCategoryFilter(event.target.value as "all" | NoteCategory)}
        >
          <option value="all">All categories</option>
          <option value="personal">Personal</option>
          <option value="school">School</option>
          <option value="work">Work</option>
        </select>
      </div>

      <div className={styles.notesLibraryCollections}>
        <NoteLibraryCollection
          title={isMobileViewport ? "Recent notes" : "Continue writing"}
          description="Your latest notes, surfaced for quick re-entry."
          notes={recentNotes.slice(0, 4)}
          selectedNoteId={selectedNoteId}
          defaultOpen
          onOpenNote={onOpenNote}
          onTogglePinned={onTogglePinned}
        />
        <NoteLibraryCollection
          title="All notes"
          description="The full writing shelf, shown as large document cards."
          notes={filteredNotes}
          selectedNoteId={selectedNoteId}
          onOpenNote={onOpenNote}
          onTogglePinned={onTogglePinned}
        />
        <NoteLibraryCollection
          title="Pinned"
          description="Important notes that should stay visible."
          notes={pinnedNotes}
          selectedNoteId={selectedNoteId}
          onOpenNote={onOpenNote}
          onTogglePinned={onTogglePinned}
        />
        <NoteLibraryCollection
          title="Drafts"
          description="Notes with enough substance to shape further."
          notes={draftNotes}
          selectedNoteId={selectedNoteId}
          onOpenNote={onOpenNote}
          onTogglePinned={onTogglePinned}
        />
        <NoteLibraryCollection
          title="Inbox"
          description="Quick captures and rough starts that still need shape."
          notes={inboxNotes}
          selectedNoteId={selectedNoteId}
          onOpenNote={onOpenNote}
          onTogglePinned={onTogglePinned}
        />

        {noteUndoItem ? (
          <details className={styles.noteLibrarySection}>
            <summary className={styles.noteLibrarySectionSummary}>
              <span>
                <span className={styles.noteLibrarySectionTitle}>Recently deleted</span>
                <span className={styles.noteLibrarySectionMeta}>The last removed note can still be restored.</span>
              </span>
              <span className={styles.noteLibrarySectionCount}>1</span>
            </summary>
            <div className={styles.noteLibraryDeletedCard}>
              <div>
                <strong>{noteUndoItem.title || "Untitled note"}</strong>
                <p className={styles.noteLibraryDeletedCopy}>
                  {notePlainTextPreview(noteUndoItem.body) || "Deleted before any body text was saved."}
                </p>
              </div>
              <button
                type="button"
                className={sharedStyles.secondaryPlanButton}
                onClick={() => void onUndoDelete()}
              >
                Restore note
              </button>
            </div>
          </details>
        ) : null}
      </div>

      {!isPro && hasLockedNotesHistory ? (
        <p className={styles.notesLibraryLockedHint}>
          {WHELM_STANDARD_NAME} keeps the last {WHELM_STANDARD_HISTORY_DAYS} days visible in the library.
          {` ${WHELM_PRO_NAME} keeps the older archive ready when you need it.`}
        </p>
      ) : null}
    </section>
  );
});

export default function NotesTab({
  sectionRef,
  notesSurface,
  onSetNotesSurface,
  uid,
  onCardsXPEarned,
  isMobileViewport,
  notes: _notes,
  selectedNoteId,
  selectedNote,
  filteredNotes,
  recentNotes,
  selectedNoteWordCount,
  hasLockedNotesHistory,
  noteUndoItem,
  resolvedTheme,
  selectedNoteSurfaceColor,
  selectedNotePageColor,
  xpTierTheme,
  streakBandanaTier,
  bandanaColor,
  notesSearch,
  onSetNotesSearch,
  notesCategoryFilter,
  onSetNotesCategoryFilter,
  mobileNotesRecentOpen,
  onSetMobileNotesRecentOpen,
  mobileNotesEditorOpen,
  onSetMobileNotesEditorOpen,
  mobileNotesToolsOpen,
  onSetMobileNotesToolsOpen,
  colorPickerOpen,
  onSetColorPickerOpen,
  shellColorPickerOpen,
  onSetShellColorPickerOpen,
  textColorPickerOpen,
  onSetTextColorPickerOpen,
  highlightPickerOpen,
  onSetHighlightPickerOpen,
  editorBandanaCaret,
  onSetEditorBandanaCaret,
  notesSyncStatus,
  notesSyncMessage,
  noteAttachmentBusy,
  noteAttachmentStatus,
  pendingNoteAttachments,
  noteAttachmentInputRef,
  notesStartRef,
  notesRecentRef,
  notesEditorRef,
  editorRef,
  noteBodyShellRef,
  onNoteAttachmentInput,
  onOpenAttachmentPicker,
  onOpenNoteAttachment,
  onRemoveNoteAttachment,
  onConvertNoteToBlock,
  onDeleteNote,
  onUndoDelete,
  onCreateNote,
  onTogglePinned,
  onUpdateSelectedNote,
  onFlushPendingTitleSync,
  onCaptureEditorDraft,
  onSaveEditorSelection,
  onApplyEditorCommand,
  onCheckEditorSelection,
  onUpdateEditorBandanaCaret,
  onFlushNoteDraft,
  onMobileCreateNote,
  onOpenMobileEditor,
  onOpenCurrentMobileNote,
  onRetrySync,
  onApplyHighlightColor,
  onScrollToSection,
  onSetSelectedNoteId,
  isPro,
  proPanelNotesOpen,
  onToggleProNotesPanel,
  onStartProPreview,
  onOpenUpgradeFlow,
}: NotesTabProps) {
  const [desktopNoteToolsOpen, setDesktopNoteToolsOpen] = useState(false);
  const syncStatusLabel =
    notesSyncStatus === "synced"
      ? "Synced to your account."
      : notesSyncStatus === "syncing"
        ? "Saving in background..."
        : "Using local notes while cloud sync catches up.";
  const syncButtonLabel = notesSyncStatus === "synced" ? "Sync now" : "Retry sync";
  const openLibraryNote = (noteId: string) => {
    if (isMobileViewport) {
      return onOpenMobileEditor(noteId);
    }

    return (async () => {
      await onFlushNoteDraft();
      onSetSelectedNoteId(noteId);
    })();
  };
  const showLibraryView = !selectedNote || (isMobileViewport && !mobileNotesEditorOpen);

  useEffect(() => {
    setDesktopNoteToolsOpen(false);
  }, [isMobileViewport, selectedNoteId, showLibraryView]);

  return (
    <AnimatedTabSection className={styles.notesWorkspace} sectionRef={sectionRef}>
      <input
        ref={noteAttachmentInputRef}
        type="file"
        multiple
        accept={NOTE_ATTACHMENT_ACCEPT}
        className={styles.hiddenAttachmentInput}
        onChange={onNoteAttachmentInput}
      />
      {!isMobileViewport ? (
        <div className={`${sharedStyles.cardsHeader} ${styles.notesFullWidth}`}>
          <div>
            <p className={sharedStyles.sectionLabel}>Notes + Cards</p>
            <h2 className={sharedStyles.cardTitle}>Your writing studio</h2>
            <p className={sharedStyles.accountMeta}>
              Write freely, then turn your notes into flashcards for spaced-repetition review.
            </p>
          </div>
          <div className={sharedStyles.cardsHeaderActions}>
            <button
              type="button"
              className={
                notesSurface === "notes" ? sharedStyles.reportButton : sharedStyles.secondaryPlanButton
              }
              onClick={() => onSetNotesSurface("notes")}
            >
              Notes
            </button>
            <button
              type="button"
              data-tour="notes-cards-toggle"
              className={
                notesSurface === "cards" ? sharedStyles.reportButton : sharedStyles.secondaryPlanButton
              }
              onClick={() => onSetNotesSurface("cards")}
            >
              Cards
            </button>
          </div>
        </div>
      ) : null}
      {notesSurface === "cards" ? (
        <div className={styles.notesFullWidth}>
          <CardsTab uid={uid} onXPEarned={onCardsXPEarned} />
        </div>
      ) : (
        <>
          {showLibraryView ? (
            <div className={styles.notesFullWidth}>
              <NoteLibraryView
                isMobileViewport={isMobileViewport}
                filteredNotes={filteredNotes}
                recentNotes={recentNotes}
                selectedNoteId={selectedNoteId}
                notesSearch={notesSearch}
                onSetNotesSearch={onSetNotesSearch}
                notesCategoryFilter={notesCategoryFilter}
                onSetNotesCategoryFilter={onSetNotesCategoryFilter}
                hasLockedNotesHistory={hasLockedNotesHistory}
                noteUndoItem={noteUndoItem}
                isPro={isPro}
                syncStatusLabel={syncStatusLabel}
                onCreateNote={isMobileViewport ? onMobileCreateNote : onCreateNote}
                onOpenNote={openLibraryNote}
                onTogglePinned={onTogglePinned}
                onUndoDelete={onUndoDelete}
              />
            </div>
          ) : null}

          {isMobileViewport && !showLibraryView && selectedNote ? (
            <MobileNoteEditorCard
              selectedNote={selectedNote}
              selectedNoteWordCount={selectedNoteWordCount}
              resolvedTheme={resolvedTheme}
              selectedNoteSurfaceColor={selectedNoteSurfaceColor}
              selectedNotePageColor={selectedNotePageColor}
              xpTierTheme={xpTierTheme}
              streakBandanaTier={streakBandanaTier}
              mobileNotesToolsOpen={mobileNotesToolsOpen}
              onSetMobileNotesToolsOpen={onSetMobileNotesToolsOpen}
              colorPickerOpen={colorPickerOpen}
              onSetColorPickerOpen={onSetColorPickerOpen}
              shellColorPickerOpen={shellColorPickerOpen}
              onSetShellColorPickerOpen={onSetShellColorPickerOpen}
              textColorPickerOpen={textColorPickerOpen}
              onSetTextColorPickerOpen={onSetTextColorPickerOpen}
              highlightPickerOpen={highlightPickerOpen}
              onSetHighlightPickerOpen={onSetHighlightPickerOpen}
              editorBandanaCaret={editorBandanaCaret}
              onSetEditorBandanaCaret={onSetEditorBandanaCaret}
              mobileNotesEditorOpen={mobileNotesEditorOpen}
              onSetMobileNotesEditorOpen={onSetMobileNotesEditorOpen}
              notesSyncStatus={notesSyncStatus}
              notesSyncMessage={notesSyncMessage}
              noteAttachmentBusy={noteAttachmentBusy}
              noteAttachmentStatus={noteAttachmentStatus}
              pendingNoteAttachments={pendingNoteAttachments}
              notesEditorRef={notesEditorRef}
              editorRef={editorRef}
              noteBodyShellRef={noteBodyShellRef}
              onOpenAttachmentPicker={onOpenAttachmentPicker}
              onOpenNoteAttachment={onOpenNoteAttachment}
              onRemoveNoteAttachment={onRemoveNoteAttachment}
              onConvertNoteToBlock={onConvertNoteToBlock}
              onDeleteNote={onDeleteNote}
              onUpdateSelectedNote={onUpdateSelectedNote}
              onFlushPendingTitleSync={onFlushPendingTitleSync}
              onCaptureEditorDraft={onCaptureEditorDraft}
              onSaveEditorSelection={onSaveEditorSelection}
              onApplyEditorCommand={onApplyEditorCommand}
              onCheckEditorSelection={onCheckEditorSelection}
              onUpdateEditorBandanaCaret={onUpdateEditorBandanaCaret}
              onFlushNoteDraft={onFlushNoteDraft}
              onRetrySync={onRetrySync}
              onApplyHighlightColor={onApplyHighlightColor}
              onSetSelectedNoteId={onSetSelectedNoteId}
              isPro={isPro}
              proPanelNotesOpen={proPanelNotesOpen}
              onToggleProNotesPanel={onToggleProNotesPanel}
              onStartProPreview={onStartProPreview}
              syncStatusLabel={syncStatusLabel}
              syncButtonLabel={syncButtonLabel}
              onMobileCreateNote={onMobileCreateNote}
              onOpenMobileEditor={onOpenMobileEditor}
              onOpenCurrentMobileNote={onOpenCurrentMobileNote}
              onScrollToSection={onScrollToSection}
            />
          ) : null}

          {!isMobileViewport && !showLibraryView && (
            <motion.article
              className={styles.notesEditorCard}
              style={notesShellBackground(
                resolvedTheme,
                selectedNoteSurfaceColor,
                selectedNotePageColor,
                xpTierTheme.accent,
                xpTierTheme.accentStrong,
                xpTierTheme.accentGlow,
              )}
              data-note-fill={selectedNote?.surfaceStyle ?? "solid"}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              {!selectedNote ? (
                <div className={styles.notesEmptyEditor}>
                  <SenseiFigure
                    variant="scholar"
                    bandanaColor={bandanaColor}
                    size="inline"
                    message="Start with one idea worth keeping."
                    className={styles.notesEmptySensei}
                  />
                  <p>Start by creating your first note.</p>
                </div>
              ) : (
                <>
                  <div className={styles.notesStudioHero}>
                    <div>
                      <p className={sharedStyles.sectionLabel}>Writing Studio</p>
                      <h2 className={styles.notesEditorTitle}>
                        {selectedNote.title || "Untitled note"}
                      </h2>
                      <p className={styles.noteStudioCopy}>
                        Cleaner writing surface. Less chrome, more thought.
                      </p>
                    </div>
                    <div className={styles.noteColorRow}>
                      <div className={styles.noteEditorHeaderActions}>
                        <button
                          type="button"
                          className={styles.noteBackButton}
                          onClick={() => {
                            void (async () => {
                              await onFlushNoteDraft();
                              onSetSelectedNoteId(null);
                            })();
                          }}
                        >
                          Back to library
                        </button>
                        <div className={styles.noteToneControlRow}>
                        {isPro ? (
                            <div className={styles.noteFillModeSwitch}>
                              <button
                                type="button"
                                className={`${styles.noteFillModeButton} ${
                                  selectedNote.surfaceStyle === "solid" ? styles.noteFillModeButtonActive : ""
                                }`}
                                onClick={() => void onUpdateSelectedNote({ surfaceStyle: "solid" })}
                              >
                                Solid
                              </button>
                              <button
                                type="button"
                                className={`${styles.noteFillModeButton} ${
                                  selectedNote.surfaceStyle === "airy" ? styles.noteFillModeButtonActive : ""
                                }`}
                                onClick={() => void onUpdateSelectedNote({ surfaceStyle: "airy" })}
                              >
                                Airy
                              </button>
                            </div>
                        ) : null}
                        <div className={styles.noteTonePopoverAnchor}>
                          <button
                            type="button"
                            className={`${styles.noteColorPickerTrigger} ${styles.noteToneButton}`}
                            style={
                              { ["--note-tone-color" as const]: selectedNote.color || "#e7e5e4" } as CSSProperties
                            }
                            onClick={() => {
                              onSetColorPickerOpen((open) => !open);
                              onSetShellColorPickerOpen(false);
                              onSetTextColorPickerOpen(false);
                              onSetHighlightPickerOpen(false);
                            }}
                          >
                            <span className={styles.noteToneButtonLabel}>Page tone</span>
                            <span className={styles.noteColorPickerPreview}>
                              <span
                                className={styles.noteColorPickerPreviewFill}
                                style={{ backgroundColor: selectedNote.color || "#e7e5e4" }}
                              />
                            </span>
                          </button>
                          {colorPickerOpen && (
                            <div className={styles.noteColorPickerPopover}>
                              {(isPro ? NOTE_COLORS : STANDARD_NOTE_COLORS).map((color) => (
                                <button
                                  type="button"
                                  key={color.value}
                                  className={`${styles.noteColorSwatch} ${
                                    selectedNote.color === color.value ? styles.noteColorSwatchActive : ""
                                  }`}
                                  style={{ backgroundColor: color.value }}
                                  title={color.label}
                                  onClick={() => {
                                    void onUpdateSelectedNote({ color: color.value });
                                    onSetColorPickerOpen(false);
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        {isPro ? (
                            <div className={styles.noteTonePopoverAnchor}>
                              <button
                                type="button"
                                className={`${styles.noteColorPickerTrigger} ${styles.noteShellButton}`}
                                style={
                                  { ["--note-tone-color" as const]: selectedNote.shellColor || "#fff7d6" } as CSSProperties
                                }
                                onClick={() => {
                                  onSetShellColorPickerOpen((open) => !open);
                                  onSetColorPickerOpen(false);
                                  onSetTextColorPickerOpen(false);
                                  onSetHighlightPickerOpen(false);
                                }}
                              >
                                <span className={styles.noteToneButtonLabel}>Notebook color</span>
                                <span className={styles.noteColorPickerPreview}>
                                  <span
                                    className={styles.noteColorPickerPreviewFill}
                                    style={{ backgroundColor: selectedNote.shellColor || "#fff7d6" }}
                                  />
                                </span>
                              </button>
                              {shellColorPickerOpen && (
                                <div className={styles.noteColorPickerPopover}>
                                  {NOTE_COLORS.map((color) => (
                                    <button
                                      type="button"
                                      key={color.value}
                                      className={`${styles.noteColorSwatch} ${
                                        selectedNote.shellColor === color.value ? styles.noteColorSwatchActive : ""
                                      }`}
                                      style={{ backgroundColor: color.value }}
                                      title={color.label}
                                      onClick={() => {
                                        void onUpdateSelectedNote({ shellColor: color.value });
                                        onSetShellColorPickerOpen(false);
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                        ) : null}
                      </div>
                      </div>
                      {!isPro ? (
                        <ProUnlockCard
                          title="Full note styling"
                          body={`${WHELM_STANDARD_NAME} keeps a focused page-tone palette. ${WHELM_PRO_NAME} adds notebook color, surface styling, custom fonts, text colors, and highlights.`}
                          open={proPanelNotesOpen}
                          onToggle={onToggleProNotesPanel}
                          onPreview={onStartProPreview}
                          preview={
                            <div className={styles.noteStylePreview}>
                              <div className={styles.noteStylePreviewToolbar}>
                                <span className={styles.noteStylePreviewChip}>Page tone</span>
                                <span className={styles.noteStylePreviewChip}>Editorial</span>
                                <span className={styles.noteStylePreviewChip}>Text color</span>
                              </div>
                              <article className={styles.noteStylePreviewCard}>
                                <p className={styles.noteStylePreviewEyebrow}>Whelm Pro Writing Studio</p>
                                <h3>Notes stop looking generic.</h3>
                                <p>
                                  Let page tone, typography, and highlights carry the mood of the idea instead of
                                  leaving every note on the same flat surface.
                                </p>
                                <p>
                                  <mark>Let the page itself sell the feature.</mark>
                                </p>
                              </article>
                            </div>
                          }
                        />
                      ) : null}
                    </div>
                  </div>

                    <input
                      value={selectedNote.title}
                      onChange={(event) => {
                        void onUpdateSelectedNote({ title: event.target.value });
                      }}
                      onBlur={() => {
                        void onFlushPendingTitleSync();
                      }}
                      placeholder="Note title"
                      className={styles.noteTitleInput}
                    />

                  <div className={styles.noteMetaRow}>
                    <label className={styles.noteMetaLabel}>
                      Category
                      <select
                        className={styles.noteToolSelect}
                        value={selectedNote.category || "personal"}
                        onChange={(event) =>
                          void onUpdateSelectedNote({
                            category: event.target.value as NoteCategory,
                          })
                        }
                      >
                        <option value="personal">Personal</option>
                        <option value="school">School</option>
                        <option value="work">Work</option>
                      </select>
                    </label>
                    <label className={styles.noteMetaLabel}>
                      Reminder
                      <input
                        type="datetime-local"
                        className={sharedStyles.planControl}
                        value={
                          selectedNote.reminderAtISO
                            ? new Date(selectedNote.reminderAtISO)
                                .toISOString()
                                .slice(0, 16)
                            : ""
                        }
                        onChange={(event) =>
                          void onUpdateSelectedNote({
                            reminderAtISO: event.target.value
                              ? new Date(event.target.value).toISOString()
                              : "",
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className={styles.noteEditorQuickActions}>
                    {NOTE_PRIMARY_TOOLBAR_ITEMS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`${styles.noteToolButton} ${
                          desktopNoteToolsOpen ? styles.noteToolButtonActive : ""
                        }`}
                        onClick={() => setDesktopNoteToolsOpen((open) => !open)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>

                  {isPro && desktopNoteToolsOpen ? (
                    <div className={styles.noteEditorToolbar}>
                      <div className={styles.noteToolbarSection}>
                        <span className={styles.noteToolbarLabel}>Typography</span>
                        <div className={styles.noteToolbarGroup}>
                          <select
                            className={styles.noteToolSelect}
                            value={selectedNote.fontFamily}
                            onChange={(event) => {
                              const nextFont = event.target.value;
                              void onUpdateSelectedNote({ fontFamily: nextFont });
                            }}
                          >
                            {NOTE_FONTS.map((font) => (
                              <option key={font.label} value={font.value}>
                                {font.label}
                              </option>
                            ))}
                          </select>
                          <select
                            className={styles.noteToolSelect}
                            value={String(selectedNote.fontSizePx)}
                            onChange={(event) => {
                              const nextSize = Number(event.target.value);
                              void onUpdateSelectedNote({ fontSizePx: nextSize });
                            }}
                          >
                            {NOTE_FONT_SIZES.map((size) => (
                              <option key={size.value} value={size.value}>
                                {size.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className={styles.noteBodyShell} ref={noteBodyShellRef}>
                    <textarea
                      ref={editorRef}
                      className={styles.noteBodyInput}
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="off"
                      data-gramm="false"
                      data-gramm_editor="false"
                      data-enable-grammarly="false"
                      style={{
                        fontFamily: selectedNote.fontFamily,
                        fontSize: `${selectedNote.fontSizePx}px`,
                      }}
                    onInput={() => {
                      onCaptureEditorDraft();
                    }}
                    onKeyUp={(event) => {
                      if (
                        event.shiftKey ||
                        event.metaKey ||
                        event.ctrlKey ||
                        event.altKey ||
                        NOTE_SELECTION_KEYS.has(event.key)
                      ) {
                        onSaveEditorSelection();
                        onUpdateEditorBandanaCaret();
                        onCheckEditorSelection();
                      }
                      }}
                      onPaste={() => {
                        window.setTimeout(() => {
                          onCaptureEditorDraft();
                          onSaveEditorSelection();
                        }, 0);
                      }}
                      onCompositionEnd={() => {
                        onSaveEditorSelection();
                      }}
                      onBlur={() => {
                        onCaptureEditorDraft();
                        void onFlushNoteDraft();
                        onSetEditorBandanaCaret((current) =>
                          current.visible ? { ...current, visible: false } : current,
                        );
                      }}
                      onPointerUp={() => {
                        onSaveEditorSelection();
                        onCheckEditorSelection();
                      }}
                      onFocus={() => {
                        onSaveEditorSelection();
                      }}
                    />
                    <div className={styles.noteEditorFooter}>
                      <NoteAttachmentsSection
                        note={selectedNote}
                        pendingUploads={pendingNoteAttachments}
                        uploadBusy={noteAttachmentBusy}
                        uploadStatus={noteAttachmentStatus}
                        onAttach={onOpenAttachmentPicker}
                        onOpen={onOpenNoteAttachment}
                        onRemove={(attachment) => void onRemoveNoteAttachment(attachment)}
                      />
                      <span className={styles.noteSyncIndicator}>{syncStatusLabel}</span>
                      {notesSyncStatus === "local-only" ? (
                        <button
                          type="button"
                          className={sharedStyles.retrySyncButton}
                          onClick={() => void onRetrySync()}
                        >
                          {syncButtonLabel}
                        </button>
                      ) : null}
                      <span className={styles.noteWordCount}>
                        {selectedNoteWordCount} word{selectedNoteWordCount === 1 ? "" : "s"}
                        {selectedNoteWordCount >= 33 ? " · streak writing met" : ""}
                      </span>
                      <div className={sharedStyles.noteFooterActions}>
                        <button
                          type="button"
                          className={`${sharedStyles.reportButton} ${sharedStyles.blockActionButton}`}
                          onClick={() => {
                            void (async () => {
                              await onFlushNoteDraft();
                              await onConvertNoteToBlock(selectedNote.id);
                            })();
                          }}
                        >
                          Turn into block
                        </button>
                        <button
                          type="button"
                          className={sharedStyles.retrySyncButton}
                          onClick={() => void onRetrySync()}
                        >
                          {syncButtonLabel}
                        </button>
                        <button type="button" className={sharedStyles.deleteNoteButton} onClick={() => void onDeleteNote(selectedNote.id)}>
                          Remove note
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.article>
          )}
        </>
      )}
    </AnimatedTabSection>
  );
}
