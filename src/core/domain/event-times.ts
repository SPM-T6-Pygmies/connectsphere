/**
 * When an event runs, as people read it: a start and an end time on a date.
 *
 * The database keeps the day as 96 slots of 15 minutes (SPM-276 team decision
 * 6), one row per slot, so a 07:00-12:00 morning is twenty rows. Every screen
 * and notice wants the morning, not the rows: `joinSlots` puts touching slots
 * back together. A gap stays a gap, so AM and PM converted from the old slots
 * remain two ranges either side of lunch.
 */

/** The booking grid (#128): the smallest span anything is booked or requested in. */
export const GRID_MINUTES = 15;

/** `24:00`, in minutes: the latest a range may end. */
export const END_OF_DAY = 24 * 60;

/** Minutes after midnight for `HH:MM`, or null when it is not a time of day. `24:00` is one. */
export function minutesOfDay(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (match === null) {
    return null;
  }
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[2]) < 60 && minutes <= END_OF_DAY ? minutes : null;
}

/** `HH:MM` for minutes after midnight; 1440 is `24:00`. */
export function timeOfDay(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** One stretch of time on one calendar day. `date` is `YYYY-MM-DD`, times `HH:MM`, Singapore time (#36). */
export interface TimeRangeOnDate {
  readonly date: string;
  readonly start: string;
  /** Up to `24:00`, so a range that runs to midnight still ends after it starts. */
  readonly end: string;
}

/** Ranges that touch on the same date become one; the result is in date then start order. */
export function joinSlots(slots: readonly TimeRangeOnDate[]): TimeRangeOnDate[] {
  const ordered = [...slots].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
  );
  const joined: TimeRangeOnDate[] = [];
  for (const slot of ordered) {
    const last = joined.at(-1);
    if (last !== undefined && last.date === slot.date && last.end >= slot.start) {
      joined[joined.length - 1] = { ...last, end: slot.end > last.end ? slot.end : last.end };
    } else {
      joined.push({ date: slot.date, start: slot.start, end: slot.end });
    }
  }
  return joined;
}

/**
 * The instant `range` starts. Singapore observes no daylight saving, so its
 * +08:00 offset is exact (#36).
 */
export function rangeStartsAt({ date, start }: TimeRangeOnDate): Date {
  return new Date(`${date}T${start}:00+08:00`);
}

/** The instant `range` ends; `24:00` is the next day's midnight. */
export function rangeEndsAt({ date, end }: TimeRangeOnDate): Date {
  return new Date(`${date}T${end}:00+08:00`);
}
