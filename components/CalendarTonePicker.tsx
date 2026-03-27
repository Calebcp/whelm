"use client";

import { useState } from "react";

import styles from "@/app/page.module.css";
import { CALENDAR_TONES, getCalendarToneStyle, type CalendarTone } from "@/lib/calendar-tones";

export default function CalendarTonePicker({
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
  "use no memo";

  const [open, setOpen] = useState(false);
  const selectedToneStyle = getCalendarToneStyle(selectedTone);

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
      {open &&
        (isPro ? (
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
            {CALENDAR_TONES.map((tone) => (
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
        ) : (
          <div className={styles.calendarToneLockedPreview}>
            <div className={styles.calendarToneLockedSwatchGrid}>
              {CALENDAR_TONES.map((tone) => (
                <button
                  key={tone.value}
                  type="button"
                  className={styles.calendarToneLockedSwatch}
                  style={getCalendarToneStyle(tone.value)}
                  onClick={onUpgrade}
                  aria-label={`Preview ${tone.value.toLowerCase()} tone in Whelm Pro`}
                >
                  <span className={styles.calendarToneLockedSwatchFill} />
                  <small>{tone.value}</small>
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.calendarToneLockedCard}
              style={getCalendarToneStyle(selectedTone ?? CALENDAR_TONES[0].value)}
              onClick={onUpgrade}
            >
              <div className={styles.calendarToneLockedCardHead}>
                <span>{label}</span>
                <strong>{selectedTone ?? CALENDAR_TONES[0].value}</strong>
              </div>
              <div className={styles.calendarToneLockedCardPreview}>
                <div className={styles.calendarToneLockedCardTime}>9:00 AM</div>
                <div>
                  <strong>Deep focus block</strong>
                  <small>See how premium tone styling lands inside the planner.</small>
                </div>
              </div>
            </button>
            <button type="button" className={styles.inlineUpgrade} onClick={onUpgrade}>
              Enter Whelm Pro Preview
            </button>
          </div>
        ))}
    </div>
  );
}
