"use client";

import { memo, useMemo, useState } from "react";

import styles from "@/app/page.module.css";
import { CALENDAR_TONES, getCalendarToneStyle, type CalendarTone } from "@/lib/calendar-tones";
import { STANDARD_CALENDAR_TONES, WHELM_PRO_NAME, WHELM_STANDARD_NAME } from "@/lib/whelm-plans";

const CalendarTonePicker = memo(function CalendarTonePicker({
  label,
  selectedTone,
  onSelectTone,
  isPro,
  onUpgrade,
}: {
  label: "Month tone" | "Day tone" | "Block tone";
  selectedTone: CalendarTone | null;
  onSelectTone: (tone: CalendarTone | null) => void;
  isPro: boolean;
  onUpgrade: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedToneStyle = getCalendarToneStyle(selectedTone);
  const visibleTones = useMemo(
    () => (isPro
      ? CALENDAR_TONES
      : CALENDAR_TONES.filter((tone) => STANDARD_CALENDAR_TONES.includes(tone.value))),
    [isPro],
  );

  return (
    <div className={`${styles.calendarTonePanel} ${open ? styles.calendarTonePanelOpen : ""}`}>
      <button
        type="button"
        className={`${styles.calendarToneDisclosureButton} ${
          selectedTone ? styles.calendarToneDisclosureButtonActive : ""
        }`}
        style={selectedToneStyle}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className={styles.calendarToneDisclosureLabel}>{label}</span>
        <span className={styles.calendarToneDisclosureMeta}>
          <span
            className={`${styles.calendarToneDisclosureSwatch} ${
              !selectedTone ? styles.calendarToneDisclosureSwatchOff : ""
            }`}
            style={selectedToneStyle}
            aria-hidden="true"
          >
            <span className={styles.calendarToneDisclosureSwatchFill} />
          </span>
        </span>
      </button>
      {open && (
        <div className={styles.calendarToneLockedPreview}>
          <div className={styles.calendarToneSwatchRow}>
            <button
              type="button"
              className={`${styles.calendarToneSwatch} ${styles.calendarToneSwatchReset} ${
                !selectedTone ? styles.calendarToneSwatchActive : ""
              }`}
              onClick={() => onSelectTone(null)}
              aria-label={`Reset ${label.toLowerCase()}`}
              title={`Reset ${label.toLowerCase()}`}
            >
              <span>Off</span>
            </button>
            {visibleTones.map((tone) => (
              <button
                key={tone.value}
                type="button"
                className={`${styles.calendarToneSwatch} ${
                  selectedTone === tone.value ? styles.calendarToneSwatchActive : ""
                }`}
                style={getCalendarToneStyle(tone.value)}
                onClick={() => onSelectTone(tone.value)}
                aria-label={tone.ariaLabel}
                title={tone.ariaLabel}
              >
                <span className={styles.calendarToneSwatchFill} />
              </button>
            ))}
          </div>
          {!isPro ? (
            <>
              <button
                type="button"
                className={styles.calendarToneLockedCard}
                style={getCalendarToneStyle(selectedTone ?? CALENDAR_TONES[0].value)}
                onClick={onUpgrade}
              >
                <div className={styles.calendarToneLockedCardHead}>
                  <span>{label}</span>
                  <strong>{WHELM_PRO_NAME} unlocks the full tone set</strong>
                </div>
                <div className={styles.calendarToneLockedCardPreview}>
                  <div className={styles.calendarToneLockedCardTime}>9:00 AM</div>
                  <div>
                    <strong>Push, Sharp, and Recover stay in {WHELM_PRO_NAME}.</strong>
                    <small>{WHELM_STANDARD_NAME} keeps a smaller planning palette.</small>
                  </div>
                </div>
              </button>
              <button type="button" className={styles.inlineUpgrade} onClick={onUpgrade}>
                Upgrade to {WHELM_PRO_NAME}
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
});

export default CalendarTonePicker;
