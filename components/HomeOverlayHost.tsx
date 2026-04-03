"use client";

import { memo, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";

import type { WhelBandanaColor } from "@/lib/whelm-mascot";
import BlockDetailModal from "@/components/BlockDetailModal";
import DailyPlanningModal from "@/components/DailyPlanningModal";
import FeedbackModal from "@/components/FeedbackModal";
import KpiDetailModal from "@/components/KpiDetailModal";
import LeaderboardProfileModal from "@/components/LeaderboardProfileModal";
import MobileMoreSheet from "@/components/MobileMoreSheet";
import OnboardingTour, { type OnboardingTourStep } from "@/components/OnboardingTour";
import PaywallModal from "@/components/PaywallModal";
import ProfileSheet from "@/components/ProfileSheet";
import QuickCardModal from "@/components/QuickCardModal";
import SessionRewardToast from "@/components/SessionRewardToast";
import StreakOverlayCluster from "@/components/StreakOverlayCluster";
import ThemePromptModal from "@/components/ThemePromptModal";
import WhelMascot from "@/components/WhelMascot";
import WhelToastContainer from "@/components/WhelToast";
import XPPopAnimation from "@/components/XPPopAnimation";

type HomeOverlayHostProps = {
  notificationsBlocked: boolean;
  sessionReward: React.ComponentProps<typeof SessionRewardToast>["reward"] | null;
  onDismissSessionReward: () => void;
  getStreakTierColorTheme: React.ComponentProps<typeof SessionRewardToast>["getStreakTierColorTheme"];
  currentTierColor: WhelBandanaColor | null | undefined;
  isPro: boolean;
  photoUrl?: string | null;
  xpPops: React.ComponentProps<typeof XPPopAnimation>["pops"];
  onDoneXPPop: React.ComponentProps<typeof XPPopAnimation>["onDone"];
  whelToasts: React.ComponentProps<typeof WhelToastContainer>["toasts"];
  onDismissToast: (id: string) => void;
  profileSheetProps: React.ComponentProps<typeof ProfileSheet>;
  mobileMoreSheetProps: React.ComponentProps<typeof MobileMoreSheet>;
  blockDetailModalProps: React.ComponentProps<typeof BlockDetailModal>;
  dailyPlanningModalProps: React.ComponentProps<typeof DailyPlanningModal>;
  themePromptModalProps: React.ComponentProps<typeof ThemePromptModal>;
  streakOverlayClusterProps: React.ComponentProps<typeof StreakOverlayCluster>;
  paywallModalProps: React.ComponentProps<typeof PaywallModal>;
  kpiDetailModalProps: React.ComponentProps<typeof KpiDetailModal>;
  feedbackModalProps: React.ComponentProps<typeof FeedbackModal>;
  onboardingTourProps: React.ComponentProps<typeof OnboardingTour>;
  quickCardModalProps: React.ComponentProps<typeof QuickCardModal>;
  mascot: {
    visible: boolean;
    pose: React.ComponentProps<typeof WhelMascot>["pose"];
    message: React.ComponentProps<typeof WhelMascot>["message"];
  };
  onDismissMascot: () => void;
  leaderboardProfileModalProps: React.ComponentProps<typeof LeaderboardProfileModal>;
};

const HomeOverlayHost = memo(function HomeOverlayHost({
  notificationsBlocked,
  sessionReward,
  onDismissSessionReward,
  getStreakTierColorTheme,
  currentTierColor,
  isPro,
  photoUrl,
  xpPops,
  onDoneXPPop,
  whelToasts,
  onDismissToast,
  profileSheetProps,
  mobileMoreSheetProps,
  blockDetailModalProps,
  dailyPlanningModalProps,
  themePromptModalProps,
  streakOverlayClusterProps,
  paywallModalProps,
  kpiDetailModalProps,
  feedbackModalProps,
  onboardingTourProps,
  quickCardModalProps,
  mascot,
  onDismissMascot,
  leaderboardProfileModalProps,
}: HomeOverlayHostProps) {
  return (
    <>
      <AnimatePresence>
        {!notificationsBlocked && sessionReward ? (
          <SessionRewardToast
            reward={sessionReward}
            onDismiss={onDismissSessionReward}
            getStreakTierColorTheme={getStreakTierColorTheme}
            currentTierColor={currentTierColor}
            isPro={isPro}
            photoUrl={photoUrl}
          />
        ) : null}
      </AnimatePresence>

      <XPPopAnimation
        pops={xpPops}
        onDone={onDoneXPPop}
        currentTierColor={currentTierColor}
        isPro={isPro}
        photoUrl={photoUrl}
      />
      <WhelToastContainer
        toasts={whelToasts}
        onDismiss={onDismissToast}
        currentTierColor={currentTierColor}
        isPro={isPro}
        photoUrl={photoUrl}
      />

      <ProfileSheet {...profileSheetProps} />
      <MobileMoreSheet {...mobileMoreSheetProps} />
      <BlockDetailModal {...blockDetailModalProps} />
      <DailyPlanningModal {...dailyPlanningModalProps} />
      <ThemePromptModal {...themePromptModalProps} />
      <StreakOverlayCluster {...streakOverlayClusterProps} />
      <PaywallModal {...paywallModalProps} />
      <KpiDetailModal {...kpiDetailModalProps} />
      <FeedbackModal {...feedbackModalProps} />
      <OnboardingTour {...onboardingTourProps} />
      <QuickCardModal {...quickCardModalProps} />

      {!onboardingTourProps.open && mascot.visible ? (
        <WhelMascot
          pose={mascot.pose}
          bandanaColor={currentTierColor ?? "yellow"}
          message={mascot.message}
          onDismiss={onDismissMascot}
        />
      ) : null}

      <LeaderboardProfileModal {...leaderboardProfileModalProps} />
    </>
  );
});

export default HomeOverlayHost;
