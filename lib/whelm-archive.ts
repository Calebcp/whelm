import type { CalendarTone } from "@/lib/calendar-tones";
import type { WhelCard } from "@/lib/cards-store";
import type { WorkspaceNote } from "@/lib/notes-store";
import type { PlannedBlockDoc } from "@/lib/planned-blocks-store";
import type { PreferencesState } from "@/lib/preferences-store";
import type { ReflectionState } from "@/lib/reflection-store";
import type { SessionDoc } from "@/lib/streak";
import type { LifetimeXpSummary } from "@/lib/xp-engine";

export type WhelmArchive = {
  version: "whelm-archive/v1";
  exportedAtISO: string;
  account: {
    uid: string;
    email: string | null;
    displayName: string | null;
    createdAtISO: string | null;
    tier: string;
  };
  summary: {
    notes: number;
    plannedBlocks: number;
    sessions: number;
    cards: number;
    mirrorEntries: number;
    sickDaySaves: number;
  };
  preferences: PreferencesState;
  notes: WorkspaceNote[];
  plannedBlocks: PlannedBlockDoc[];
  sessions: SessionDoc[];
  cards: WhelCard[];
  reflection: ReflectionState;
  calendarTones: {
    days: Record<string, CalendarTone>;
    months: Record<string, CalendarTone>;
  };
  streak: {
    current: number;
    qualifiedDateKeys: string[];
    lifetimeXpSummary: LifetimeXpSummary;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseWhelmArchive(raw: string): WhelmArchive {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Invalid Whelm archive.");
  }
  if (parsed.version !== "whelm-archive/v1") {
    throw new Error("Unsupported Whelm archive version.");
  }
  if (
    !isRecord(parsed.account) ||
    !isRecord(parsed.summary) ||
    !isRecord(parsed.preferences) ||
    !Array.isArray(parsed.notes) ||
    !Array.isArray(parsed.plannedBlocks) ||
    !Array.isArray(parsed.sessions) ||
    !Array.isArray(parsed.cards) ||
    !isRecord(parsed.reflection) ||
    !isRecord(parsed.calendarTones) ||
    !isRecord(parsed.streak)
  ) {
    throw new Error("This archive file is missing required Whelm data.");
  }
  if (
    !Array.isArray((parsed.reflection as Record<string, unknown>).mirrorEntries) ||
    !Array.isArray((parsed.reflection as Record<string, unknown>).sickDaySaves) ||
    !Array.isArray((parsed.reflection as Record<string, unknown>).sickDaySaveDismissals)
  ) {
    throw new Error("This archive file has an invalid reflection payload.");
  }
  if (
    !isRecord((parsed.calendarTones as Record<string, unknown>).days) ||
    !isRecord((parsed.calendarTones as Record<string, unknown>).months)
  ) {
    throw new Error("This archive file has an invalid calendar tone payload.");
  }
  return parsed as WhelmArchive;
}

export function buildWhelmArchive(input: Omit<WhelmArchive, "version" | "exportedAtISO" | "summary">): WhelmArchive {
  return {
    version: "whelm-archive/v1",
    exportedAtISO: new Date().toISOString(),
    summary: {
      notes: input.notes.length,
      plannedBlocks: input.plannedBlocks.length,
      sessions: input.sessions.length,
      cards: input.cards.length,
      mirrorEntries: input.reflection.mirrorEntries.length,
      sickDaySaves: input.reflection.sickDaySaves.length,
    },
    ...input,
  };
}

export function buildWhelmArchiveFilename(exportedAtISO: string) {
  const safe = exportedAtISO.replaceAll(":", "-").replaceAll(".", "-");
  return `whelm-archive-${safe}.json`;
}

export async function saveWhelmArchive(archive: WhelmArchive): Promise<"shared" | "downloaded"> {
  const payload = `${JSON.stringify(archive, null, 2)}\n`;
  const fileName = buildWhelmArchiveFilename(archive.exportedAtISO);
  const file = typeof File !== "undefined" ? new File([payload], fileName, { type: "application/json" }) : null;

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    file &&
    (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] }))
  ) {
    await navigator.share({
      title: "Whelm Archive",
      text: "Whelm archive export",
      files: [file],
    });
    return "shared";
  }

  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
