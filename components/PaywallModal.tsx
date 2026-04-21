"use client";

import styles from "@/app/page.module.css";
import SubscriptionPlansPanel from "@/components/SubscriptionPlansPanel";
import { WHELM_PRO_NAME } from "@/lib/whelm-plans";

const WHELM_PRO_POSITIONING =
  "Keep your full system available with unlimited history, full customization, and deeper reports.";

export default function PaywallModal({
  open,
  userId,
  isPro,
  subscriptionBusy,
  subscriptionStatus,
  onClose,
  onRestorePurchases,
}: {
  open: boolean;
  userId: string;
  isPro: boolean;
  subscriptionBusy: boolean;
  subscriptionStatus: string;
  onClose: () => void;
  onRestorePurchases: () => void;
}) {
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
        <SubscriptionPlansPanel
          userId={userId}
          isPro={isPro}
          subscriptionBusy={subscriptionBusy}
          subscriptionStatus={subscriptionStatus}
          onRestorePurchases={onRestorePurchases}
          onPurchaseSuccess={onClose}
          showStayOnStandard
          onStayOnStandard={onClose}
        />
      </div>
    </div>
  );
}
