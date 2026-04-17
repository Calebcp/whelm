"use client";

import { Capacitor } from "@capacitor/core";
import {
  LOG_LEVEL,
  Purchases,
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "@revenuecat/purchases-capacitor";

const REVENUECAT_APPLE_API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_APPLE_API_KEY?.trim() ?? "";
const REVENUECAT_ENTITLEMENT_ID =
  process.env.NEXT_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() || "pro";

let configuredAppUserId: string | null = null;
let logLevelInitialized = false;

export type RevenueCatSupportState = {
  supported: boolean;
  reason: string;
};

export function getRevenueCatSupportState(): RevenueCatSupportState {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
    return {
      supported: false,
      reason: "App Store subscriptions are only available in the native iOS app.",
    };
  }

  if (!REVENUECAT_APPLE_API_KEY) {
    return {
      supported: false,
      reason: "RevenueCat is not configured for this build yet.",
    };
  }

  return {
    supported: true,
    reason: "",
  };
}

async function initializeLogLevel() {
  if (logLevelInitialized) return;
  logLevelInitialized = true;

  if (process.env.NODE_ENV !== "production") {
    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG }).catch(() => {
      logLevelInitialized = false;
    });
  }
}

export async function ensureRevenueCatConfigured(appUserId: string) {
  const support = getRevenueCatSupportState();
  if (!support.supported) return support;

  await initializeLogLevel();

  if (!configuredAppUserId) {
    await Purchases.configure({
      apiKey: REVENUECAT_APPLE_API_KEY,
      appUserID: appUserId,
    });
    configuredAppUserId = appUserId;
    return support;
  }

  if (configuredAppUserId !== appUserId) {
    await Purchases.logIn({ appUserID: appUserId });
    configuredAppUserId = appUserId;
  }

  return support;
}

export function hasActiveProEntitlement(customerInfo: CustomerInfo) {
  return Boolean(customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID]);
}

export async function getRevenueCatCustomerInfo(appUserId: string) {
  await ensureRevenueCatConfigured(appUserId);
  const { customerInfo } = await Purchases.getCustomerInfo();
  return customerInfo;
}

export async function getRevenueCatOfferings(appUserId: string): Promise<PurchasesOfferings> {
  await ensureRevenueCatConfigured(appUserId);
  return Purchases.getOfferings();
}

export async function purchaseRevenueCatPackage(appUserId: string, aPackage: PurchasesPackage) {
  await ensureRevenueCatConfigured(appUserId);
  return Purchases.purchasePackage({ aPackage });
}

export async function restoreRevenueCatPurchases(appUserId: string) {
  await ensureRevenueCatConfigured(appUserId);
  return Purchases.restorePurchases();
}

export async function addRevenueCatCustomerInfoListener(
  appUserId: string,
  listener: (customerInfo: CustomerInfo) => void,
) {
  await ensureRevenueCatConfigured(appUserId);
  return Purchases.addCustomerInfoUpdateListener(listener);
}

export async function removeRevenueCatCustomerInfoListener(listenerToRemove: string) {
  return Purchases.removeCustomerInfoUpdateListener({ listenerToRemove });
}

export async function logOutRevenueCat() {
  const support = getRevenueCatSupportState();
  if (!support.supported || !configuredAppUserId) return;

  await Purchases.logOut().catch(() => {
    // Ignore RevenueCat logout failures during app sign-out.
  });
  configuredAppUserId = null;
}
