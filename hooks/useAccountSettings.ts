"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  signOut,
  type User,
} from "firebase/auth";

import { resolveApiUrl } from "@/lib/api-base";
import { auth } from "@/lib/firebase";
import {
  loadPreferences,
  readLocalPreferences,
  savePreferences,
  type PreferencesProState,
} from "@/lib/preferences-store";
import {
  addRevenueCatCustomerInfoListener,
  ensureRevenueCatConfigured,
  getRevenueCatCustomerInfo,
  getRevenueCatSupportState,
  hasActiveProEntitlement,
  logOutRevenueCat,
  removeRevenueCatCustomerInfoListener,
  restoreRevenueCatPurchases,
} from "@/lib/revenuecat";
import {
  getScreenTimeCapability,
  openScreenTimeSystemSettings,
  requestScreenTimeAuthorization,
  type ScreenTimeAuthorizationStatus,
} from "@/lib/screentime";

type FeedbackCategory = "bug" | "feature" | "other";

type UseAccountSettingsOptions = {
  user: User | null;
  clearLocalAccountData: (uid: string) => void;
};

export function useAccountSettings({
  user,
  clearLocalAccountData,
}: UseAccountSettingsOptions) {
  const router = useRouter();

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<FeedbackCategory>("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [proSource, setProSource] = useState<"preview" | "store" | "none">("none");
  const [subscriptionBusy, setSubscriptionBusy] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState("");
  const [proPanelsOpen, setProPanelsOpen] = useState({
    notes: false,
    calendar: false,
    history: false,
    reports: false,
    background: false,
    mirror: false,
  });
  const [screenTimeStatus, setScreenTimeStatus] =
    useState<ScreenTimeAuthorizationStatus>("unsupported");
  const [screenTimeSupported, setScreenTimeSupported] = useState(false);
  const [screenTimeReason, setScreenTimeReason] = useState("");
  const [screenTimeBusy, setScreenTimeBusy] = useState(false);
  const [accountDangerStatus, setAccountDangerStatus] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountStateHydrated, setAccountStateHydrated] = useState(false);

  const applyProState = useCallback((next: PreferencesProState) => {
    setIsPro(next.isPro);
    setProSource(next.source);
  }, []);

  const persistProState = useCallback(async (next: PreferencesProState) => {
    applyProState(next);
    if (!user) return;

    const base = readLocalPreferences(user.uid);
    if (
      base.proState.isPro === next.isPro &&
      base.proState.source === next.source
    ) {
      return;
    }

    await savePreferences(user, {
      ...base,
      proState: next,
    });
  }, [applyProState, user]);

  useEffect(() => {
    if (!user) {
      setAccountStateHydrated(false);
      setSubscriptionStatus("");
      return;
    }

    let active = true;
    let revenueCatListenerId: string | null = null;
    const loadStartedAt = performance.now();
    applyProState(readLocalPreferences(user.uid).proState);
    setAccountStateHydrated(true);
    void loadPreferences(user).then((prefs) => {
      if (!active) return;
      applyProState(prefs.proState);
      setAccountStateHydrated(true);
      console.info("[whelm:account] pro-state hydrated", {
        uid: user.uid,
        isPro: prefs.proState.isPro,
        source: prefs.proState.source,
        durationMs: Math.round(performance.now() - loadStartedAt),
      });
    });

    void (async () => {
      const support = getRevenueCatSupportState();
      if (!support.supported) {
        if (active) {
          setSubscriptionStatus(support.reason);
        }
        return;
      }

      try {
        await ensureRevenueCatConfigured(user.uid);
        if (!active) return;

        revenueCatListenerId = await addRevenueCatCustomerInfoListener(user.uid, (customerInfo) => {
          if (!active) return;
          void persistProState({
            isPro: hasActiveProEntitlement(customerInfo),
            source: hasActiveProEntitlement(customerInfo) ? "store" : "none",
          });
        });

        const customerInfo = await getRevenueCatCustomerInfo(user.uid);
        if (!active) return;

        await persistProState({
          isPro: hasActiveProEntitlement(customerInfo),
          source: hasActiveProEntitlement(customerInfo) ? "store" : "none",
        });
        setSubscriptionStatus("");
      } catch (error: unknown) {
        if (!active) return;
        setSubscriptionStatus(
          error instanceof Error ? error.message : "Unable to load Whelm Pro subscription status.",
        );
      }
    })();

    return () => {
      active = false;
      if (revenueCatListenerId) {
        void removeRevenueCatCustomerInfoListener(revenueCatListenerId);
      }
    };
  }, [applyProState, persistProState, user]);

  useEffect(() => {
    let active = true;
    void getScreenTimeCapability().then((capability) => {
      if (!active) return;
      setScreenTimeSupported(capability.supported);
      setScreenTimeStatus(capability.status);
      setScreenTimeReason(capability.reason || "");
    });

    return () => {
      active = false;
    };
  }, []);

  const submitFeedback = useCallback(async () => {
    if (!user || feedbackSubmitting) return;

    const message = feedbackMessage.trim();
    if (!message) {
      setFeedbackStatus("Please write a short message before sending.");
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackStatus("");

    try {
      const token = await user.getIdToken();
      const response = await fetch(resolveApiUrl("/api/feedback"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email ?? "",
          displayName: user.displayName ?? "",
          category: feedbackCategory,
          message,
          pagePath: window.location.pathname,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(body?.error || "Failed to submit feedback.");
      }

      setFeedbackMessage("");
      setFeedbackStatus("Thanks. Feedback submitted.");
      window.setTimeout(() => {
        setFeedbackOpen(false);
        setFeedbackStatus("");
      }, 900);
    } catch (error: unknown) {
      setFeedbackStatus(
        error instanceof Error ? error.message : "Failed to submit feedback.",
      );
    } finally {
      setFeedbackSubmitting(false);
    }
  }, [feedbackCategory, feedbackMessage, feedbackSubmitting, user]);

  const handleRestorePurchases = useCallback(async () => {
    if (!user || subscriptionBusy) return;

    setSubscriptionBusy(true);
    setSubscriptionStatus("");

    try {
      const support = getRevenueCatSupportState();
      if (!support.supported) {
        throw new Error(support.reason);
      }

      const { customerInfo } = await restoreRevenueCatPurchases(user.uid);
      const hasPro = hasActiveProEntitlement(customerInfo);

      await persistProState({
        isPro: hasPro,
        source: hasPro ? "store" : "none",
      });

      setSubscriptionStatus(
        hasPro
          ? "Whelm Pro restored."
          : "No active Whelm Pro subscription was found for this Apple account.",
      );

      if (hasPro) {
        setPaywallOpen(false);
      }
    } catch (error: unknown) {
      setSubscriptionStatus(
        error instanceof Error ? error.message : "Unable to restore purchases.",
      );
    } finally {
      setSubscriptionBusy(false);
    }
  }, [persistProState, subscriptionBusy, user]);

  const handleRequestScreenTimeAuth = useCallback(async () => {
    try {
      setScreenTimeBusy(true);
      const status = await requestScreenTimeAuthorization();
      setScreenTimeStatus(status);
      setScreenTimeReason(
        status === "approved"
          ? "Screen Time permission granted."
          : "Screen Time permission was not approved.",
      );
    } catch (error) {
      setScreenTimeReason(
        error instanceof Error ? error.message : "Unable to request Screen Time permission.",
      );
    } finally {
      setScreenTimeBusy(false);
    }
  }, []);

  const handleOpenScreenTimeSettings = useCallback(async () => {
    try {
      setScreenTimeBusy(true);
      await openScreenTimeSystemSettings();
    } catch (error) {
      setScreenTimeReason(
        error instanceof Error ? error.message : "Unable to open iOS settings.",
      );
    } finally {
      setScreenTimeBusy(false);
    }
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setAccountDangerStatus("No signed-in account found.");
      return;
    }

    const confirmed = window.confirm(
      "Delete your Whelm account and all associated app data? This cannot be undone.",
    );
    if (!confirmed) return;

    const secondConfirmed = window.confirm(
      "Final confirmation: permanently delete this account, your notes, your sessions, and your local Whelm data?",
    );
    if (!secondConfirmed) return;

    setDeletingAccount(true);
    setAccountDangerStatus("");

    try {
      const email = currentUser.email?.trim();
      if (!email) {
        throw new Error("This account is missing an email address for deletion confirmation.");
      }

      const password = window.prompt(
        "Enter your password to permanently delete this account.",
      );

      if (password === null) {
        return;
      }

      if (!password.trim()) {
        throw new Error("Enter your password to delete your account.");
      }

      try {
        await reauthenticateWithCredential(
          currentUser,
          EmailAuthProvider.credential(email, password),
        );
      } catch (reauthError: unknown) {
        const reauthMessage =
          reauthError instanceof Error ? reauthError.message : "Reauthentication failed.";

        if (
          reauthMessage.includes("invalid-credential") ||
          reauthMessage.includes("wrong-password")
        ) {
          throw new Error("Incorrect password. Enter the same password you use to log in.");
        }

        throw reauthError;
      }

      const runDeletion = async () => {
        const token = await currentUser.getIdToken(true);
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const endpoints = [
          ["/api/notes", "Failed to delete saved notes."],
          ["/api/sessions", "Failed to delete saved sessions."],
          ["/api/planned-blocks", "Failed to delete saved planned blocks."],
          ["/api/reflection-state", "Failed to delete saved reflection state."],
          ["/api/preferences", "Failed to delete saved preferences."],
        ] as const;

        for (const [path, fallbackMessage] of endpoints) {
          const response = await fetch(
            resolveApiUrl(`${path}?uid=${encodeURIComponent(currentUser.uid)}`),
            {
              method: "DELETE",
              headers,
            },
          );

          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(body?.error || fallbackMessage);
          }
        }

        clearLocalAccountData(currentUser.uid);
        await deleteUser(currentUser);
      };

      try {
        await runDeletion();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to delete account.";
        const needsRecentLogin =
          message.includes("requires-recent-login") ||
          message.includes("auth/requires-recent-login");

        if (!needsRecentLogin) {
          throw error;
        }

        await runDeletion();
      }

      router.replace("/login");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to delete account.";
      if (
        message.includes("requires-recent-login") ||
        message.includes("auth/requires-recent-login")
      ) {
        setAccountDangerStatus(
          "Reauthentication failed. Log in again, then retry account deletion.",
        );
      } else if (
        message.includes("invalid-credential") ||
        message.includes("wrong-password")
      ) {
        setAccountDangerStatus(
          "Incorrect password. Enter the same password you use to log in.",
        );
      } else {
        setAccountDangerStatus(message);
      }
    } finally {
      setDeletingAccount(false);
    }
  }, [clearLocalAccountData, router]);

  const openUpgradeFlow = useCallback(() => {
    setSubscriptionStatus("");
    setPaywallOpen(true);
  }, []);

  const handleStartProPreview = openUpgradeFlow;

  const handleManageSubscription = useCallback(() => {
    if (typeof window === "undefined") return;

    const manageUrl = "https://apps.apple.com/account/subscriptions";
    const opened = window.open(manageUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.assign(manageUrl);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await logOutRevenueCat();
    return signOut(auth);
  }, []);

  return {
    feedbackOpen,
    setFeedbackOpen,
    feedbackCategory,
    setFeedbackCategory,
    feedbackMessage,
    setFeedbackMessage,
    feedbackStatus,
    setFeedbackStatus,
    feedbackSubmitting,
    profileOpen,
    setProfileOpen,
    paywallOpen,
    setPaywallOpen,
    isPro,
    proSource,
    subscriptionBusy,
    subscriptionStatus,
    proPanelsOpen,
    setProPanelsOpen,
    screenTimeStatus,
    screenTimeSupported,
    screenTimeReason,
    screenTimeBusy,
    deletingAccount,
    accountDangerStatus,
    submitFeedback,
    handleStartProPreview,
    handleRestorePurchases,
    accountStateHydrated,
    handleRequestScreenTimeAuth,
    handleOpenScreenTimeSettings,
    handleDeleteAccount,
    openUpgradeFlow,
    handleManageSubscription,
    handleSignOut,
  };
}
