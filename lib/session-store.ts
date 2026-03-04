import type { User } from "firebase/auth";

import type { SessionDoc } from "@/lib/streak";

async function authorizedRequest(
  user: User,
  input: string,
  init: RequestInit,
  timeoutMs = 12000,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const token = await user.getIdToken();

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      throw new Error(body?.error || response.statusText || "Session request failed.");
    }

    return response;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "Session request timed out. The current network path is likely blocking or stalling the request.",
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function loadSessions(user: User) {
  const response = await authorizedRequest(
    user,
    `/api/sessions?uid=${encodeURIComponent(user.uid)}`,
    { method: "GET" },
  );
  const body = (await response.json()) as { sessions?: SessionDoc[] };
  return body.sessions ?? [];
}

export async function saveSession(user: User, session: SessionDoc) {
  await authorizedRequest(user, "/api/sessions", {
    method: "POST",
    body: JSON.stringify(session),
  });
}
