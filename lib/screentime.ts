import { Capacitor, registerPlugin } from "@capacitor/core";

export type ScreenTimeAuthorizationStatus =
  | "notDetermined"
  | "denied"
  | "approved"
  | "unsupported"
  | "unknown";

type ScreenTimePlugin = {
  isSupported: () => Promise<{ supported: boolean; reason?: string }>;
  getAuthorizationStatus: () => Promise<{ status: ScreenTimeAuthorizationStatus }>;
  requestAuthorization: () => Promise<{ status: ScreenTimeAuthorizationStatus }>;
  openSystemSettings: () => Promise<{ opened: boolean }>;
};

const ScreenTime = registerPlugin<ScreenTimePlugin>("ScreenTime");

export function isScreenTimePlatform() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export async function getScreenTimeCapability() {
  if (!isScreenTimePlatform()) {
    return {
      supported: false,
      status: "unsupported" as ScreenTimeAuthorizationStatus,
      reason: "Screen Time API is available only in the iOS native app.",
    };
  }

  try {
    const support = await ScreenTime.isSupported();
    if (!support.supported) {
      return {
        supported: false,
        status: "unsupported" as ScreenTimeAuthorizationStatus,
        reason: support.reason || "Not supported on this iOS version.",
      };
    }

    const auth = await ScreenTime.getAuthorizationStatus();
    return {
      supported: true,
      status: auth.status,
      reason: "",
    };
  } catch (error) {
    return {
      supported: false,
      status: "unknown" as ScreenTimeAuthorizationStatus,
      reason:
        error instanceof Error
          ? error.message
          : "Failed to read Screen Time capability.",
    };
  }
}

export async function requestScreenTimeAuthorization() {
  const result = await ScreenTime.requestAuthorization();
  return result.status;
}

export async function openScreenTimeSystemSettings() {
  return ScreenTime.openSystemSettings();
}
