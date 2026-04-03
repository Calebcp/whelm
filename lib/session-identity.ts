import type { SessionDoc } from "@/lib/streak";

function normalizeWhitespace(value: string | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function simpleHash(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function canonicalSessionIdentity(session: SessionDoc) {
  return [
    session.uid,
    session.completedAtISO,
    String(session.minutes),
    session.category ?? "misc",
    normalizeWhitespace(session.note),
  ].join("|");
}

export function sessionDocumentId(session: SessionDoc) {
  return `session_${simpleHash(canonicalSessionIdentity(session))}`;
}

