"use client";

import {
  type CSSProperties,
  type ChangeEvent,
  type Ref,
  type RefObject,
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
  editorRef: RefObject<HTMLDivElement | null>;
  noteBodyShellRef: RefObject<HTMLDivElement | null>;
  // Handlers
  onNoteAttachmentInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenAttachmentPicker: () => void;
  onOpenNoteAttachment: (attachment: NoteAttachment) => void;
  onRemoveNoteAttachment: (attachment: NoteAttachment) => void;
  onConvertNoteToBlock: (noteId: string) => void | Promise<void>;
  onDeleteNote: (noteId: string) => void | Promise<void>;
  onCreateNote: () => void;
  onTogglePinned: (noteId: string) => void;
  onUpdateSelectedNote: (patch: Partial<WorkspaceNote>) => void;
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
  onCreateNote,
  onTogglePinned,
  onUpdateSelectedNote,
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
  const syncStatusLabel =
    notesSyncStatus === "synced"
      ? "Synced to your account."
      : notesSyncStatus === "syncing"
        ? "Saving in background..."
        : "Using local notes while cloud sync catches up.";
  const syncButtonLabel = notesSyncStatus === "synced" ? "Sync now" : "Retry sync";

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
      {notesSurface === "cards" ? (
        <div className={styles.notesFullWidth}>
          <CardsTab uid={uid} onXPEarned={onCardsXPEarned} />
        </div>
      ) : (
        <>
          {isMobileViewport && <div className={styles.mobileNotesPanel}>
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
                    {filteredNotes.map((note) => (
                      (() => {
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
                      })()
                    ))}
                    {filteredNotes.length === 0 && (
                      <p className={sharedStyles.emptyText}>No notes yet. Start your first one.</p>
                    )}
                  </div>
                </>
              )}
            </article>

            {mobileNotesEditorOpen && selectedNote ? (
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
                          {isPro && shellColorPickerOpen && (
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
                  <button
                    type="button"
                    className={`${sharedStyles.mobileControlToggle} ${
                      mobileNotesToolsOpen === "format" ? sharedStyles.mobileControlToggleActive : ""
                    }`}
                    onClick={() =>
                      onSetMobileNotesToolsOpen((current) => (current === "format" ? null : "format"))
                    }
                  >
                    Format
                  </button>
                  <button
                    type="button"
                    className={`${sharedStyles.mobileControlToggle} ${
                      mobileNotesToolsOpen === "type" ? sharedStyles.mobileControlToggleActive : ""
                    }`}
                    disabled={!isPro}
                    onClick={() =>
                      onSetMobileNotesToolsOpen((current) => (current === "type" ? null : "type"))
                    }
                  >
                    Type
                  </button>
                  <button
                    type="button"
                    className={`${sharedStyles.mobileControlToggle} ${
                      mobileNotesToolsOpen === "color" ? sharedStyles.mobileControlToggleActive : ""
                    }`}
                    disabled={!isPro}
                    onClick={() =>
                      onSetMobileNotesToolsOpen((current) => (current === "color" ? null : "color"))
                    }
                  >
                    Color
                  </button>
                </div>

                {mobileNotesToolsOpen === "format" && (
                  <div className={sharedStyles.mobileToolPanel}>
                    <button
                      type="button"
                      className={styles.noteToolButton}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onSaveEditorSelection();
                      }}
                      onClick={() => onApplyEditorCommand("bold")}
                    >
                      Bold
                    </button>
                    <button
                      type="button"
                      className={styles.noteToolButton}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onSaveEditorSelection();
                      }}
                      onClick={() => onApplyEditorCommand("italic")}
                    >
                      Italic
                    </button>
                    <button
                      type="button"
                      className={styles.noteToolButton}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onSaveEditorSelection();
                      }}
                      onClick={() => onApplyEditorCommand("underline")}
                    >
                      Underline
                    </button>
                    <button
                      type="button"
                      className={styles.noteToolButton}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onSaveEditorSelection();
                      }}
                      onClick={() => onApplyEditorCommand("insertUnorderedList")}
                    >
                      Bullet
                    </button>
                    <button
                      type="button"
                      className={styles.noteToolButton}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onSaveEditorSelection();
                      }}
                      onClick={() => onApplyEditorCommand("formatBlock", "H1")}
                    >
                      H1
                    </button>
                    <button
                      type="button"
                      className={styles.noteToolButton}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onSaveEditorSelection();
                      }}
                      onClick={() => onApplyEditorCommand("formatBlock", "H2")}
                    >
                      H2
                    </button>
                  </div>
                )}

                {mobileNotesToolsOpen === "type" && (
                  <div className={sharedStyles.mobileToolPanel}>
                    <select
                      className={styles.noteToolSelect}
                      value={selectedNote.fontFamily}
                      onMouseDown={() => onSaveEditorSelection()}
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
                      onMouseDown={() => onSaveEditorSelection()}
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
                )}

                {mobileNotesToolsOpen === "color" && (
                  <div className={sharedStyles.mobileToolPanel}>
                    <button
                      type="button"
                      className={styles.noteToolButton}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onSaveEditorSelection();
                      }}
                      onClick={() => {
                        onSetTextColorPickerOpen((open) => !open);
                        onSetHighlightPickerOpen(false);
                      }}
                    >
                      Text color
                    </button>
                    <button
                      type="button"
                      className={styles.noteToolButton}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        onSaveEditorSelection();
                      }}
                      onClick={() => {
                        onSetHighlightPickerOpen((open) => !open);
                        onSetTextColorPickerOpen(false);
                      }}
                    >
                      Highlight
                    </button>
                    {textColorPickerOpen && (
                      <div className={styles.noteInlinePalettePopover}>
                        {NOTE_TEXT_COLORS.map((color) => (
                          <button
                            type="button"
                            key={color.value}
                            className={styles.noteInlineSwatch}
                            style={{ backgroundColor: color.value }}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              onSaveEditorSelection();
                            }}
                            onClick={() => {
                              onApplyEditorCommand("foreColor", color.value);
                              onSetTextColorPickerOpen(false);
                            }}
                          />
                        ))}
                      </div>
                    )}
                    {highlightPickerOpen && (
                      <div className={styles.noteInlinePalettePopover}>
                        {NOTE_HIGHLIGHTS.map((color) => (
                          <button
                            type="button"
                            key={color.value}
                            className={styles.noteInlineSwatch}
                            style={{ backgroundColor: color.value }}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              onSaveEditorSelection();
                            }}
                            onClick={() => {
                              onApplyHighlightColor(color.value);
                              onSetHighlightPickerOpen(false);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
                  placeholder="Note title"
                  className={styles.noteTitleInput}
                />
                <div className={styles.noteBodyShell} ref={noteBodyShellRef}>
                  {notesSyncStatus === "local-only" ? (
                    <div className={styles.noteSyncInlineNotice} role="status" aria-live="polite">
                      <span className={styles.noteSyncInlineDot} />
                      <span>
                        Saved locally — cloud sync pending.
                        {notesSyncMessage ? ` ${notesSyncMessage}` : ""}
                      </span>
                      <button
                        type="button"
                        className={sharedStyles.retrySyncButton}
                        style={{ marginLeft: 8 }}
                        onClick={() => void onRetrySync()}
                      >
                        {syncButtonLabel}
                      </button>
                    </div>
                  ) : null}
                  <div
                    ref={editorRef}
                    className={styles.noteBodyInput}
                    contentEditable
                    suppressContentEditableWarning
                    style={{
                      fontFamily: selectedNote.fontFamily,
                      fontSize: `${selectedNote.fontSizePx}px`,
                    }}
                    onInput={() => {
                      onCaptureEditorDraft();
                      onSaveEditorSelection();
                      onUpdateEditorBandanaCaret();
                    }}
                    onKeyUp={() => {
                      onCaptureEditorDraft();
                      onSaveEditorSelection();
                      onUpdateEditorBandanaCaret();
                      onCheckEditorSelection();
                    }}
                    onPaste={() => {
                      window.setTimeout(() => {
                        onCaptureEditorDraft();
                        onSaveEditorSelection();
                        onUpdateEditorBandanaCaret();
                      }, 0);
                    }}
                    onCompositionEnd={() => {
                      onCaptureEditorDraft();
                      onSaveEditorSelection();
                      onUpdateEditorBandanaCaret();
                    }}
                    onBlur={() => {
                      onCaptureEditorDraft();
                      onSetEditorBandanaCaret((current) =>
                        current.visible ? { ...current, visible: false } : current,
                      );
                    }}
                    onMouseUp={() => {
                      onSaveEditorSelection();
                      onUpdateEditorBandanaCaret();
                      onCheckEditorSelection();
                    }}
                    onFocus={() => {
                      onSaveEditorSelection();
                      onUpdateEditorBandanaCaret();
                    }}
                    onScroll={() => onUpdateEditorBandanaCaret()}
                  />
                  {editorBandanaCaret.visible ? (
                    <img
                      className={styles.noteBandanaCaret}
                      src={bandanaCursorAssetPath(streakBandanaTier?.color, 256)}
                      srcSet={`${bandanaCursorAssetPath(streakBandanaTier?.color, 256)} 1x`}
                      alt=""
                      style={{
                        left: `${editorBandanaCaret.left}px`,
                        top: `${editorBandanaCaret.top}px`,
                      }}
                    />
                  ) : null}
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
            ) : null}
          </div>}

          {!isMobileViewport && (
            <motion.aside
              className={styles.notesSidebar}
              style={notesShellBackground(
                resolvedTheme,
                selectedNoteSurfaceColor,
                selectedNotePageColor,
                xpTierTheme.accent,
                xpTierTheme.accentStrong,
                xpTierTheme.accentGlow,
              )}
              data-note-fill={selectedNote?.surfaceStyle ?? "solid"}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className={styles.notesSidebarHeader}>
                <div>
                  <p className={sharedStyles.sectionLabel}>Notes + Cards</p>
                  <h2 className={styles.notesSidebarTitle}>Writing studio</h2>
                  <p className={styles.notesSidebarMeta}>
                    {filteredNotes.length} visible note{filteredNotes.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  data-tour="notes-create"
                  className={sharedStyles.newNoteButton}
                  onClick={onCreateNote}
                >
                  + New
                </button>
              </div>
              <input
                value={notesSearch}
                onChange={(event) => onSetNotesSearch(event.target.value)}
                placeholder="Search notes"
                className={styles.notesSearchInput}
              />
              <div className={styles.notesFilterRow}>
                <select
                  className={styles.noteToolSelect}
                  value={notesCategoryFilter}
                  onChange={(event) =>
                    onSetNotesCategoryFilter(event.target.value as "all" | NoteCategory)
                  }
                >
                  <option value="all">All categories</option>
                  <option value="personal">Personal</option>
                  <option value="school">School</option>
                  <option value="work">Work</option>
                </select>
              </div>
              <div className={styles.noteList}>
                {filteredNotes.map((note) => (
                  <motion.div
                    key={note.id}
                    className={styles.noteListRow}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.24,
                      delay: Math.min(filteredNotes.findIndex((item) => item.id === note.id) * 0.03, 0.24),
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <motion.button
                      type="button"
                      className={`${styles.noteListItem} ${selectedNoteId === note.id ? styles.noteListItemActive : ""}`}
                      style={notePreviewStyle(note.shellColor || "#fff7d6")}
                      data-note-fill={note.surfaceStyle ?? "solid"}
                      onClick={() => {
                        void (async () => {
                          await onFlushNoteDraft();
                          onSetSelectedNoteId(note.id);
                        })();
                      }}
                      whileHover={{ y: -2, scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <span className={styles.noteListTitle}>
                        {note.isPinned ? "★ " : ""}
                        {note.title || "Untitled note"}
                        {note.attachments.length > 0 ? (
                          <span className={sharedStyles.attachmentIndicatorChip}>
                            {attachmentIndicatorLabel(note.attachments.length)}
                          </span>
                        ) : null}
                        {countWords(note.body) > 0 ? (
                          <span className={styles.wordCountChip}>
                            {countWords(note.body)}w
                          </span>
                        ) : null}
                      </span>
                      <span className={styles.noteListMeta}>
                        {(note.category || "personal").toUpperCase()} ·{" "}
                        {new Date(note.updatedAtISO).toLocaleDateString()}
                        {note.attachments.length > 0
                          ? ` · ${note.attachments.length} attachment${note.attachments.length === 1 ? "" : "s"}`
                          : ""}
                      </span>
                    </motion.button>
                    <button
                      type="button"
                      className={styles.notePinButton}
                      onClick={() => void onTogglePinned(note.id)}
                      title={note.isPinned ? "Unpin note" : "Pin note"}
                      aria-label={note.isPinned ? "Unpin note" : "Pin note"}
                    >
                      {note.isPinned ? "★" : "☆"}
                    </button>
                  </motion.div>
                ))}
                {filteredNotes.length === 0 && (
                  <p className={sharedStyles.emptyText}>No notes match your filters.</p>
                )}
              </div>
              {!isPro && hasLockedNotesHistory ? (
                <p className={sharedStyles.accountMeta}>
                  {WHELM_STANDARD_NAME} keeps the last {WHELM_STANDARD_HISTORY_DAYS} days of notes visible.
                  {` ${WHELM_PRO_NAME} keeps the older archive ready whenever you want it back.`}
                </p>
              ) : null}
            </motion.aside>
          )}

          {!isMobileViewport && (
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

                  <div className={styles.noteEditorToolbar}>
                    <div className={styles.noteToolbarSection}>
                      <span className={styles.noteToolbarLabel}>Text</span>
                      <div className={styles.noteToolbarGroup}>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            onSaveEditorSelection();
                          }}
                          onClick={() => onApplyEditorCommand("bold")}
                        >
                          Bold
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            onSaveEditorSelection();
                          }}
                          onClick={() => onApplyEditorCommand("italic")}
                        >
                          Italic
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            onSaveEditorSelection();
                          }}
                          onClick={() => onApplyEditorCommand("underline")}
                        >
                          Underline
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            onSaveEditorSelection();
                          }}
                          onClick={() => onApplyEditorCommand("removeFormat")}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className={styles.noteToolbarSection}>
                      <span className={styles.noteToolbarLabel}>Structure</span>
                      <div className={styles.noteToolbarGroup}>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            onSaveEditorSelection();
                          }}
                          onClick={() => onApplyEditorCommand("formatBlock", "H1")}
                        >
                          H1
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            onSaveEditorSelection();
                          }}
                          onClick={() => onApplyEditorCommand("formatBlock", "H2")}
                        >
                          H2
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            onSaveEditorSelection();
                          }}
                          onClick={() => onApplyEditorCommand("formatBlock", "BLOCKQUOTE")}
                        >
                          Quote
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            onSaveEditorSelection();
                          }}
                          onClick={() => onApplyEditorCommand("insertHorizontalRule")}
                        >
                          Divider
                        </button>
                      </div>
                    </div>

                    <div className={styles.noteToolbarSection}>
                      <span className={styles.noteToolbarLabel}>Layout</span>
                      <div className={styles.noteToolbarGroup}>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            onSaveEditorSelection();
                          }}
                          onClick={() => onApplyEditorCommand("insertUnorderedList")}
                        >
                          Bullet
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            onSaveEditorSelection();
                          }}
                          onClick={() => onApplyEditorCommand("insertOrderedList")}
                        >
                          Number
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            onSaveEditorSelection();
                          }}
                          onClick={() => onApplyEditorCommand("justifyLeft")}
                        >
                          Left
                        </button>
                        <button
                          type="button"
                          className={styles.noteToolButton}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            onSaveEditorSelection();
                          }}
                          onClick={() => onApplyEditorCommand("justifyCenter")}
                        >
                          Center
                        </button>
                      </div>
                    </div>

                    {isPro ? (
                      <div className={styles.noteToolbarSection}>
                        <span className={styles.noteToolbarLabel}>Style</span>
                        <div className={styles.noteToolbarGroup}>
                          <select
                            className={styles.noteToolSelect}
                            value={selectedNote.fontFamily}
                            onMouseDown={() => onSaveEditorSelection()}
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
                            onMouseDown={() => onSaveEditorSelection()}
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

                          <div className={styles.noteInlinePalette}>
                            <button
                              type="button"
                              className={styles.noteToolButton}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                onSaveEditorSelection();
                              }}
                              onClick={() => {
                                onSetTextColorPickerOpen((open) => !open);
                                onSetHighlightPickerOpen(false);
                              }}
                            >
                              Text color
                            </button>
                            {textColorPickerOpen && (
                              <div className={styles.noteInlinePalettePopover}>
                                {NOTE_TEXT_COLORS.map((color) => (
                                  <button
                                    type="button"
                                    key={color.value}
                                    className={styles.noteInlineSwatch}
                                    style={{ backgroundColor: color.value }}
                                    title={color.label}
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      onSaveEditorSelection();
                                    }}
                                    onClick={() => {
                                      onApplyEditorCommand("foreColor", color.value);
                                      onSetTextColorPickerOpen(false);
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>

                          <div className={styles.noteInlinePalette}>
                            <button
                              type="button"
                              className={styles.noteToolButton}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                onSaveEditorSelection();
                              }}
                              onClick={() => {
                                onSetHighlightPickerOpen((open) => !open);
                                onSetTextColorPickerOpen(false);
                              }}
                            >
                              Highlight
                            </button>
                            {highlightPickerOpen && (
                              <div className={styles.noteInlinePalettePopover}>
                                {NOTE_HIGHLIGHTS.map((color) => (
                                  <button
                                    type="button"
                                    key={color.value}
                                    className={styles.noteInlineSwatch}
                                    style={{ backgroundColor: color.value }}
                                    title={color.label}
                                    onMouseDown={(event) => {
                                      event.preventDefault();
                                      onSaveEditorSelection();
                                    }}
                                    onClick={() => {
                                      onApplyHighlightColor(color.value);
                                      onSetHighlightPickerOpen(false);
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className={styles.noteBodyShell} ref={noteBodyShellRef}>
                    {notesSyncStatus === "local-only" ? (
                      <div className={styles.noteSyncInlineNotice} role="status" aria-live="polite">
                        <span className={styles.noteSyncInlineDot} />
                        <span>
                          Saved locally — cloud sync pending.
                          {notesSyncMessage ? ` ${notesSyncMessage}` : ""}
                        </span>
                        <button
                          type="button"
                          className={sharedStyles.retrySyncButton}
                          style={{ marginLeft: 8 }}
                          onClick={() => void onRetrySync()}
                        >
                          {syncButtonLabel}
                        </button>
                      </div>
                    ) : null}
                    <div
                      ref={editorRef}
                      className={styles.noteBodyInput}
                      contentEditable
                      suppressContentEditableWarning
                      style={{
                        fontFamily: selectedNote.fontFamily,
                        fontSize: `${selectedNote.fontSizePx}px`,
                      }}
                      onInput={() => {
                        onCaptureEditorDraft();
                        onSaveEditorSelection();
                        onUpdateEditorBandanaCaret();
                      }}
                      onKeyUp={() => {
                        onCaptureEditorDraft();
                        onSaveEditorSelection();
                        onUpdateEditorBandanaCaret();
                        onCheckEditorSelection();
                      }}
                      onPaste={() => {
                        window.setTimeout(() => {
                          onCaptureEditorDraft();
                          onSaveEditorSelection();
                          onUpdateEditorBandanaCaret();
                        }, 0);
                      }}
                      onCompositionEnd={() => {
                        onCaptureEditorDraft();
                        onSaveEditorSelection();
                        onUpdateEditorBandanaCaret();
                      }}
                      onBlur={() => {
                        onCaptureEditorDraft();
                        onSetEditorBandanaCaret((current) =>
                          current.visible ? { ...current, visible: false } : current,
                        );
                      }}
                      onMouseUp={() => {
                        onSaveEditorSelection();
                        onUpdateEditorBandanaCaret();
                        onCheckEditorSelection();
                      }}
                      onFocus={() => {
                        onSaveEditorSelection();
                        onUpdateEditorBandanaCaret();
                      }}
                      onScroll={() => onUpdateEditorBandanaCaret()}
                    />
                    {editorBandanaCaret.visible ? (
                      <img
                        className={styles.noteBandanaCaret}
                        src={bandanaCursorAssetPath(streakBandanaTier?.color, 256)}
                        srcSet={`${bandanaCursorAssetPath(streakBandanaTier?.color, 256)} 1x`}
                        alt=""
                        style={{
                          left: `${editorBandanaCaret.left}px`,
                          top: `${editorBandanaCaret.top}px`,
                        }}
                      />
                    ) : null}
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
                      <span>{syncStatusLabel}</span>
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
