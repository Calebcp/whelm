"use client";

import styles from "@/app/page.module.css";

import type { AlarmAttachableBlock, AlarmDraft, AlarmItem } from "@/hooks/useTodayTimeHub";
import type { TodayAlarmInstance } from "@/lib/today-alarm-instances";

type AlarmScreenProps = {
  alarms: AlarmItem[];
  draft: AlarmDraft;
  attachableBlocks: AlarmAttachableBlock[];
  activeInstance?: TodayAlarmInstance | null;
  latestMissedInstance?: TodayAlarmInstance | null;
  onClose: () => void;
  onStartNew: () => void;
  onChange: (patch: Partial<AlarmDraft>) => void;
  onEdit: (id: string) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onSnoozeActive: () => void;
  onClearMissed: () => void;
};

function normalizeTimeLabel(raw: string) {
  if (!raw) return "Any time";
  const parsed = new Date(`2000-01-01T${raw}:00`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function alarmModeLabel(mode: AlarmDraft["mode"] | AlarmItem["mode"]) {
  return mode === "hard" ? "Hard" : "Soft";
}

export default function AlarmScreen({
  alarms,
  draft,
  attachableBlocks,
  activeInstance,
  latestMissedInstance,
  onClose,
  onStartNew,
  onChange,
  onEdit,
  onSave,
  onDelete,
  onToggle,
  onSnoozeActive,
  onClearMissed,
}: AlarmScreenProps) {
  return (
    <div className={`${styles.timeToolFullscreen} ${styles.alarmScreenShell}`}>
      <div className={styles.timeToolFullscreenHeader}>
        <p className={styles.sectionLabel}>Alarm</p>
        <button type="button" className={styles.feedbackClose} onClick={onClose}>
          Close
        </button>
      </div>

      <div className={styles.alarmScreenStack}>
        {/* Form first on mobile; swapped to right column on desktop via CSS order */}
        <section className={`${styles.timeToolPanel} ${styles.alarmPanel} ${styles.alarmFormPanel}`}>
          <div className={styles.alarmPanelHeader}>
            <div>
              <p className={styles.sectionLabel}>{draft.id ? "Edit alarm" : "New alarm"}</p>
            </div>
          </div>

          <div className={styles.timeToolForm}>
            <label className={styles.planLabel}>
              Time
              <input
                type="time"
                value={draft.timeOfDay}
                onChange={(event) => onChange({ timeOfDay: event.target.value })}
                className={styles.planControl}
              />
            </label>
            <input
              value={draft.label}
              onChange={(event) => onChange({ label: event.target.value })}
              placeholder="Label"
              className={styles.planInput}
            />
            <div className={styles.alarmModeRow}>
              <button
                type="button"
                className={`${styles.alarmModeChip} ${draft.mode === "soft" ? styles.alarmModeChipActive : ""}`}
                onClick={() => onChange({ mode: "soft" })}
              >
                <strong>Soft</strong>
                <span>Gentle reminder</span>
              </button>
              <button
                type="button"
                className={`${styles.alarmModeChip} ${draft.mode === "hard" ? styles.alarmModeChipActive : ""}`}
                onClick={() => onChange({ mode: "hard" })}
              >
                <strong>Hard</strong>
                <span>Commitment signal</span>
              </button>
            </div>
            {attachableBlocks.length > 0 && (
              <div className={styles.alarmAttachSection}>
                <p className={styles.sectionLabel}>Attach to block</p>
                <div className={styles.alarmAttachList}>
                  {attachableBlocks.slice(0, 4).map((block) => {
                    const attached = draft.linkedBlockId === block.id;
                    return (
                      <button
                        key={block.id}
                        type="button"
                        className={`${styles.alarmAttachChip} ${attached ? styles.alarmAttachChipActive : ""}`}
                        onClick={() =>
                          onChange({
                            linkedBlockId: block.id,
                            linkedBlockTitle: block.title,
                            linkedDateKey: block.dateKey,
                            linkedBlockDurationMinutes: block.durationMinutes,
                            timeOfDay: block.timeOfDay,
                            label: draft.label.trim() ? draft.label : block.title,
                          })
                        }
                      >
                        <strong>{block.title}</strong>
                        <span>{normalizeTimeLabel(block.timeOfDay)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className={styles.timeToolFooter}>
              <button type="button" className={styles.secondaryPlanButton} onClick={onStartNew}>
                Reset
              </button>
              <button type="button" className={`${styles.planAddButton} ${styles.blockActionButton}`} onClick={onSave}>
                {draft.id ? "Save alarm" : "Add alarm"}
              </button>
            </div>
          </div>
        </section>

        {/* Saved alarms — second on mobile, left column on desktop */}
        <section className={`${styles.timeToolPanel} ${styles.alarmPanel} ${styles.alarmListPanel}`}>
          <div className={styles.alarmPanelHeader}>
            <p className={styles.sectionLabel}>Saved alarms</p>
            <button type="button" className={styles.secondaryPlanButton} onClick={onStartNew}>
              New
            </button>
          </div>

          {activeInstance ? (
            <article className={styles.alarmRow}>
              <div className={styles.alarmRowMain}>
                <strong className={styles.alarmTime}>Live now</strong>
                <span className={styles.alarmLabel}>
                  {activeInstance.linkedBlockTitle || activeInstance.alarmLabel} ·{" "}
                  {activeInstance.alarmMode === "hard" ? "Hard" : "Soft"}
                </span>
              </div>
              <div className={styles.alarmRowActions}>
                <button type="button" className={styles.secondaryPlanButton} onClick={onSnoozeActive}>
                  Snooze 10m
                </button>
              </div>
            </article>
          ) : null}

          {latestMissedInstance ? (
            <article className={styles.alarmRow}>
              <div className={styles.alarmRowMain}>
                <strong className={styles.alarmTime}>Missed</strong>
                <span className={styles.alarmLabel}>
                  {latestMissedInstance.linkedBlockTitle || latestMissedInstance.alarmLabel} ·{" "}
                  {latestMissedInstance.alarmMode === "hard" ? "Hard" : "Soft"}
                </span>
              </div>
              <div className={styles.alarmRowActions}>
                <button type="button" className={styles.secondaryPlanButton} onClick={onClearMissed}>
                  Clear
                </button>
              </div>
            </article>
          ) : null}

          <div className={styles.alarmList}>
            {alarms.length === 0 ? (
              <p className={styles.emptyText}>No alarms yet.</p>
            ) : (
              alarms.map((alarm) => (
                <article key={alarm.id} className={styles.alarmRow}>
                  <button type="button" className={styles.alarmRowMain} onClick={() => onEdit(alarm.id)}>
                    <strong className={styles.alarmTime}>{normalizeTimeLabel(alarm.timeOfDay)}</strong>
                    <span className={styles.alarmLabel}>
                      {alarm.label || "Alarm"} · {alarmModeLabel(alarm.mode)}
                    </span>
                  </button>
                  <div className={styles.alarmRowActions}>
                    <button
                      type="button"
                      className={`${styles.alarmToggle} ${alarm.enabled ? styles.alarmToggleOn : ""}`}
                      aria-pressed={alarm.enabled}
                      onClick={() => onToggle(alarm.id)}
                    >
                      <span className={styles.alarmToggleThumb} />
                    </button>
                    <button type="button" className={styles.secondaryPlanButton} onClick={() => onDelete(alarm.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
