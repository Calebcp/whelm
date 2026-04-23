"use client";

const DEFAULT_API_BASE_URL = "https://www.whelmproductivity.com";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isNativeWebViewProtocol(protocol: string) {
  return protocol === "capacitor:" || protocol === "ionic:" || protocol === "file:";
}

export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  const protocol =
    typeof window !== "undefined" && typeof window.location?.protocol === "string"
      ? window.location.protocol
      : "";

  if (isNativeWebViewProtocol(protocol)) {
    return DEFAULT_API_BASE_URL;
  }

  return "";
}

export function resolveApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${normalized}` : normalized;
}
