"use client";

import { type ChangeEvent, type Ref, type RefObject } from "react";

import sharedStyles from "@/app/page.module.css";
import AnimatedTabSection from "@/components/AnimatedTabSection";
import CollapsibleSectionCard from "@/components/CollapsibleSectionCard";
import CompanionPulse from "@/components/CompanionPulse";
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
    id: "aurora",
    label: "Aurora",
    background:
      "radial-gradient(circle at 12% 0%, rgba(62, 115, 255, 0.24), transparent 28%), radial-gradient(circle at 88% 12%, rgba(82, 214, 255, 0.2), transparent 26%), linear-gradient(180deg, rgba(7, 9, 18, 0.92), rgba(14, 18, 34, 0.98))",
  },
  {
    id: "ember",
    label: "Ember",
    background:
      "radial-gradient(circle at 18% 8%, rgba(255, 127, 80, 0.24), transparent 26%), radial-gradient(circle at 82% 0%, rgba(244, 63, 94, 0.18), transparent 24%), linear-gradient(180deg, rgba(19, 8, 12, 0.94), rgba(28, 14, 20, 0.98))",
  },
  {
    id: "forest",
    label: "Forest",
    background:
      "radial-gradient(circle at 10% 10%, rgba(34, 197, 94, 0.2), transparent 24%), radial-gradient(circle at 92% 0%, rgba(45, 212, 191, 0.14), transparent 22%), linear-gradient(180deg, rgba(6, 16, 14, 0.94), rgba(9, 24, 20, 0.98))",
  },
  {
    id: "dawn",
    label: "Dawn",
    background:
      "radial-gradient(circle at 12% 0%, rgba(251, 191, 36, 0.22), transparent 28%), radial-gradient(circle at 88% 10%, rgba(249, 115, 22, 0.18), transparent 26%), linear-gradient(180deg, rgba(20, 14, 9, 0.94), rgba(31, 22, 14, 0.98))",
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

type SettingsSectionsOpen = {
  identity: boolean;
  internalTools: boolean;
  protocol: boolean;
  appearance: boolean;
  background: boolean;
  archive: boolean;
  sync: boolean;
  screenTime: boolean;
  danger: boolean;
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

export type SettingsTabProps = {
  // Sensei companion
  companionPulse: CompanionPulseData;
  bandanaColor: WhelBandanaColor;
  sectionRef?: Ref<HTMLElement>;
  primaryRef?: Ref<HTMLElement>;
  // User profile
  streakBandanaTier: StreakBandanaTier | null;
  isPro: boolean;
  photoUrl: string | null | undefined;
  displayName: string | null | undefined;
  email: string | null | undefined;
  profileTierTheme: ProfileTierTheme;
  nextBandanaMilestone: NextBandanaMilestone;
  proSource: "preview" | "store" | "none";
  streak: number;
  // Preferences
  companionStyle: "gentle" | "balanced" | "strict";
  themeMode: "dark" | "light" | "system";
  // Section open state
  sectionsOpen: SettingsSectionsOpen;
  onToggleSection: (key: keyof SettingsSectionsOpen) => void;
  // Actions
  onFeedbackOpen: () => void;
  onReplayTutorial: () => void;
  onStartProPreview: () => void;
  onRestorePurchases: () => void;
  subscriptionBusy: boolean;
  subscriptionStatus: string;
  onSignOut: () => void;
  onApplyCompanionStyle: (style: "gentle" | "balanced" | "strict") => void;
  onApplyThemeMode: (mode: "dark" | "light" | "system") => void;
  // Background
  appBackgroundSetting: PreferencesBackgroundSetting;
  backgroundSkin: PreferencesBackgroundSkin;
  backgroundUploadInputRef: RefObject<HTMLInputElement | null>;
  onBackgroundUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onApplyBackgroundSetting: (setting: PreferencesBackgroundSetting) => void;
  onUpdateBackgroundSkin: (skin: PreferencesBackgroundSkin) => void;
  proPanelBackgroundOpen: boolean;
  onToggleProBackgroundPanel: () => void;
  // Archive export
  archiveExportBusy: boolean;
  archiveExportStatus: string;
  onExportArchive: () => void;
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
  // Notes sync
  notesSyncStatus: "synced" | "syncing" | "local-only" | "error";
  notesSyncMessage: string;
  onRetrySync: () => void;
  // Screen time
  screenTimeSupported: boolean;
  screenTimeStatus: ScreenTimeAuthorizationStatus;
  screenTimeReason: string;
  screenTimeBusy: boolean;
  onRequestScreenTimeAuth: () => void;
  onOpenScreenTimeSettings: () => void;
  // Account danger
  deletingAccount: boolean;
  onDeleteAccount: () => void;
  accountDangerStatus: string;
  // Internal tools
  onPreviewStreakMirror: () => void;
  onPreviewDailyCommitment: () => void;
  onPreviewStreakAlert: () => void;
};

export default function SettingsTab({
  companionPulse,
  bandanaColor,
  sectionRef,
  primaryRef,
  streakBandanaTier,
  isPro,
  photoUrl,
  displayName,
  email,
  profileTierTheme,
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
  archiveImportBusy,
  archiveImportInputRef,
  onImportArchive,
  pendingArchiveImport,
  onConfirmArchiveImport,
  onCancelArchiveImport,
  notesSyncStatus,
  notesSyncMessage,
  onRetrySync,
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
  return (
    <AnimatedTabSection className={styles.settingsGrid} sectionRef={sectionRef}>
      <CompanionPulse {...companionPulse} bandanaColor={bandanaColor} />

      <article className={`${sharedStyles.card} ${styles.settingsHeroCard}`} ref={primaryRef}>
        <div className={styles.settingsHeroHeader}>
          <WhelmProfileAvatar
            tierColor={streakBandanaTier?.color}
            size="compact"
            isPro={isPro}
            photoUrl={photoUrl}
          />
          <div>
            <p className={sharedStyles.sectionLabel}>Account</p>
            <h2 className={sharedStyles.cardTitle}>{displayName || "Whelm user"}</h2>
            <p className={sharedStyles.accountMeta}>{email}</p>
          </div>
        </div>
        <div className={styles.settingsReadoutGrid}>
          <article className={styles.settingsReadoutCard}>
            <span>Bandana</span>
            <strong>{streakBandanaTier?.label ?? "No tier yet"}</strong>
            <small>{profileTierTheme.title}</small>
          </article>
          <article className={styles.settingsReadoutCard}>
            <span>Next ascent</span>
            <strong>
              {nextBandanaMilestone
                ? `${nextBandanaMilestone.remainingDays} day${nextBandanaMilestone.remainingDays === 1 ? "" : "s"} left`
                : "Top tier reached"}
            </strong>
            <small>
              {nextBandanaMilestone ? nextBandanaMilestone.tier.label : "Keep the run alive."}
            </small>
          </article>
          <article className={styles.settingsReadoutCard}>
            <span>System mode</span>
            <strong>{companionStyle === "strict" ? "Strict" : companionStyle === "balanced" ? "Balanced" : "Gentle"}</strong>
            <small>{themeMode === "dark" ? "Dark shell" : "Light shell"}</small>
          </article>
        </div>
        <div className={styles.settingsPills}>
          <span className={styles.settingsPill}>
            Access: {isPro ? WHELM_PRO_NAME : WHELM_STANDARD_NAME}
          </span>
          <span className={styles.settingsPill}>
            Status: {proSource === "preview" ? `${WHELM_PRO_NAME} Access` : isPro ? `${WHELM_PRO_NAME} Active` : WHELM_STANDARD_NAME}
          </span>
          <span className={styles.settingsPill}>Streak: {streak}d</span>
        </div>
        <div className={styles.settingsActionGrid}>
          <button
            type="button"
            data-tour="settings-replay-tutorial"
            className={sharedStyles.secondaryPlanButton}
            onClick={onReplayTutorial}
          >
            Replay tutorial
          </button>
          <button type="button" className={sharedStyles.reportButton} onClick={onFeedbackOpen}>
            Send Whelm feedback
          </button>
        </div>
        {!isPro ? (
          <div className={sharedStyles.noteFooterActions}>
            <button type="button" className={sharedStyles.inlineUpgrade} onClick={onStartProPreview}>
              Upgrade to Whelm Pro
            </button>
            <button
              type="button"
              className={sharedStyles.secondaryPlanButton}
              onClick={onRestorePurchases}
              disabled={subscriptionBusy}
            >
              {subscriptionBusy ? "Restoring..." : "Restore purchases"}
            </button>
            <button type="button" className={sharedStyles.secondaryPlanButton} onClick={onSignOut}>
              Sign out
            </button>
          </div>
        ) : (
          <div className={sharedStyles.noteFooterActions}>
            <button
              type="button"
              className={sharedStyles.secondaryPlanButton}
              onClick={onRestorePurchases}
              disabled={subscriptionBusy}
            >
              {subscriptionBusy ? "Checking..." : "Restore purchases"}
            </button>
            <button type="button" className={sharedStyles.secondaryPlanButton} onClick={onSignOut}>
              Sign out
            </button>
          </div>
        )}
        {subscriptionStatus ? (
          <p className={sharedStyles.accountMeta}>{subscriptionStatus}</p>
        ) : null}
      </article>

      <CollapsibleSectionCard
        label="Whelm Identity"
        title="How this system is running"
        open={sectionsOpen.identity}
        onToggle={() => onToggleSection("identity")}
      >
        <ul className={styles.settingsList}>
          <li><span>Clean Focus Mode</span><strong>{isPro ? WHELM_PRO_NAME : WHELM_STANDARD_NAME}</strong></li>
          <li><span>Profile presence</span><strong>{isPro ? "Premium" : "Standard"}</strong></li>
          <li><span>Archive tools</span><strong>{isPro ? "Deep Search" : "Recent Window"}</strong></li>
          <li><span>Shell personalization</span><strong>{isPro ? "Expanded" : "Standard"}</strong></li>
          <li><span>Weekly Report Cards</span><strong>On</strong></li>
          <li><span>Command Reports</span><strong>{isPro ? "Advanced" : "Core"}</strong></li>
        </ul>
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        label="Internal Tools"
        title="Preview gated flows"
        description="Open gated flows here without waiting for the live trigger."
        open={sectionsOpen.internalTools}
        onToggle={() => onToggleSection("internalTools")}
      >
        <div className={styles.settingsActionGrid}>
          <button type="button" className={sharedStyles.reportButton} onClick={onPreviewStreakMirror}>
            Preview Streak Mirror
          </button>
          <button type="button" className={sharedStyles.secondaryPlanButton} onClick={onPreviewDailyCommitment}>
            Preview daily commitment
          </button>
          <button type="button" className={sharedStyles.secondaryPlanButton} onClick={onPreviewStreakAlert}>
            Preview streak alert
          </button>
        </div>
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        label="Protocol"
        title="Whelm tone"
        description="Choose how direct Whelm should feel when keeping you accountable."
        open={sectionsOpen.protocol}
        onToggle={() => onToggleSection("protocol")}
      >
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
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        label="Appearance"
        title="Default theme"
        description="Choose how Whelm opens."
        open={sectionsOpen.appearance}
        onToggle={() => onToggleSection("appearance")}
      >
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
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        label="Personalization"
        title="App background"
        description="Pick the shell background and how much it shows through."
        open={sectionsOpen.background}
        onToggle={() => onToggleSection("background")}
      >
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
                <strong>Standard shell</strong>
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
                  Return to standard shell
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
                  <label className={styles.backgroundSkinControl}>
                    <span>Background prominence</span>
                    <strong>{Math.round((1 - backgroundSkin.dim) * 100)}%</strong>
                    <input
                      type="range" min="2" max="96" step="1"
                      value={Math.round(backgroundSkin.dim * 100)}
                      onChange={(e) => onUpdateBackgroundSkin({ ...backgroundSkin, dim: Number(e.target.value) / 100 })}
                    />
                  </label>
                  <label className={styles.backgroundSkinControl}>
                    <span>App surface opacity</span>
                    <strong>{Math.round(backgroundSkin.surfaceOpacity * 100)}%</strong>
                    <input
                      type="range" min="8" max="98" step="1"
                      value={Math.round(backgroundSkin.surfaceOpacity * 100)}
                      onChange={(e) => onUpdateBackgroundSkin({ ...backgroundSkin, surfaceOpacity: Number(e.target.value) / 100 })}
                    />
                  </label>
                  <label className={styles.backgroundSkinControl}>
                    <span>Glass blur</span>
                    <strong>{backgroundSkin.blur}px</strong>
                    <input
                      type="range" min="0" max="40" step="1"
                      value={backgroundSkin.blur}
                      onChange={(e) => onUpdateBackgroundSkin({ ...backgroundSkin, blur: Number(e.target.value) })}
                    />
                  </label>
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
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        label="Archive"
        title="Export your Whelm archive"
        description="Save your notes, sessions, blocks, cards, preferences, and streak recovery state as one archive file."
        open={sectionsOpen.archive}
        onToggle={() => onToggleSection("archive")}
      >
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
            <ul className={sharedStyles.commandList}>
              <li>Export saves one JSON archive with your notes, blocks, sessions, cards, preferences, and recovery state.</li>
              <li>Import does a merge, not a wipe. Your current account data stays in place and the archive is folded into it.</li>
            </ul>
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
                <ul className={sharedStyles.commandList}>
                  <li>This will merge archive data into the current account.</li>
                  <li>It does not remove your current live Whelm data.</li>
                  <li>If the same item exists in both places, Whelm keeps the newer version where possible.</li>
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
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        label="Sync"
        title="Notes status"
        open={sectionsOpen.sync}
        onToggle={() => onToggleSection("sync")}
      >
        <p className={sharedStyles.accountMeta}>
          {notesSyncStatus === "synced" ? "Synced" : notesSyncStatus === "syncing" ? "Syncing" : "Local only"}
        </p>
        {notesSyncMessage ? <p className={sharedStyles.accountMeta}>{notesSyncMessage}</p> : null}
        {notesSyncStatus !== "synced" ? (
          <button type="button" className={sharedStyles.retrySyncButton} onClick={onRetrySync}>
            Retry notes sync
          </button>
        ) : null}
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        label="Screen Time"
        title="Device focus permission"
        open={sectionsOpen.screenTime}
        onToggle={() => onToggleSection("screenTime")}
      >
        <p className={sharedStyles.accountMeta}>
          {screenTimeSupported
            ? `Authorization status: ${screenTimeStatus}`
            : "Screen Time is available only in the iOS native build."}
        </p>
        {screenTimeReason ? <p className={sharedStyles.accountMeta}>{screenTimeReason}</p> : null}
        <div className={sharedStyles.noteFooterActions}>
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
        <ul className={sharedStyles.commandList}>
          <li>This enables Screen Time APIs through Apple&apos;s permission flow.</li>
          <li>Detailed per-app charts require the Device Activity report extension.</li>
        </ul>
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        className={styles.accountDangerCard}
        label="Account"
        title="Delete account"
        description="Permanently delete your Whelm account, notes, sessions, and local app data."
        open={sectionsOpen.danger}
        onToggle={() => onToggleSection("danger")}
      >
        <button
          type="button"
          className={styles.deleteAccountButton}
          onClick={onDeleteAccount}
          disabled={deletingAccount}
        >
          {deletingAccount ? "Deleting account..." : "Delete account permanently"}
        </button>
        {accountDangerStatus ? (
          <p className={styles.accountDangerStatus}>{accountDangerStatus}</p>
        ) : null}
      </CollapsibleSectionCard>
    </AnimatedTabSection>
  );
}
