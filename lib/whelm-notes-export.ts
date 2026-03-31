import { zipSync, strToU8 } from "fflate";

import type { WorkspaceNote } from "@/lib/notes-store";

type NotesExportSummary = {
  noteCount: number;
  attachmentCount: number;
  exportedAtISO: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "untitled-note";
}

function decodeHtml(value: string) {
  if (typeof document === "undefined") return value;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function renderNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  const content = Array.from(node.childNodes).map(renderNode).join("");
  const tag = node.tagName.toLowerCase();

  if (tag === "br") return "\n";
  if (tag === "hr") return "\n---\n";
  if (tag === "strong" || tag === "b") return content.trim() ? `**${content.trim()}**` : "";
  if (tag === "em" || tag === "i") return content.trim() ? `*${content.trim()}*` : "";
  if (tag === "code") return content.trim() ? `\`${content.trim()}\`` : "";
  if (tag === "a") {
    const href = node.getAttribute("href");
    if (!href) return content;
    const label = content.trim() || href;
    return `[${label}](${href})`;
  }
  if (tag === "li") return `- ${content.trim()}\n`;
  if (tag === "ul" || tag === "ol") return `${content.trim()}\n\n`;
  if (tag.match(/^h[1-6]$/)) {
    const level = Number(tag.slice(1));
    return `${"#".repeat(level)} ${content.trim()}\n\n`;
  }
  if (tag === "p" || tag === "div" || tag === "section" || tag === "article") {
    return `${content.trim()}\n\n`;
  }

  return content;
}

function noteBodyToMarkdown(body: string) {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (!/[<>]/.test(trimmed)) {
    return decodeHtml(trimmed).replace(/\r\n/g, "\n");
  }
  if (typeof DOMParser === "undefined") {
    return decodeHtml(trimmed.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""))
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<article>${trimmed}</article>`, "text/html");
  const output = Array.from(doc.body.childNodes).map(renderNode).join("");
  return decodeHtml(output)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDateLabel(value: string) {
  if (!value) return "None";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function sanitizeFilePart(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").trim() || "file";
}

function buildUniqueAttachmentFileName(baseName: string, used: Set<string>) {
  if (!used.has(baseName)) {
    used.add(baseName);
    return baseName;
  }

  const dotIndex = baseName.lastIndexOf(".");
  const stem = dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName;
  const extension = dotIndex > 0 ? baseName.slice(dotIndex) : "";
  let attempt = 1;

  while (true) {
    const candidate = `${stem}-${attempt}${extension}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    attempt += 1;
  }
}

function buildUniqueNoteFileName(baseTitle: string, used: Set<string>, updatedAtISO: string, id: string) {
  const stem = slugify(baseTitle);
  let candidate = `${stem}.md`;
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }

  const datePart = updatedAtISO ? updatedAtISO.slice(0, 10) : id.slice(0, 8);
  candidate = `${stem}-${datePart}.md`;
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }

  candidate = `${stem}-${id.slice(0, 8)}.md`;
  used.add(candidate);
  return candidate;
}

async function fetchAttachmentBytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Attachment fetch failed (${response.status})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function buildIndex(summary: NotesExportSummary, entries: Array<{ title: string; path: string; category: string; attachmentCount: number }>) {
  const categories = new Map<string, number>();
  for (const entry of entries) {
    categories.set(entry.category, (categories.get(entry.category) ?? 0) + 1);
  }

  const categoryLines = [...categories.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, count]) => `- ${category}: ${count}`)
    .join("\n");

  const noteLines = entries
    .map((entry) => `- [${entry.title}](${entry.path})${entry.attachmentCount ? ` (${entry.attachmentCount} attachments)` : ""}`)
    .join("\n");

  return `# Whelm Notes Export

Exported: ${formatDateLabel(summary.exportedAtISO)}
Notes: ${summary.noteCount}
Attachments bundled: ${summary.attachmentCount}

## Categories
${categoryLines || "- None"}

## Notes
${noteLines || "- No notes"}
`;
}

export async function exportReadableNotesZip(notes: WorkspaceNote[]) {
  const files: Record<string, Uint8Array> = {};
  const usedNames = new Set<string>();
  const indexEntries: Array<{ title: string; path: string; category: string; attachmentCount: number }> = [];
  let attachmentCount = 0;

  const sortedNotes = [...notes].sort((a, b) => (a.updatedAtISO < b.updatedAtISO ? 1 : -1));

  for (const note of sortedNotes) {
    const noteFileName = buildUniqueNoteFileName(note.title || "Untitled note", usedNames, note.updatedAtISO, note.id);
    const noteStem = noteFileName.replace(/\.md$/i, "");
    const notePath = `Notes/${noteFileName}`;
    const markdownBody = noteBodyToMarkdown(note.body);
    const attachmentLines: string[] = [];
    const usedAttachmentNames = new Set<string>();
    let bundledAttachmentsForNote = 0;

    for (const [index, attachment] of note.attachments.entries()) {
      const safeName = buildUniqueAttachmentFileName(
        sanitizeFilePart(attachment.name || `attachment-${index + 1}`),
        usedAttachmentNames,
      );
      const attachmentPath = `Attachments/${noteStem}/${safeName}`;
      const relativePath = `../Attachments/${noteStem}/${safeName}`;

      try {
        files[attachmentPath] = await fetchAttachmentBytes(attachment.downloadUrl);
        attachmentCount += 1;
        bundledAttachmentsForNote += 1;
        attachmentLines.push(`- [${safeName}](${relativePath})`);
      } catch {
        attachmentLines.push(`- ${safeName} (attachment could not be bundled)`);
      }
    }

    const noteMarkdown = `# ${note.title || "Untitled note"}

Created: ${formatDateLabel(note.createdAtISO)}
Updated: ${formatDateLabel(note.updatedAtISO)}
Category: ${note.category}
Reminder: ${note.reminderAtISO ? formatDateLabel(note.reminderAtISO) : "None"}
Pinned: ${note.isPinned ? "Yes" : "No"}

## Note

${markdownBody || "_Empty note_"}

## Attachments

${attachmentLines.length ? attachmentLines.join("\n") : "- None"}
`;

    files[notePath] = strToU8(noteMarkdown);
    indexEntries.push({
      title: note.title || "Untitled note",
      path: notePath,
      category: note.category,
      attachmentCount: bundledAttachmentsForNote,
    });
  }

  const exportedAtISO = new Date().toISOString();
  files["Index.md"] = strToU8(
    buildIndex(
      {
        noteCount: sortedNotes.length,
        attachmentCount,
        exportedAtISO,
      },
      indexEntries,
    ),
  );

  const zipBytes = zipSync(files, { level: 6 });
  const zipBinary = new Uint8Array(zipBytes.byteLength);
  zipBinary.set(zipBytes);
  const blob = new Blob([zipBinary], { type: "application/zip" });
  const safeDate = exportedAtISO.replaceAll(":", "-").replaceAll(".", "-");
  const fileName = `whelm-notes-export-${safeDate}.zip`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return {
    fileName,
    noteCount: sortedNotes.length,
    attachmentCount,
  };
}
