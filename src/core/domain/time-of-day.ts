/**
 * Times of day on the 15-minute grid (CR-W7-01, SPM-276).
 *
 * The smallest unit of booking is 15 minutes (#128). A time of day is written
 * `HH:MM`, Singapore wall-clock time (#36), and is worked with as minutes after
 * midnight. Midnight at the end of a day is `24:00`, so a range ending then
 * stays after its start; no range crosses midnight.
 */

/** The booking grid, in minutes (#128). */
export const GRID_MINUTES = 15;

/** `24:00`: the latest a range may end. */
export const END_OF_DAY = 24 * 60;

/** A span of one day, in minutes after midnight. Half-open: `start` is in it, `end` is not. */
export interface TimeRange {
  readonly start: number;
  readonly end: number;
}

/** Minutes after midnight for `HH:MM`, or null when it is not a time of day (`24:00` is one). */
export function toMinutes(raw: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(raw.trim());
  if (match === null) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) {
    return null;
  }
  return hours * 60 + minutes;
}

/** `HH:MM` for minutes after midnight; 1440 is `24:00`. */
export function fromMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function isOnGrid(minutes: number): boolean {
  return minutes % GRID_MINUTES === 0;
}

/** Whether two ranges share any time. Touching end-to-start (10:00 then 10:00) is not overlap. */
export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** The parts of `range` that none of `covering` covers, earliest first. */
export function gaps(range: TimeRange, covering: readonly TimeRange[]): TimeRange[] {
  const result: TimeRange[] = [];
  let from = range.start;
  for (const cover of [...covering].sort((a, b) => a.start - b.start)) {
    if (cover.end <= from || cover.start >= range.end) {
      continue;
    }
    if (cover.start > from) {
      result.push({ start: from, end: cover.start });
    }
    from = Math.max(from, cover.end);
  }
  if (from < range.end) {
    result.push({ start: from, end: range.end });
  }
  return result;
}

/** `07:00–12:00`. */
export function formatRange(range: TimeRange): string {
  return `${fromMinutes(range.start)}–${fromMinutes(range.end)}`;
}
