import { createSign } from "crypto";

type CachedToken = {
  accessToken: string;
  expiresAtUnix: number;
};

let cachedToken: CachedToken | null = null;

function requireServiceAccountConfig() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
    );
  }

  return { clientEmail, privateKey };
}

function base64UrlEncode(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildJwtAssertion() {
  const { clientEmail, privateKey } = requireServiceAccountConfig();
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload),
  )}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(privateKey);

  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

export async function getServiceAccountAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAtUnix - 60 > now) {
    return cachedToken.accessToken;
  }

  const assertion = buildJwtAssertion();
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; error_description?: string }
      | null;
    throw new Error(
      payload?.error_description || payload?.error || "Failed to mint Google access token.",
    );
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    accessToken: payload.access_token,
    expiresAtUnix: now + payload.expires_in,
  };

  return payload.access_token;
}

export async function getFirestoreAdminAuthHeader() {
  const token = await getServiceAccountAccessToken();
  return `Bearer ${token}`;
}
