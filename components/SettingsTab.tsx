"use client";

import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import { memo, useId, useMemo, type ChangeEvent, type Ref, type RefObject } from "react";

import sharedStyles from "@/app/page.module.css";
import AnimatedTabSection from "@/components/AnimatedTabSection";
import ProUnlockCard from "@/components/ProUnlockCard";
import styles from "@/components/SettingsTab.module.css";
import WhelmProfileAvatar from "@/components/WhelmProfileAvatar";
import type { SenseiVariant } from "@/components/SenseiFigure";
import type { WhelBandanaColor } from "@/lib/whelm-mascot";
import type { StreakBandanaTier } from "@/lib/streak-bandanas";
import type {
  PreferencesBackgroundSetting,
  PreferencesBackgroundSkin,
} from "@/lib/preferences-store";
import type { ScreenTimeAuthorizationStatus } from "@/lib/screentime";
import type { ProfileTierTheme } from "@/lib/profile-tier";
import { WHELM_PRO_NAME, WHELM_STANDARD_NAME } from "@/lib/whelm-plans";

const PRO_BACKGROUND_PRESETS = [
  {
    id: "whelm_core",
    label: "Core Glow",
    background:
      "radial-gradient(circle at 50% 12%, rgba(158, 212, 255, 0.46), transparent 24%), radial-gradient(circle at 50% 50%, rgba(72, 108, 255, 0.34), transparent 30%), radial-gradient(circle at 50% 78%, rgba(201, 96, 255, 0.28), transparent 22%), linear-gradient(180deg, #3a63c7 0%, #2d4ea8 24%, #2d328f 56%, #37257b 78%, #2a1f63 100%)",
  },
  {
    id: "blue_halo",
    label: "Blue Halo",
    background:
      "radial-gradient(circle at 50% 10%, rgba(181, 244, 255, 0.48), transparent 22%), radial-gradient(circle at 46% 46%, rgba(74, 211, 255, 0.34), transparent 28%), radial-gradient(circle at 56% 72%, rgba(86, 120, 255, 0.26), transparent 22%), linear-gradient(180deg, #2e72d6 0%, #2558ba 28%, #24439b 62%, #25306e 100%)",
  },
  {
    id: "violet_orbit",
    label: "Violet Orbit",
    background:
      "radial-gradient(circle at 50% 10%, rgba(187, 144, 255, 0.34), transparent 22%), radial-gradient(circle at 48% 44%, rgba(140, 88, 255, 0.3), transparent 28%), radial-gradient(circle at 52% 76%, rgba(247, 109, 255, 0.3), transparent 22%), linear-gradient(180deg, #5b56cf 0%, #4b3db3 28%, #4a2f93 62%, #331d63 100%)",
  },
  {
    id: "midnight_glass",
    label: "Night Pulse",
    background:
      "radial-gradient(circle at 50% 10%, rgba(255, 255, 255, 0.2), transparent 18%), radial-gradient(circle at 50% 42%, rgba(112, 143, 255, 0.24), transparent 26%), radial-gradient(circle at 50% 74%, rgba(154, 87, 255, 0.22), transparent 20%), linear-gradient(180deg, #314a8e 0%, #28396f 30%, #241f53 66%, #171334 100%)",
  },
] as const;

const WHELM_PRO_POSITIONING =
  "Whelm Pro opens the deeper layer of Whelm: longer memory, fuller customization, and expanded control over the app shell.";

function formatSenseiLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function SettingsRow({
  title,
  summary,
  active,
  onClick,
}: {
  title: string;
  summary?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.settingsIndexRow} ${active ? styles.settingsIndexRowActive : ""}`}
      onClick={onClick}
    >
      <div className={styles.settingsIndexCopy}>
        <strong>{title}</strong>
        {summary ? <span>{summary}</span> : null}
      </div>
      <span className={styles.settingsIndexChevron}>{active ? "−" : "›"}</span>
    </button>
  );
}

function SettingsDetailHeader({
  sectionLabel,
  title,
  body,
  onBack,
}: {
  sectionLabel: string;
  title: string;
  body?: string;
  onBack: () => void;
}) {
  return (
    <div className={styles.settingsDetailTopbar}>
      <button type="button" className={styles.settingsBackButton} onClick={onBack}>
        ‹
      </button>
      <div className={styles.settingsDetailHeader}>
        <p className={sharedStyles.sectionLabel}>{sectionLabel}</p>
        <h2 className={sharedStyles.cardTitle}>{title}</h2>
        {body ? <p className={sharedStyles.accountMeta}>{body}</p> : null}
      </div>
    </div>
  );
}

function SettingsToggleRow({
  title,
  summary,
  active,
  disabled,
  onClick,
}: {
  title: string;
  summary?: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const switchId = useId();

  return (
    <label
      htmlFor={switchId}
      className={`${styles.settingsToggleRow} ${active ? styles.settingsToggleRowActive : ""}`}
      data-disabled={disabled ? "true" : undefined}
    >
      <div className={styles.settingsIndexCopy}>
        <strong>{title}</strong>
        {summary ? <span>{summary}</span> : null}
      </div>
      <Switch.Root
        id={switchId}
        checked={active}
        disabled={disabled}
        className={styles.settingsToggle}
        onCheckedChange={onClick}
        aria-label={title}
      >
        <Switch.Thumb className={styles.settingsToggleThumb} />
      </Switch.Root>
    </label>
  );
}

function SettingsSliderRow({
  title,
  valueLabel,
  value,
  min,
  max,
  step = 1,
  onValueChange,
}: {
  title: string;
  valueLabel: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <label className={styles.backgroundSkinControl}>
      <span>{title}</span>
      <strong>{valueLabel}</strong>
      <Slider.Root
        className={styles.settingsSlider}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => {
          const first = next[0];
          if (typeof first === "number") {
            onValueChange(first);
          }
        }}
        aria-label={title}
      >
        <Slider.Track className={styles.settingsSliderTrack}>
          <Slider.Range className={styles.settingsSliderRange} />
        </Slider.Track>
        <Slider.Thumb className={styles.settingsSliderThumb} />
      </Slider.Root>
    </label>
  );
}

function SettingsActionRow({
  title,
  summary,
  onClick,
  disabled,
  emphasis = "default",
  dataTour,
}: {
  title: string;
  summary?: string;
  onClick: () => void;
  disabled?: boolean;
  emphasis?: "default" | "danger";
  dataTour?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.settingsActionRow} ${emphasis === "danger" ? styles.settingsActionRowDanger : ""}`}
      onClick={onClick}
      disabled={disabled}
      data-tour={dataTour}
    >
      <div className={styles.settingsIndexCopy}>
        <strong>{title}</strong>
        {summary ? <span>{summary}</span> : null}
      </div>
      <span className={styles.settingsIndexChevron}>›</span>
    </button>
  );
}

type SettingsSectionsOpen = {
  identity: boolean;
  internalTools: boolean;
  protocol: boolean;
  appearance: boolean;
  background: boolean;
  archive: boolean;
  notifications: boolean;
  sync: boolean;
  screenTime: boolean;
  danger: boolean;
  legal: boolean;
};

type NextBandanaMilestone = {
  tier: StreakBandanaTier;
  remainingDays: number;
  targetDate: Date;
} | null;

type CompanionPulseData = {
  eyebrow: string;
  title: string;
  body: string;
  variant: SenseiVariant;
};

type ActiveSettingsSection = keyof SettingsSectionsOpen | null;

export type SettingsTabProps = {
  companionPulse: CompanionPulseData;
  bandanaColor: WhelBandanaColor;
  sectionRef?: Ref<HTMLElement>;
  primaryRef?: Ref<HTMLElement>;
  streakBandanaTier: StreakBandanaTier | null;
  isPro: boolean;
  photoUrl: string | null | undefined;
  displayName: string | null | undefined;
  email: string | null | undefined;
  profileTierTheme: ProfileTierTheme;
  nextBandanaMilestone: NextBandanaMilestone;
  proSource: "preview" | "store" | "none";
  streak: number;
  companionStyle: "gentle" | "balanced" | "strict";
  themeMode: "dark" | "light" | "system";
  sectionsOpen: SettingsSectionsOpen;
  onToggleSection: (key: keyof SettingsSectionsOpen) => void;
  onFeedbackOpen: () => void;
  onReplayTutorial: () => void;
  onStartProPreview: () => void;
  onManageSubscription: () => void;
  onRestorePurchases: () => void;
  subscriptionBusy: boolean;
  subscriptionStatus: string;
  onSignOut: () => void;
  onApplyCompanionStyle: (style: "gentle" | "balanced" | "strict") => void;
  onApplyThemeMode: (mode: "dark" | "light" | "system") => void;
  appBackgroundSetting: PreferencesBackgroundSetting;
  backgroundSkin: PreferencesBackgroundSkin;
  backgroundUploadInputRef: RefObject<HTMLInputElement | null>;
  onBackgroundUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onApplyBackgroundSetting: (setting: PreferencesBackgroundSetting) => void;
  onUpdateBackgroundSkin: (skin: PreferencesBackgroundSkin) => void;
  proPanelBackgroundOpen: boolean;
  onToggleProBackgroundPanel: () => void;
  archiveExportBusy: boolean;
  archiveExportStatus: string;
  onExportArchive: () => void;
  notesExportBusy: boolean;
  notesExportStatus: string;
  onExportNotes: () => void;
  archiveImportBusy: boolean;
  archiveImportInputRef: RefObject<HTMLInputElement | null>;
  onImportArchive: (e: ChangeEvent<HTMLInputElement>) => void;
  pendingArchiveImport: {
    fileName: string;
    version: string;
    tier: string;
    exportedAtISO: string;
    notes: number;
    plannedBlocks: number;
    sessions: number;
    cards: number;
    mirrorEntries: number;
    sickDaySaves: number;
  } | null;
  onConfirmArchiveImport: () => void;
  onCancelArchiveImport: () => void;
  notesSyncStatus: "synced" | "syncing" | "local-only" | "error";
  notesSyncMessage: string;
  onRetrySync: () => void;
  notificationSettings: {
    enabled: boolean;
    performanceNudges: boolean;
    noteReminders: boolean;
  };
  notificationPermissionState: "unsupported" | "default" | "granted" | "denied";
  notificationDeliveryMode: "native" | "web" | "unsupported";
  notificationBusy: boolean;
  notificationStatus: string;
  scheduledNotificationCount: number;
  onApplyNotificationSettings: (settings: {
    enabled: boolean;
    performanceNudges: boolean;
    noteReminders: boolean;
  }) => void;
  onRequestNotificationPermission: () => void;
  onResyncNotifications: () => void;
  screenTimeSupported: boolean;
  screenTimeStatus: ScreenTimeAuthorizationStatus;
  screenTimeReason: string;
  screenTimeBusy: boolean;
  onRequestScreenTimeAuth: () => void;
  onOpenScreenTimeSettings: () => void;
  deletingAccount: boolean;
  onDeleteAccount: () => void;
  accountDangerStatus: string;
  onPreviewStreakMirror: () => void;
  onPreviewDailyCommitment: () => void;
  onPreviewStreakAlert: () => void;
};

const SettingsIndexPanel = memo(function SettingsIndexPanel({
  primaryRef,
  displayName,
  isPro,
  streakBandanaTier,
  photoUrl,
  preferencesActive,
  activeSection,
  email,
  normalizedNotificationSettings,
  onToggleSection,
}: {
  primaryRef?: Ref<HTMLElement>;
  displayName: string | null | undefined;
  isPro: boolean;
  streakBandanaTier: StreakBandanaTier | null;
  photoUrl: string | null | undefined;
  preferencesActive: boolean;
  activeSection: ActiveSettingsSection;
  email: string | null | undefined;
  normalizedNotificationSettings: SettingsTabProps["notificationSettings"];
  onToggleSection: (key: keyof SettingsSectionsOpen) => void;
}) {
  return (
    <article className={`${sharedStyles.card} ${styles.settingsIndexCard}`} ref={primaryRef}>
      <div className={styles.settingsIndexHeader}>
        <div>
          <p className={sharedStyles.sectionLabel}>Settings</p>
          <h2 className={sharedStyles.cardTitle}>Whelm settings</h2>
          <p className={sharedStyles.accountMeta}>
            {displayName || "Whelm user"} · {isPro ? WHELM_PRO_NAME : WHELM_STANDARD_NAME}
          </p>
        </div>
        <WhelmProfileAvatar
          tierColor={streakBandanaTier?.color}
          size="compact"
          isPro={isPro}
          photoUrl={photoUrl}
        />
      </div>

      <div className={styles.settingsIndexGroup}>
        <p className={styles.settingsIndexLabel}>Account</p>
        <SettingsRow
          title="Preferences"
          summary="Theme, Whelm tone, shell, and behavior"
          active={preferencesActive}
          onClick={() => onToggleSection("identity")}
        />
        <SettingsRow
          title="Profile"
          summary={email || "Account details"}
          active={activeSection === "danger"}
          onClick={() => onToggleSection("danger")}
        />
        <SettingsRow
          title="Notifications"
          summary={normalizedNotificationSettings.enabled ? "Whelm nudges active" : "Notifications off"}
          active={activeSection === "notifications"}
          onClick={() => onToggleSection("notifications")}
        />
      </div>

      <div className={styles.settingsIndexGroup}>
        <p className={styles.settingsIndexLabel}>Subscription</p>
        <SettingsRow
          title="Subscription"
          summary={isPro ? `${WHELM_PRO_NAME} active` : `Using ${WHELM_STANDARD_NAME}`}
          active={activeSection === "sync"}
          onClick={() => onToggleSection("sync")}
        />
        <SettingsRow
          title="Archive"
          summary="Export and restore your Whelm"
          active={activeSection === "archive"}
          onClick={() => onToggleSection("archive")}
        />
      </div>

      <div className={styles.settingsIndexGroup}>
        <p className={styles.settingsIndexLabel}>Support</p>
        <SettingsRow
          title="Device access"
          summary="Focus permissions and sync status"
          active={activeSection === "screenTime"}
          onClick={() => onToggleSection("screenTime")}
        />
        <SettingsRow
          title="Support"
          summary="Feedback and guided tools"
          active={activeSection === "internalTools"}
          onClick={() => onToggleSection("internalTools")}
        />
        <SettingsRow
          title="Legal"
          summary="Privacy, terms, and acknowledgements"
          active={activeSection === "legal"}
          onClick={() => onToggleSection("legal")}
        />
      </div>

      <div className={styles.settingsLegalLinks}>
        <a href="/privacy" className={styles.settingsLegalLink}>Privacy Policy</a>
        <a href="/terms" className={styles.settingsLegalLink}>Terms of Service</a>
        <a href="/acknowledgements" className={styles.settingsLegalLink}>Acknowledgements</a>
      </div>
    </article>
  );
});

const SettingsDetailPanels = memo(function SettingsDetailPanels({
  activeSection,
  closeActiveSection,
  displayName,
  isPro,
  email,
  streakBandanaTier,
  photoUrl,
  nextBandanaMilestone,
  proSource,
  streak,
  companionStyle,
  themeMode,
  onApplyCompanionStyle,
  onApplyThemeMode,
  backgroundUploadInputRef,
  onBackgroundUpload,
  appBackgroundSetting,
  onApplyBackgroundSetting,
  backgroundSkin,
  onUpdateBackgroundSkin,
  proPanelBackgroundOpen,
  onToggleProBackgroundPanel,
  onStartProPreview,
  normalizedNotificationSettings,
  notificationDeliveryMode,
  notificationPermissionState,
  scheduledNotificationCount,
  onApplyNotificationSettings,
  onRequestNotificationPermission,
  onResyncNotifications,
  notificationBusy,
  notificationStatus,
  subscriptionBusy,
  subscriptionStatus,
  onRestorePurchases,
  onManageSubscription,
  archiveImportInputRef,
  onImportArchive,
  archiveExportBusy,
  onExportArchive,
  notesExportBusy,
  onExportNotes,
  archiveImportBusy,
  pendingArchiveImport,
  onConfirmArchiveImport,
  onCancelArchiveImport,
  archiveExportStatus,
  notesExportStatus,
  notesSyncStatus,
  notesSyncMessage,
  onRetrySync,
  screenTimeSupported,
  screenTimeStatus,
  screenTimeReason,
  screenTimeBusy,
  onRequestScreenTimeAuth,
  onOpenScreenTimeSettings,
  onFeedbackOpen,
  onReplayTutorial,
  onPreviewStreakMirror,
  onPreviewDailyCommitment,
  onPreviewStreakAlert,
  onSignOut,
  deletingAccount,
  onDeleteAccount,
  accountDangerStatus,
}: {
  activeSection: ActiveSettingsSection;
  closeActiveSection: () => void;
} & Omit<SettingsTabProps, "sectionRef" | "primaryRef" | "sectionsOpen" | "onToggleSection" | "companionPulse" | "bandanaColor" | "profileTierTheme" | "notificationSettings"> & {
  normalizedNotificationSettings: SettingsTabProps["notificationSettings"];
}) {
  const navigateTo = (href: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(href);
    }
  };

  return (
    <>
      {activeSection === "notifications" ? (
        <article className={`${sharedStyles.card} ${styles.settingsDetailCard}`}>
          <SettingsDetailHeader
            sectionLabel="Notifications"
            title="Whelm nudges"
            body={
              notificationDeliveryMode === "native"
                ? "Delivered on your device."
                : notificationDeliveryMode === "web"
                  ? "Delivered through the browser."
                  : "Notifications are not supported here."
            }
            onBack={closeActiveSection}
          />
          <ul className={styles.settingsList}>
            <li><span>Permission</span><strong>{notificationPermissionState}</strong></li>
            <li><span>Delivery</span><strong>{notificationDeliveryMode}</strong></li>
            <li><span>Queued now</span><strong>{scheduledNotificationCount}</strong></li>
          </ul>
          <div className={styles.settingsDetailBlock}>
            <SettingsToggleRow
              title="Notifications"
              summary="Allow Whelm to reach you."
              active={normalizedNotificationSettings.enabled}
              onClick={() =>
                onApplyNotificationSettings({
                  ...normalizedNotificationSettings,
                  enabled: !normalizedNotificationSettings.enabled,
                })
              }
            />
            <SettingsToggleRow
              title="Whelm nudges"
              summary="Momentum, streak, and focus reminders."
              active={normalizedNotificationSettings.performanceNudges}
              disabled={!normalizedNotificationSettings.enabled}
              onClick={() =>
                onApplyNotificationSettings({
                  ...normalizedNotificationSettings,
                  performanceNudges: !normalizedNotificationSettings.performanceNudges,
                })
              }
            />
            <SettingsToggleRow
              title="Note reminders"
              summary="Your scheduled note reminders."
              active={normalizedNotificationSettings.noteReminders}
              disabled={!normalizedNotificationSettings.enabled}
              onClick={() =>
                onApplyNotificationSettings({
                  ...normalizedNotificationSettings,
                  noteReminders: !normalizedNotificationSettings.noteReminders,
                })
              }
            />
          </div>
          <div className={sharedStyles.noteFooterActions}>
            <button
              type="button"
              className={sharedStyles.reportButton}
              onClick={onRequestNotificationPermission}
              disabled={notificationBusy || notificationPermissionState === "granted"}
            >
              {notificationBusy
                ? "Working..."
                : notificationPermissionState === "granted"
                  ? "Permission granted"
                  : "Enable notifications"}
            </button>
            <button
              type="button"
              className={sharedStyles.secondaryPlanButton}
              onClick={onResyncNotifications}
              disabled={notificationBusy}
            >
              Refresh delivery
            </button>
          </div>
          {notificationStatus ? <p className={sharedStyles.accountMeta}>{notificationStatus}</p> : null}
        </article>
      ) : null}

      {activeSection === "sync" ? (
        <article className={`${sharedStyles.card} ${styles.settingsDetailCard}`}>
          <SettingsDetailHeader
            sectionLabel="Subscription"
            title="Plan and access"
            body={isPro ? "You’re in the deeper Whelm layer." : "Upgrade when you want longer memory and fuller control."}
            onBack={closeActiveSection}
          />
          <ul className={styles.settingsList}>
            <li><span>Plan</span><strong>{isPro ? WHELM_PRO_NAME : WHELM_STANDARD_NAME}</strong></li>
            <li><span>Status</span><strong>{proSource === "preview" ? `${WHELM_PRO_NAME} Access` : isPro ? `${WHELM_PRO_NAME} Active` : WHELM_STANDARD_NAME}</strong></li>
            <li><span>Streak</span><strong>{streak}d</strong></li>
          </ul>
          <div className={styles.settingsDetailBlock}>
            {!isPro ? (
              <>
                <SettingsActionRow
                  title="Upgrade to Whelm Pro"
                  summary="See the full comparison and unlocks."
                  onClick={onStartProPreview}
                />
                <SettingsActionRow
                  title={subscriptionBusy ? "Restoring..." : "Restore purchases"}
                  summary="Reconnect your App Store purchases."
                  onClick={onRestorePurchases}
                  disabled={subscriptionBusy}
                />
              </>
            ) : (
              <>
                <SettingsActionRow
                  title="Compare plans"
                  summary="See Standard versus Pro again."
                  onClick={onStartProPreview}
                />
                <SettingsActionRow
                  title="Manage subscription"
                  summary="Open Apple subscription controls."
                  onClick={onManageSubscription}
                />
                <SettingsActionRow
                  title={subscriptionBusy ? "Checking..." : "Restore purchases"}
                  summary="Refresh this device’s purchase state."
                  onClick={onRestorePurchases}
                  disabled={subscriptionBusy}
                />
              </>
            )}
          </div>
          {subscriptionStatus ? <p className={sharedStyles.accountMeta}>{subscriptionStatus}</p> : null}
        </article>
      ) : null}

      {activeSection === "archive" ? (
        <article className={`${sharedStyles.card} ${styles.settingsDetailCard}`}>
          <SettingsDetailHeader
            sectionLabel="Archive"
            title="Export and recovery"
            body="Back up your Whelm or bring it back."
            onBack={closeActiveSection}
          />
          {isPro ? (
            <>
              <input
                ref={archiveImportInputRef}
                type="file"
                accept="application/json,.json"
                className={styles.backgroundUploadInput}
                onChange={onImportArchive}
              />
              <p className={sharedStyles.accountMeta}>
                {WHELM_PRO_NAME} can export a full archive snapshot for backup, recovery, or moving your history somewhere safe.
              </p>
              <div className={sharedStyles.noteFooterActions}>
                <button
                  type="button"
                  className={sharedStyles.reportButton}
                  onClick={onExportArchive}
                  disabled={archiveExportBusy}
                >
                  {archiveExportBusy ? "Preparing archive..." : "Export Whelm archive"}
                </button>
                <button
                  type="button"
                  className={sharedStyles.secondaryPlanButton}
                  onClick={onExportNotes}
                  disabled={notesExportBusy}
                >
                  {notesExportBusy ? "Preparing notes zip..." : "Export notes as Markdown"}
                </button>
                <button
                  type="button"
                  className={sharedStyles.secondaryPlanButton}
                  onClick={() => archiveImportInputRef.current?.click()}
                  disabled={archiveImportBusy}
                >
                  {archiveImportBusy ? "Restoring archive..." : "Import Whelm archive"}
                </button>
              </div>
              {pendingArchiveImport ? (
                <div className={styles.backgroundSkinPanel}>
                  <div className={styles.backgroundSkinHeader}>
                    <div>
                      <strong>Archive ready to merge</strong>
                      <p className={sharedStyles.accountMeta}>
                        Review the archive first. Importing merges it into this account and keeps your current {WHELM_PRO_NAME} access state.
                      </p>
                    </div>
                  </div>
                  <ul className={styles.settingsList}>
                    <li><span>File</span><strong>{pendingArchiveImport.fileName}</strong></li>
                    <li><span>Archive version</span><strong>{pendingArchiveImport.version}</strong></li>
                    <li><span>Source tier</span><strong>{pendingArchiveImport.tier}</strong></li>
                    <li><span>Exported</span><strong>{new Date(pendingArchiveImport.exportedAtISO).toLocaleString()}</strong></li>
                    <li><span>Notes</span><strong>{pendingArchiveImport.notes}</strong></li>
                    <li><span>Blocks</span><strong>{pendingArchiveImport.plannedBlocks}</strong></li>
                    <li><span>Sessions</span><strong>{pendingArchiveImport.sessions}</strong></li>
                    <li><span>Cards</span><strong>{pendingArchiveImport.cards}</strong></li>
                    <li><span>Mirror entries</span><strong>{pendingArchiveImport.mirrorEntries}</strong></li>
                    <li><span>Sick day saves</span><strong>{pendingArchiveImport.sickDaySaves}</strong></li>
                  </ul>
                  <div className={sharedStyles.noteFooterActions}>
                    <button
                      type="button"
                      className={sharedStyles.reportButton}
                      onClick={onConfirmArchiveImport}
                      disabled={archiveImportBusy}
                    >
                      {archiveImportBusy ? "Restoring archive..." : "Confirm archive merge"}
                    </button>
                    <button
                      type="button"
                      className={sharedStyles.secondaryPlanButton}
                      onClick={onCancelArchiveImport}
                      disabled={archiveImportBusy}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
              {archiveExportStatus ? <p className={sharedStyles.accountMeta}>{archiveExportStatus}</p> : null}
              {notesExportStatus ? <p className={sharedStyles.accountMeta}>{notesExportStatus}</p> : null}
            </>
          ) : (
            <ProUnlockCard
              title="Archive export and recovery"
              body={`${WHELM_PRO_NAME} exports your full Whelm archive in one file so your notes, sessions, blocks, cards, and recovery state stay portable.`}
              open={false}
              onToggle={() => undefined}
              onPreview={onStartProPreview}
            />
          )}
        </article>
      ) : null}

      {activeSection === "screenTime" ? (
        <article className={`${sharedStyles.card} ${styles.settingsDetailCard}`}>
          <SettingsDetailHeader
            sectionLabel="Device access"
            title="Permissions and sync"
            body="Focus access and account reliability."
            onBack={closeActiveSection}
          />
          <ul className={styles.settingsList}>
            <li>
              <span>Notes sync</span>
              <strong>{notesSyncStatus === "synced" ? "Synced" : notesSyncStatus === "syncing" ? "Syncing" : "Local only"}</strong>
            </li>
            <li>
              <span>Screen Time</span>
              <strong>{screenTimeSupported ? screenTimeStatus : "iOS only"}</strong>
            </li>
          </ul>
          {notesSyncMessage ? <p className={sharedStyles.accountMeta}>{notesSyncMessage}</p> : null}
          {screenTimeReason ? <p className={sharedStyles.accountMeta}>{screenTimeReason}</p> : null}
          <div className={sharedStyles.noteFooterActions}>
            {notesSyncStatus !== "synced" ? (
              <button type="button" className={sharedStyles.retrySyncButton} onClick={onRetrySync}>
                Retry notes sync
              </button>
            ) : null}
            {screenTimeSupported ? (
              <button
                type="button"
                className={sharedStyles.reportButton}
                onClick={onRequestScreenTimeAuth}
                disabled={screenTimeBusy}
              >
                {screenTimeBusy ? "Working..." : "Enable Screen Time Access"}
              </button>
            ) : null}
            <button
              type="button"
              className={sharedStyles.secondaryPlanButton}
              onClick={onOpenScreenTimeSettings}
              disabled={screenTimeBusy}
            >
              Open iOS Settings
            </button>
          </div>
        </article>
      ) : null}

      {activeSection === "internalTools" ? (
        <article className={`${sharedStyles.card} ${styles.settingsDetailCard}`}>
          <SettingsDetailHeader
            sectionLabel="Support"
            title="Help and feedback"
            body="The lighter support layer."
            onBack={closeActiveSection}
          />
          <div className={styles.settingsDetailBlock}>
            <SettingsActionRow
              title="Send Whelm feedback"
              summary="Tell me what feels off or missing."
              onClick={onFeedbackOpen}
            />
            <SettingsActionRow
              title="Contact support"
              summary="Email Whelm support directly."
              onClick={() => navigateTo("mailto:smalltek317@gmail.com")}
            />
            <SettingsActionRow
              title="Replay tutorial"
              summary="Run the guided setup again."
              dataTour="settings-replay-tutorial"
              onClick={onReplayTutorial}
            />
            <SettingsActionRow
              title="Preview Streak Mirror"
              summary="See the reflection flow."
              onClick={onPreviewStreakMirror}
            />
            <SettingsActionRow
              title="Preview daily commitment"
              summary="See the daily commitment prompt."
              onClick={onPreviewDailyCommitment}
            />
            <SettingsActionRow
              title="Preview streak alert"
              summary="See the recovery warning flow."
              onClick={onPreviewStreakAlert}
            />
          </div>
        </article>
      ) : null}

      {activeSection === "legal" ? (
        <article className={`${sharedStyles.card} ${styles.settingsDetailCard}`}>
          <SettingsDetailHeader
            sectionLabel="Legal"
            title="Privacy and terms"
            body="The policy layer Apple expects to be easy to reach."
            onBack={closeActiveSection}
          />
          <div className={styles.settingsDetailBlock}>
            <SettingsActionRow
              title="Privacy Policy"
              summary="How Whelm handles your data."
              onClick={() => navigateTo("/privacy")}
            />
            <SettingsActionRow
              title="Terms of Service"
              summary="The rules for using Whelm."
              onClick={() => navigateTo("/terms")}
            />
            <SettingsActionRow
              title="Acknowledgements"
              summary="The tools and libraries behind Whelm."
              onClick={() => navigateTo("/acknowledgements")}
            />
          </div>
        </article>
      ) : null}

      {activeSection === "danger" ? (
        <article className={`${sharedStyles.card} ${styles.settingsDetailCard}`}>
          <SettingsDetailHeader
            sectionLabel="Profile"
            title={displayName || "Whelm user"}
            body={email || "Account details"}
            onBack={closeActiveSection}
          />
          <div className={styles.settingsHeroHeader}>
            <WhelmProfileAvatar
              tierColor={streakBandanaTier?.color}
              size="compact"
              isPro={isPro}
              photoUrl={photoUrl}
            />
            <div className={styles.settingsPills}>
              <span className={styles.settingsPill}>{isPro ? WHELM_PRO_NAME : WHELM_STANDARD_NAME}</span>
              <span className={styles.settingsPill}>Streak {streak}d</span>
              {nextBandanaMilestone ? (
                <span className={styles.settingsPill}>
                  {nextBandanaMilestone.remainingDays}d to {nextBandanaMilestone.tier.label}
                </span>
              ) : null}
            </div>
          </div>
          <div className={styles.settingsDetailBlock}>
            <SettingsActionRow title="Sign out" summary="Leave this Whelm session." onClick={onSignOut} />
            <SettingsActionRow
              title={deletingAccount ? "Deleting account..." : "Delete account permanently"}
              summary="This cannot be undone."
              onClick={onDeleteAccount}
              disabled={deletingAccount}
              emphasis="danger"
            />
          </div>
          {accountDangerStatus ? <p className={styles.accountDangerStatus}>{accountDangerStatus}</p> : null}
        </article>
      ) : null}
    </>
  );
});

export default function SettingsTab({
  companionPulse: _companionPulse,
  bandanaColor: _bandanaColor,
  sectionRef,
  primaryRef,
  streakBandanaTier,
  isPro,
  photoUrl,
  displayName,
  email,
  profileTierTheme: _profileTierTheme,
  nextBandanaMilestone,
  proSource,
  streak,
  companionStyle,
  themeMode,
  sectionsOpen,
  onToggleSection,
  onFeedbackOpen,
  onReplayTutorial,
  onStartProPreview,
  onManageSubscription,
  onRestorePurchases,
  subscriptionBusy,
  subscriptionStatus,
  onSignOut,
  onApplyCompanionStyle,
  onApplyThemeMode,
  appBackgroundSetting,
  backgroundSkin,
  backgroundUploadInputRef,
  onBackgroundUpload,
  onApplyBackgroundSetting,
  onUpdateBackgroundSkin,
  proPanelBackgroundOpen,
  onToggleProBackgroundPanel,
  archiveExportBusy,
  archiveExportStatus,
  onExportArchive,
  notesExportBusy,
  notesExportStatus,
  onExportNotes,
  archiveImportBusy,
  archiveImportInputRef,
  onImportArchive,
  pendingArchiveImport,
  onConfirmArchiveImport,
  onCancelArchiveImport,
  notesSyncStatus,
  notesSyncMessage,
  onRetrySync,
  notificationSettings,
  notificationPermissionState,
  notificationDeliveryMode,
  notificationBusy,
  notificationStatus,
  scheduledNotificationCount,
  onApplyNotificationSettings,
  onRequestNotificationPermission,
  onResyncNotifications,
  screenTimeSupported,
  screenTimeStatus,
  screenTimeReason,
  screenTimeBusy,
  onRequestScreenTimeAuth,
  onOpenScreenTimeSettings,
  deletingAccount,
  onDeleteAccount,
  accountDangerStatus,
  onPreviewStreakMirror,
  onPreviewDailyCommitment,
  onPreviewStreakAlert,
}: SettingsTabProps) {
  const activeSection = useMemo<keyof SettingsSectionsOpen | null>(() => {
    const ordered: Array<keyof SettingsSectionsOpen> = [
      "identity",
      "notifications",
      "sync",
      "archive",
      "screenTime",
      "internalTools",
      "legal",
      "danger",
      "protocol",
      "appearance",
      "background",
    ];
    return ordered.find((key) => sectionsOpen[key]) ?? null;
  }, [sectionsOpen]);

  const preferencesActive =
    activeSection === "identity" ||
    activeSection === "protocol" ||
    activeSection === "appearance" ||
    activeSection === "background";

  const normalizedNotificationSettings = useMemo(
    () => ({
      enabled: Boolean(notificationSettings?.enabled),
      performanceNudges:
        typeof notificationSettings?.performanceNudges === "boolean"
          ? notificationSettings.performanceNudges
          : true,
      noteReminders:
        typeof notificationSettings?.noteReminders === "boolean"
          ? notificationSettings.noteReminders
          : true,
    }),
    [notificationSettings],
  );

  const closeActiveSection = () => {
    if (activeSection) {
      onToggleSection(activeSection);
    }
  };

  return (
    <AnimatedTabSection
      className={`${styles.settingsGrid} ${activeSection ? styles.settingsGridDetailOpen : ""}`}
      sectionRef={sectionRef}
    >
      <SettingsIndexPanel
        primaryRef={primaryRef}
        displayName={displayName}
        isPro={isPro}
        streakBandanaTier={streakBandanaTier}
        photoUrl={photoUrl}
        preferencesActive={preferencesActive}
        activeSection={activeSection}
        email={email}
        normalizedNotificationSettings={normalizedNotificationSettings}
        onToggleSection={onToggleSection}
      />

      {preferencesActive ? (
        <article className={`${sharedStyles.card} ${styles.settingsDetailCard}`}>
          <SettingsDetailHeader
            sectionLabel="Preferences"
            title="How Whelm feels"
            body="Theme, Whelm tone, and shell behavior."
            onBack={closeActiveSection}
          />

          <div className={styles.settingsDetailBlock}>
            <p className={styles.settingsIndexLabel}>Whelm tone</p>
            <div className={styles.companionStyleRow}>
              {(["gentle", "balanced", "strict"] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  className={`${styles.companionStyleButton} ${companionStyle === style ? styles.companionStyleButtonActive : ""}`}
                  onClick={() => onApplyCompanionStyle(style)}
                >
                  {formatSenseiLabel(style)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.settingsDetailBlock}>
            <p className={styles.settingsIndexLabel}>Theme</p>
            <div className={styles.companionStyleRow}>
              {(["dark", "light", "system"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`${styles.companionStyleButton} ${themeMode === mode ? styles.companionStyleButtonActive : ""}`}
                  onClick={() => onApplyThemeMode(mode)}
                >
                  {mode === "dark" ? "Dark" : mode === "light" ? "Light" : "Auto"}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.settingsDetailBlock}>
            <div className={styles.settingsDetailHeader}>
              <p className={styles.settingsIndexLabel}>Background</p>
              <p className={sharedStyles.accountMeta}>
                {isPro
                  ? "Pick the shell background and how much it shows through."
                  : "Custom shells and uploads live in Whelm Pro."}
              </p>
            </div>
            {isPro ? (
              <>
                <input
                  ref={backgroundUploadInputRef}
                  type="file"
                  accept="image/*"
                  className={styles.backgroundUploadInput}
                  onChange={onBackgroundUpload}
                />
                <div className={styles.backgroundPresetGrid}>
                  <button
                    type="button"
                    className={`${styles.backgroundPresetButton} ${appBackgroundSetting.kind === "default" ? styles.backgroundPresetButtonActive : ""}`}
                    onClick={() => onApplyBackgroundSetting({ kind: "default" })}
                  >
                    <span className={styles.backgroundPresetSwatch} />
                    <strong>Whelm Default</strong>
                  </button>
                  {PRO_BACKGROUND_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`${styles.backgroundPresetButton} ${
                        appBackgroundSetting.kind === "preset" && appBackgroundSetting.value === preset.id
                          ? styles.backgroundPresetButtonActive
                          : ""
                      }`}
                      onClick={() => onApplyBackgroundSetting({ kind: "preset", value: preset.id })}
                    >
                      <span className={styles.backgroundPresetSwatch} style={{ background: preset.background }} />
                      <strong>{preset.label}</strong>
                    </button>
                  ))}
                </div>
                <div className={sharedStyles.noteFooterActions}>
                  <button
                    type="button"
                    className={sharedStyles.reportButton}
                    onClick={() => backgroundUploadInputRef.current?.click()}
                  >
                    Upload backdrop
                  </button>
                  {appBackgroundSetting.kind === "upload" ? (
                    <button
                      type="button"
                      className={sharedStyles.secondaryPlanButton}
                      onClick={() => onApplyBackgroundSetting({ kind: "default" })}
                    >
                      Return to Whelm Default
                    </button>
                  ) : null}
                </div>
                <div className={styles.backgroundSkinPanel}>
                  <div className={styles.backgroundSkinHeader}>
                    <div>
                      <strong>Surface behavior</strong>
                      <p className={sharedStyles.accountMeta}>
                        Default keeps the standard Whelm shell. Adaptive glass opens the shell so your Whelm Pro background can breathe through.
                      </p>
                    </div>
                  </div>
                  <div className={styles.companionStyleRow}>
                    {([{ key: "solid", label: "Standard shell" }, { key: "glass", label: "Adaptive glass" }] as const).map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={`${styles.companionStyleButton} ${backgroundSkin.mode === option.key ? styles.companionStyleButtonActive : ""}`}
                        onClick={() => onUpdateBackgroundSkin({ ...backgroundSkin, mode: option.key })}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {backgroundSkin.mode === "glass" ? (
                    <div className={styles.backgroundSkinControls}>
                      {appBackgroundSetting.kind === "upload" ? (
                        <div className={styles.companionStyleRow}>
                          {([{ key: "fit", label: "Fit image" }, { key: "fill", label: "Fill screen" }] as const).map((option) => (
                            <button
                              key={option.key}
                              type="button"
                              className={`${styles.companionStyleButton} ${backgroundSkin.imageFit === option.key ? styles.companionStyleButtonActive : ""}`}
                              onClick={() => onUpdateBackgroundSkin({ ...backgroundSkin, imageFit: option.key })}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <SettingsSliderRow
                        title="Background prominence"
                        valueLabel={`${Math.round((1 - backgroundSkin.dim) * 100)}%`}
                        value={Math.round(backgroundSkin.dim * 100)}
                        min={2}
                        max={96}
                        onValueChange={(next) => onUpdateBackgroundSkin({ ...backgroundSkin, dim: next / 100 })}
                      />
                      <SettingsSliderRow
                        title="App surface opacity"
                        valueLabel={`${Math.round(backgroundSkin.surfaceOpacity * 100)}%`}
                        value={Math.round(backgroundSkin.surfaceOpacity * 100)}
                        min={8}
                        max={98}
                        onValueChange={(next) => onUpdateBackgroundSkin({ ...backgroundSkin, surfaceOpacity: next / 100 })}
                      />
                      <SettingsSliderRow
                        title="Glass blur"
                        valueLabel={`${backgroundSkin.blur}px`}
                        value={backgroundSkin.blur}
                        min={0}
                        max={40}
                        onValueChange={(next) => onUpdateBackgroundSkin({ ...backgroundSkin, blur: next })}
                      />
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <ProUnlockCard
                title="Custom backgrounds and uploads"
                body={`${WHELM_PRO_POSITIONING} ${WHELM_PRO_NAME} includes alternate full-app background designs, uploaded backdrops, and adaptive glass controls.`}
                open={proPanelBackgroundOpen}
                onToggle={onToggleProBackgroundPanel}
                onPreview={onStartProPreview}
              />
            )}
          </div>
        </article>
      ) : null}

      <SettingsDetailPanels
        activeSection={activeSection}
        closeActiveSection={closeActiveSection}
        displayName={displayName}
        isPro={isPro}
        email={email}
        streakBandanaTier={streakBandanaTier}
        photoUrl={photoUrl}
        nextBandanaMilestone={nextBandanaMilestone}
        proSource={proSource}
        streak={streak}
        companionStyle={companionStyle}
        themeMode={themeMode}
        onApplyCompanionStyle={onApplyCompanionStyle}
        onApplyThemeMode={onApplyThemeMode}
        backgroundUploadInputRef={backgroundUploadInputRef}
        onBackgroundUpload={onBackgroundUpload}
        appBackgroundSetting={appBackgroundSetting}
        onApplyBackgroundSetting={onApplyBackgroundSetting}
        backgroundSkin={backgroundSkin}
        onUpdateBackgroundSkin={onUpdateBackgroundSkin}
        proPanelBackgroundOpen={proPanelBackgroundOpen}
        onToggleProBackgroundPanel={onToggleProBackgroundPanel}
        onStartProPreview={onStartProPreview}
        normalizedNotificationSettings={normalizedNotificationSettings}
        notificationDeliveryMode={notificationDeliveryMode}
        notificationPermissionState={notificationPermissionState}
        scheduledNotificationCount={scheduledNotificationCount}
        onApplyNotificationSettings={onApplyNotificationSettings}
        onRequestNotificationPermission={onRequestNotificationPermission}
        onResyncNotifications={onResyncNotifications}
        notificationBusy={notificationBusy}
        notificationStatus={notificationStatus}
        subscriptionBusy={subscriptionBusy}
        subscriptionStatus={subscriptionStatus}
        onRestorePurchases={onRestorePurchases}
        onManageSubscription={onManageSubscription}
        archiveImportInputRef={archiveImportInputRef}
        onImportArchive={onImportArchive}
        archiveExportBusy={archiveExportBusy}
        onExportArchive={onExportArchive}
        notesExportBusy={notesExportBusy}
        onExportNotes={onExportNotes}
        archiveImportBusy={archiveImportBusy}
        pendingArchiveImport={pendingArchiveImport}
        onConfirmArchiveImport={onConfirmArchiveImport}
        onCancelArchiveImport={onCancelArchiveImport}
        archiveExportStatus={archiveExportStatus}
        notesExportStatus={notesExportStatus}
        notesSyncStatus={notesSyncStatus}
        notesSyncMessage={notesSyncMessage}
        onRetrySync={onRetrySync}
        screenTimeSupported={screenTimeSupported}
        screenTimeStatus={screenTimeStatus}
        screenTimeReason={screenTimeReason}
        screenTimeBusy={screenTimeBusy}
        onRequestScreenTimeAuth={onRequestScreenTimeAuth}
        onOpenScreenTimeSettings={onOpenScreenTimeSettings}
        onFeedbackOpen={onFeedbackOpen}
        onReplayTutorial={onReplayTutorial}
        onPreviewStreakMirror={onPreviewStreakMirror}
        onPreviewDailyCommitment={onPreviewDailyCommitment}
        onPreviewStreakAlert={onPreviewStreakAlert}
        onSignOut={onSignOut}
        deletingAccount={deletingAccount}
        onDeleteAccount={onDeleteAccount}
        accountDangerStatus={accountDangerStatus}
      />
    </AnimatedTabSection>
  );
}
