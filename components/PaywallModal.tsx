"use client";

import { useEffect, useMemo, useState } from "react";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";

import styles from "@/app/page.module.css";
import {
  getRevenueCatOfferings,
  getRevenueCatSupportState,
  hasActiveProEntitlement,
  purchaseRevenueCatPackage,
} from "@/lib/revenuecat";
import { WHELM_PRO_NAME, WHELM_STANDARD_NAME } from "@/lib/whelm-plans";

const WHELM_PRO_POSITIONING =
  "Whelm Pro unlocks unlimited history, full customization, deeper command reports, and the premium version of the Whelm system.";

function calculateSavingsLabel(monthlyPackage: PurchasesPackage | null, annualPackage: PurchasesPackage | null) {
  if (!monthlyPackage || !annualPackage) return "Best Value";

  const monthlyAnnualized = monthlyPackage.product.price * 12;
  if (monthlyAnnualized <= 0) return "Best Value";

  const savingsPercent = Math.round((1 - annualPackage.product.price / monthlyAnnualized) * 100);
  return savingsPercent > 0 ? `Save ${savingsPercent}%` : "Best Value";
}

export default function PaywallModal({
  open,
  userId,
  isPro,
  subscriptionStatus,
  onClose,
  onRestorePurchases,
}: {
  open: boolean;
  userId: string;
  isPro: boolean;
  subscriptionStatus: string;
  onClose: () => void;
  onRestorePurchases: () => void;
}) {
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [annualPackage, setAnnualPackage] = useState<PurchasesPackage | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [loading, setLoading] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open) return;

    const support = getRevenueCatSupportState();
    if (!support.supported) {
      setStatus(support.reason);
      return;
    }

    let active = true;
    setLoading(true);
    setStatus("");

    void (async () => {
      try {
        const offerings = await getRevenueCatOfferings(userId);
        if (!active) return;

        const currentOffering = offerings.current;
        if (!currentOffering) {
          throw new Error("No active RevenueCat offering is configured yet.");
        }

        const nextAnnualPackage = currentOffering.annual;
        const nextMonthlyPackage = currentOffering.monthly;

        setAnnualPackage(nextAnnualPackage);
        setMonthlyPackage(nextMonthlyPackage);
        setSelectedPackageId(
          nextAnnualPackage?.identifier ??
            nextMonthlyPackage?.identifier ??
            currentOffering.availablePackages[0]?.identifier ??
            "",
        );
      } catch (error: unknown) {
        if (!active) return;
        setStatus(
          error instanceof Error ? error.message : "Unable to load Whelm Pro pricing.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [open, userId]);

  const selectedPackage = useMemo(() => {
    return [annualPackage, monthlyPackage].find((item) => item?.identifier === selectedPackageId) ?? null;
  }, [annualPackage, monthlyPackage, selectedPackageId]);

  const annualSavingsLabel = useMemo(
    () => calculateSavingsLabel(monthlyPackage, annualPackage),
    [annualPackage, monthlyPackage],
  );

  async function handlePurchase() {
    if (!selectedPackage || purchaseBusy) return;

    setPurchaseBusy(true);
    setStatus("");

    try {
      const result = await purchaseRevenueCatPackage(userId, selectedPackage);
      if (hasActiveProEntitlement(result.customerInfo)) {
        onClose();
        return;
      }
      setStatus("Purchase completed, but Whelm Pro is not active yet. Try Restore purchases.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Purchase failed. Please try again.";
      if (!message.toLowerCase().includes("cancel")) {
        setStatus(message);
      }
    } finally {
      setPurchaseBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className={styles.feedbackOverlay} onClick={onClose}>
      <div className={styles.paywallModal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.feedbackHeader}>
          <div>
            <h2 className={styles.feedbackTitle}>Upgrade to {WHELM_PRO_NAME}</h2>
            <p className={styles.paywallHint}>Default selection: yearly</p>
          </div>
          <button type="button" className={styles.feedbackClose} onClick={onClose}>
            Close
          </button>
        </div>
        <p className={styles.paywallCopy}>{WHELM_PRO_POSITIONING}</p>
        <div className={styles.planGrid}>
          {annualPackage ? (
            <article
              className={`${styles.planCard} ${styles.planCardFeatured} ${
                selectedPackageId === annualPackage.identifier ? styles.planCardSelected : ""
              }`}
            >
              <button
                type="button"
                className={styles.planCardButton}
                onClick={() => setSelectedPackageId(annualPackage.identifier)}
              >
                <div className={styles.planBadgeRow}>
                  <p className={styles.planName}>{WHELM_PRO_NAME} Yearly</p>
                  <span className={styles.planBadge}>Best Value</span>
                </div>
                <p className={styles.planPrice}>{annualPackage.product.priceString} / year</p>
                <p className={styles.planMeta}>
                  {annualSavingsLabel} • 2 months free • 1-week free trial
                </p>
                {annualPackage.product.pricePerMonthString ? (
                  <p className={styles.planSubmeta}>
                    {annualPackage.product.pricePerMonthString} / month effective
                  </p>
                ) : null}
              </button>
            </article>
          ) : null}
          {monthlyPackage ? (
            <article
              className={`${styles.planCard} ${
                selectedPackageId === monthlyPackage.identifier ? styles.planCardSelected : ""
              }`}
            >
              <button
                type="button"
                className={styles.planCardButton}
                onClick={() => setSelectedPackageId(monthlyPackage.identifier)}
              >
                <div className={styles.planBadgeRow}>
                  <p className={styles.planName}>{WHELM_PRO_NAME} Monthly</p>
                </div>
                <p className={styles.planPrice}>{monthlyPackage.product.priceString} / month</p>
                <p className={styles.planMeta}>Flexible monthly billing</p>
              </button>
            </article>
          ) : null}
        </div>
        <ul className={styles.proList}>
          <li>Unlimited history for notes, blocks, sessions, and reflections</li>
          <li>Full customization across notes, calendar tones, themes, and premium styling</li>
          <li>Advanced reports, deeper insight, and the premium Whelm identity layer</li>
        </ul>
        <div className={styles.paywallActions}>
          <button
            type="button"
            className={styles.feedbackSubmit}
            onClick={() => void handlePurchase()}
            disabled={!selectedPackage || loading || purchaseBusy}
          >
            {purchaseBusy
              ? "Processing..."
              : isPro
                ? "Switch plan"
                : selectedPackage === annualPackage
                  ? "Start 1-week free trial"
                  : "Continue with monthly"}
          </button>
          <button
            type="button"
            className={styles.secondaryPlanButton}
            onClick={onRestorePurchases}
          >
            Restore purchases
          </button>
          <button type="button" className={styles.secondaryPlanButton} onClick={onClose}>
            Stay in {WHELM_STANDARD_NAME}
          </button>
        </div>
        <p className={styles.paywallHint}>
          {status || subscriptionStatus || "Subscriptions are handled through the App Store via RevenueCat."}
        </p>
      </div>
    </div>
  );
}
