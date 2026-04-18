"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";

import styles from "@/app/page.module.css";
import {
  getRevenueCatOfferings,
  getRevenueCatSupportState,
  hasActiveProEntitlement,
  purchaseRevenueCatPackage,
} from "@/lib/revenuecat";
import { WHELM_PRO_NAME, WHELM_STANDARD_HISTORY_DAYS, WHELM_STANDARD_NAME } from "@/lib/whelm-plans";

const WHELM_PRO_POSITIONING =
  "Keep your full system available with unlimited history, full customization, and deeper reports.";

const WEB_PRO_PLANS = [
  {
    id: "yearly",
    name: `${WHELM_PRO_NAME} Yearly`,
    price: "$39.99 / year",
    meta: "Save 33% • 1-week free trial",
    submeta: "$3.33 / month billed annually",
    featured: true,
  },
  {
    id: "monthly",
    name: `${WHELM_PRO_NAME} Monthly`,
    price: "$4.99 / month",
    meta: "Monthly access, billed every month",
    submeta: "",
    featured: false,
  },
] as const;

const WHELM_TIER_CARDS = [
  {
    id: "pro",
    name: WHELM_PRO_NAME,
    headline: "Full memory, full customization, full control",
    bullets: [
      "Unlimited archive across notes, blocks, sessions, and reflections",
      "Full note styling, calendar tones, and shell customization",
      "Advanced reports, archive export, readable notes export, and custom backgrounds",
    ],
  },
  {
    id: "standard",
    name: WHELM_STANDARD_NAME,
    headline: "Everyday momentum, lighter system depth",
    bullets: [
      `Core notes, blocks, sessions, and the last ${WHELM_STANDARD_HISTORY_DAYS} days of history`,
      "Basic note tones and limited calendar color control",
      `${WHELM_STANDARD_NAME} shell, core readouts, and no full archive export`,
    ],
  },
] as const;

function toUserFacingSubscriptionMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unable to load subscription details right now.";
  }

  const message = error.message.trim();
  const lowered = message.toLowerCase();

  if (
    lowered.includes("revenuecat") ||
    lowered.includes("api key") ||
    lowered.includes("offering") ||
    lowered.includes("configuration")
  ) {
    return "Subscription details are not available right now. Please try again shortly.";
  }

  return message || "Unable to load subscription details right now.";
}

function describeOfferingPackages(offerings: Awaited<ReturnType<typeof getRevenueCatOfferings>>) {
  const current = offerings.current;
  const allOfferings = Object.values(offerings.all);
  const summaries = allOfferings.map((offering) => {
    const packageSummary = offering.availablePackages
      .map((pkg) => `${pkg.packageType}:${pkg.product.identifier}`)
      .join(", ");
    return `${offering.identifier}[${offering.availablePackages.length}]${packageSummary ? ` ${packageSummary}` : ""}`;
  });

  return {
    currentIdentifier: current?.identifier ?? "none",
    currentPackageCount: current?.availablePackages.length ?? 0,
    offeringCount: allOfferings.length,
    summary: summaries.join(" | ") || "no-offerings",
  };
}

type WhelmTierCardId = (typeof WHELM_TIER_CARDS)[number]["id"];

function calculateSavingsLabel(monthlyPackage: PurchasesPackage | null, annualPackage: PurchasesPackage | null) {
  if (!monthlyPackage || !annualPackage) return "Best Value";

  const monthlyAnnualized = monthlyPackage.product.price * 12;
  if (monthlyAnnualized <= 0) return "Best Value";

  const savingsPercent = Math.round((1 - annualPackage.product.price / monthlyAnnualized) * 100);
  return savingsPercent > 0 ? `Save ${savingsPercent}%` : "Best Value";
}

function selectReviewableOffering(offerings: Awaited<ReturnType<typeof getRevenueCatOfferings>>) {
  if (offerings.current?.availablePackages?.length) {
    return offerings.current;
  }

  return (
    Object.values(offerings.all).find((offering) => offering.availablePackages.length > 0) ?? null
  );
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
  const revenueCatSupport = getRevenueCatSupportState();
  const purchaseFlowSupported = revenueCatSupport.supported;
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [annualPackage, setAnnualPackage] = useState<PurchasesPackage | null>(null);
  const [fallbackPackages, setFallbackPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [loading, setLoading] = useState(false);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [comparisonFocus, setComparisonFocus] = useState<WhelmTierCardId>("pro");
  const comparisonManualRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    if (!purchaseFlowSupported) {
      setStatus(revenueCatSupport.reason);
      return;
    }

    let active = true;
    setLoading(true);
    setStatus("");

    void (async () => {
      try {
        const offerings = await getRevenueCatOfferings(userId);
        if (!active) return;

        const diagnostic = describeOfferingPackages(offerings);
        console.info("[whelm:paywall] RevenueCat offerings", diagnostic);

        const currentOffering = selectReviewableOffering(offerings);
        if (!currentOffering) {
          throw new Error(
            `Subscription details are not available right now. RevenueCat returned ${diagnostic.offeringCount} offering(s); current=${diagnostic.currentIdentifier}; packages=${diagnostic.currentPackageCount}.`,
          );
        }

        const nextAnnualPackage = currentOffering.annual;
        const nextMonthlyPackage = currentOffering.monthly;
        const nextFallbackPackages = currentOffering.availablePackages.filter(
          (pkg) =>
            pkg.identifier !== nextAnnualPackage?.identifier &&
            pkg.identifier !== nextMonthlyPackage?.identifier,
        );

        setAnnualPackage(nextAnnualPackage);
        setMonthlyPackage(nextMonthlyPackage);
        setFallbackPackages(nextFallbackPackages);

        if (
          !nextAnnualPackage &&
          !nextMonthlyPackage &&
          nextFallbackPackages.length === 0
        ) {
          throw new Error(
            `Subscription details are not available right now. Offering "${currentOffering.identifier}" returned no usable packages. Available: ${diagnostic.summary}.`,
          );
        }

        setSelectedPackageId(
          nextAnnualPackage?.identifier ??
            nextMonthlyPackage?.identifier ??
            nextFallbackPackages[0]?.identifier ??
            "",
        );
      } catch (error: unknown) {
        if (!active) return;
        setStatus(toUserFacingSubscriptionMessage(error));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [open, purchaseFlowSupported, revenueCatSupport.reason, userId]);

  useEffect(() => {
    if (!open) return;

    comparisonManualRef.current = false;
    setComparisonFocus("pro");

    if (typeof window === "undefined" || !window.matchMedia("(max-width: 640px)").matches) {
      return;
    }

    const standardTimer = window.setTimeout(() => {
      if (!comparisonManualRef.current) {
        setComparisonFocus("standard");
      }
    }, 900);

    const proTimer = window.setTimeout(() => {
      if (!comparisonManualRef.current) {
        setComparisonFocus("pro");
      }
    }, 1900);

    return () => {
      window.clearTimeout(standardTimer);
      window.clearTimeout(proTimer);
    };
  }, [open]);

  const selectedPackage = useMemo(() => {
    return (
      [annualPackage, monthlyPackage, ...fallbackPackages].find(
        (item) => item?.identifier === selectedPackageId,
      ) ?? null
    );
  }, [annualPackage, fallbackPackages, monthlyPackage, selectedPackageId]);

  const annualSavingsLabel = useMemo(
    () => calculateSavingsLabel(monthlyPackage, annualPackage),
    [annualPackage, monthlyPackage],
  );

  const focusedTierCard = useMemo(() => {
    return WHELM_TIER_CARDS.find((card) => card.id === comparisonFocus) ?? WHELM_TIER_CARDS[0];
  }, [comparisonFocus]);

  function handleComparisonFocus(next: WhelmTierCardId) {
    comparisonManualRef.current = true;
    setComparisonFocus(next);
  }

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
          </div>
          <button type="button" className={styles.feedbackClose} onClick={onClose}>
            Close
          </button>
        </div>
        <p className={styles.paywallCopy}>{WHELM_PRO_POSITIONING}</p>
        <section className={styles.paywallCompare}>
          <div className={styles.paywallCompareSwitch}>
            {WHELM_TIER_CARDS.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`${styles.paywallCompareSwitchButton} ${
                  comparisonFocus === card.id ? styles.paywallCompareSwitchButtonActive : ""
                }`}
                onClick={() => handleComparisonFocus(card.id)}
              >
                {card.name}
              </button>
            ))}
          </div>
          <div className={styles.paywallTierDeck}>
            <article
              className={`${styles.paywallTierCard} ${
                focusedTierCard.id === "pro" ? styles.paywallTierCardFeatured : ""
              } ${focusedTierCard.id === "pro" ? styles.paywallTierCardPro : styles.paywallTierCardStandard} ${
                styles.paywallTierCardPrimary
              }`}
            >
              <div className={styles.paywallTierBadgeRow}>
                <p
                  className={`${styles.paywallTierLabel} ${
                    focusedTierCard.id === "pro"
                      ? styles.paywallTierLabelPro
                      : styles.paywallTierLabelStandard
                  }`}
                >
                  {focusedTierCard.name}
                </p>
                {focusedTierCard.id === "pro" ? <span className={styles.planBadge}>Best Value</span> : null}
              </div>
              <p
                className={`${styles.paywallTierHeading} ${
                  focusedTierCard.id === "pro"
                    ? styles.paywallTierHeadingPro
                    : styles.paywallTierHeadingStandard
                }`}
              >
                {focusedTierCard.headline}
              </p>
              <ul
                className={`${styles.paywallTierList} ${
                  focusedTierCard.id === "pro"
                    ? styles.paywallTierListPro
                    : styles.paywallTierListStandard
                }`}
              >
                {focusedTierCard.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>
        <div className={styles.planGrid}>
          {purchaseFlowSupported ? (
            <>
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
                    {annualSavingsLabel} • 1-week free trial
                  </p>
                  {annualPackage.product.pricePerMonthString ? (
                    <p className={styles.planSubmeta}>
                      {annualPackage.product.pricePerMonthString} / month billed annually
                    </p>
                  ) : null}
                  </button>
                </article>
              ) : null}
              {monthlyPackage ? (
                <article
                  className={`${styles.planCard} ${styles.planCardPremiumAlt} ${
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
                  <p className={styles.planMeta}>Monthly access, billed every month</p>
                </button>
              </article>
              ) : null}
              {fallbackPackages.map((pkg) => (
                <article
                  key={pkg.identifier}
                  className={`${styles.planCard} ${
                    selectedPackageId === pkg.identifier ? styles.planCardSelected : ""
                  }`}
                >
                  <button
                    type="button"
                    className={styles.planCardButton}
                    onClick={() => setSelectedPackageId(pkg.identifier)}
                  >
                    <div className={styles.planBadgeRow}>
                      <p className={styles.planName}>{pkg.product.title || WHELM_PRO_NAME}</p>
                    </div>
                    <p className={styles.planPrice}>
                      {pkg.product.priceString}
                    </p>
                    <p className={styles.planMeta}>Available App Store subscription</p>
                  </button>
                </article>
              ))}
            </>
          ) : (
            <>
              {WEB_PRO_PLANS.map((plan) => (
                <article
                  key={plan.id}
                  className={`${styles.planCard} ${
                    plan.featured ? styles.planCardFeatured : styles.planCardPremiumAlt
                  }`}
                >
                  <div className={styles.planCardButton}>
                    <div className={styles.planBadgeRow}>
                      <p className={styles.planName}>{plan.name}</p>
                      {plan.featured ? <span className={styles.planBadge}>Best Value</span> : null}
                    </div>
                    <p className={styles.planPrice}>{plan.price}</p>
                    <p className={styles.planMeta}>{plan.meta}</p>
                    {plan.submeta ? <p className={styles.planSubmeta}>{plan.submeta}</p> : null}
                  </div>
                </article>
              ))}
            </>
          )}
        </div>
        <div className={styles.paywallActions}>
          {purchaseFlowSupported ? (
            <>
              <button
                type="button"
                className={styles.feedbackSubmit}
                onClick={() => void handlePurchase()}
                disabled={!selectedPackage || loading || purchaseBusy}
              >
                {purchaseBusy
                  ? "Processing..."
                  : !selectedPackage
                    ? "Subscription details unavailable"
                  : isPro
                    ? "Switch plan"
                    : annualPackage && selectedPackage.identifier === annualPackage.identifier
                      ? "Start 1-week free trial"
                      : monthlyPackage && selectedPackage.identifier === monthlyPackage.identifier
                        ? "Continue with monthly"
                        : "Continue with subscription"}
              </button>
              <button
                type="button"
                className={styles.secondaryPlanButton}
                onClick={onRestorePurchases}
              >
                Restore purchases
              </button>
            </>
          ) : null}
          <button type="button" className={styles.secondaryPlanButton} onClick={onClose}>
            Stay in {WHELM_STANDARD_NAME}
          </button>
        </div>
        <p className={styles.paywallHint}>
          {status ||
            subscriptionStatus ||
            (purchaseFlowSupported
              ? "Subscriptions are handled through the App Store."
              : "Whelm Pro subscriptions are currently available in the native iOS app. Install the iPhone app to start a trial, restore purchases, or manage your plan with Apple.")}
        </p>
      </div>
    </div>
  );
}
