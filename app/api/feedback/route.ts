import { NextRequest, NextResponse } from "next/server";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

type FeedbackCategory = "bug" | "feature" | "other";

type FeedbackPayload = {
  uid: string;
  email?: string;
  displayName?: string;
  category: FeedbackCategory;
  message: string;
  pagePath?: string;
};

function requireConfig() {
  if (!projectId || !apiKey) {
    throw new Error("Missing Firebase environment variables on the server.");
  }

  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function getAuthHeader(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader : null;
}

function encodeFeedback(payload: FeedbackPayload, request: NextRequest) {
  const now = new Date().toISOString();
  const userAgent = request.headers.get("user-agent") ?? "";

  return {
    fields: {
      uid: { stringValue: payload.uid },
      email: { stringValue: payload.email ?? "" },
      displayName: { stringValue: payload.displayName ?? "" },
      category: { stringValue: payload.category },
      message: { stringValue: payload.message },
      pagePath: { stringValue: payload.pagePath ?? "" },
      userAgent: { stringValue: userAgent.slice(0, 512) },
      createdAtISO: { stringValue: now },
    },
  };
}

function validatePayload(payload: FeedbackPayload) {
  if (!payload.uid) return "Missing uid.";
  if (!payload.message?.trim()) return "Feedback message is required.";
  if (payload.message.trim().length > 2000) return "Feedback message is too long.";
  if (!["bug", "feature", "other"].includes(payload.category)) return "Invalid category.";
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = getAuthHeader(request);
    if (!authHeader) return jsonError("Missing Firebase auth token.", 401);

    const payload = (await request.json()) as FeedbackPayload;
    const validationError = validatePayload(payload);
    if (validationError) return jsonError(validationError, 400);

    const baseUrl = requireConfig();
    const response = await fetch(`${baseUrl}/feedback?key=${apiKey}`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(encodeFeedback(payload, request)),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string; status?: string } }
        | null;

      return jsonError(
        body?.error?.message || body?.error?.status || "Failed to save feedback.",
        response.status,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to submit feedback.");
  }
}
