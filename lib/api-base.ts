"use client";

import { isNativeAppShell } from "@/lib/client-platform";

const DEFAULT_API_BASE_URL = "https://whelmproductivity.com";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  if (!isNativeAppShell()) return "";

  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return trimTrailingSlash(configured || DEFAULT_API_BASE_URL);
}

export function resolveApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${normalized}` : normalized;
}
