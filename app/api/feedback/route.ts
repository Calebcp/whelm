import { NextRequest, NextResponse } from "next/server";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const feedbackEmailTo = "smalltek317@gmail.com";
const feedbackEmailFrom =
  process.env.FEEDBACK_EMAIL_FROM || "Whelm Feedback <onboarding@resend.dev>";

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

function buildEmailHtml(payload: FeedbackPayload) {
  const safeMessage = payload.message
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "<br/>");

  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
      <h2 style="margin:0 0 12px">Whelm Feedback</h2>
      <p style="margin:0 0 8px"><strong>Category:</strong> ${payload.category}</p>
      <p style="margin:0 0 8px"><strong>User UID:</strong> ${payload.uid}</p>
      <p style="margin:0 0 8px"><strong>User Email:</strong> ${payload.email || "(missing)"}</p>
      <p style="margin:0 0 8px"><strong>Display Name:</strong> ${payload.displayName || "(missing)"}</p>
      <p style="margin:0 0 8px"><strong>Page:</strong> ${payload.pagePath || "(unknown)"}</p>
      <p style="margin:14px 0 6px"><strong>Message</strong></p>
      <div style="padding:10px 12px;background:#f1f5f9;border-radius:10px">${safeMessage}</div>
    </div>
  `;
}

async function sendFeedbackEmail(payload: FeedbackPayload) {
  if (!resendApiKey) {
    throw new Error("Feedback email is not configured. Missing RESEND_API_KEY.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: feedbackEmailFrom,
      to: [feedbackEmailTo],
      subject: `[Whelm] ${payload.category.toUpperCase()} feedback`,
      html: buildEmailHtml(payload),
      reply_to: payload.email || undefined,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { message?: string; error?: string }
      | null;
    const rawMessage = body?.message || body?.error || "Failed to send feedback email.";

    if (
      rawMessage.toLowerCase().includes("verify") ||
      rawMessage.toLowerCase().includes("testing emails") ||
      rawMessage.toLowerCase().includes("domain")
    ) {
      throw new Error(
        "Feedback email is blocked by current Resend sender settings. Verify a sending domain in Resend and set FEEDBACK_EMAIL_FROM to that domain.",
      );
    }

    throw new Error(rawMessage);
  }
}

async function saveFeedbackToFirestore(payload: FeedbackPayload, request: NextRequest, authHeader: string) {
  if (!projectId || !apiKey) return;

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
    throw new Error(body?.error?.message || body?.error?.status || "Failed to save feedback.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = getAuthHeader(request);
    if (!authHeader) return jsonError("Missing Firebase auth token.", 401);

    const payload = (await request.json()) as FeedbackPayload;
    const validationError = validatePayload(payload);
    if (validationError) return jsonError(validationError, 400);

    await sendFeedbackEmail(payload);

    // Do not fail user feedback if optional Firestore logging is unavailable.
    try {
      await saveFeedbackToFirestore(payload, request, authHeader);
    } catch {
      // noop
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return jsonError(error instanceof Error ? error.message : "Failed to submit feedback.");
  }
}
