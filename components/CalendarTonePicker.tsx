"use client";

import * as Popover from "@radix-ui/react-popover";
import { memo, useMemo, useState } from "react";

import styles from "@/app/page.module.css";
import {
  CALENDAR_TONES,
  getAccessibleCalendarTones,
  getCalendarToneStyle,
  type CalendarTone,
} from "@/lib/calendar-tones";
import { WHELM_PRO_NAME, WHELM_STANDARD_NAME } from "@/lib/whelm-plans";

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
    () => CALENDAR_TONES.filter((tone) => getAccessibleCalendarTones(isPro).includes(tone.value)),
    [isPro],
  );

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className={`${styles.calendarTonePanel} ${open ? styles.calendarTonePanelOpen : ""}`}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`${styles.calendarToneDisclosureButton} ${
              selectedTone ? styles.calendarToneDisclosureButtonActive : ""
            }`}
            style={selectedToneStyle}
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
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={styles.calendarTonePopoverContent}
            sideOffset={10}
            align="start"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <div className={styles.calendarToneLockedPreview}>
              <div className={styles.calendarToneSwatchRow}>
                <button
                  type="button"
                  className={`${styles.calendarToneSwatch} ${styles.calendarToneSwatchReset} ${
                    !selectedTone ? styles.calendarToneSwatchActive : ""
                  }`}
                  onClick={() => {
                    onSelectTone(null);
                    setOpen(false);
                  }}
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
                    onClick={() => {
                      onSelectTone(tone.value);
                      setOpen(false);
                    }}
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
                    onClick={() => {
                      setOpen(false);
                      onUpgrade();
                    }}
                  >
                    <div className={styles.calendarToneLockedCardHead}>
                      <span>{label}</span>
                      <strong>{WHELM_PRO_NAME} unlocks 10 total tones</strong>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={styles.inlineUpgrade}
                    onClick={() => {
                      setOpen(false);
                      onUpgrade();
                    }}
                  >
                    Upgrade to {WHELM_PRO_NAME}
                  </button>
                </>
              ) : null}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </div>
    </Popover.Root>
  );
});

export default CalendarTonePicker;
