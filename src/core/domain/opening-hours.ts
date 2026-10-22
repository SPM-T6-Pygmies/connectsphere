import { InvalidVenueError } from "./errors";
import {
  END_OF_DAY,
  fromMinutes,
  gaps,
  isOnGrid,
  toMinutes,
  type TimeRange,
} from "./time-of-day";

/**
 * SPM-320: the period a venue is open, the same every day. Times are `HH:MM` on
 * the 15-minute grid; `24:00` is a valid end (AC2).
 */
export interface OpeningWindow {
  readonly start: string;
  readonly end: string;
}

/**
 * The only way to obtain valid opening hours (SPM-320 AC2): one continuous
 * window a day, on the grid and ending after it starts. A venue has no break
 * in its day (team decision on brain Q12, 2026-10-22: operating hours bound
 * the day). Kept as a list so every reader takes hours the same way.
 */
export function defineOpeningHours(windows: readonly OpeningWindow[]): OpeningWindow[] {
  if (windows.length === 0) {
    throw refuse("Set the venue's opening and closing time.");
  }
  if (windows.length > 1) {
    throw refuse("A venue opens once a day: set one opening time and one closing time.");
  }

  const [window] = windows;
  const start = gridTime(window.start);
  const end = gridTime(window.end);
  if (start === END_OF_DAY) {
    throw refuse("An opening window cannot start at 24:00.");
  }
  if (end <= start) {
    throw refuse(`The window ${window.start}–${window.end} must end after it starts.`);
  }
  return [toWindow({ start, end })];
}

/** The parts of `range` the venue is closed for, earliest first (SPM-320 AC3). */
export function closedPeriods(
  windows: readonly OpeningWindow[],
  range: TimeRange,
): TimeRange[] {
  return gaps(range, windows.map(toRange));
}

/** `07:00–12:00, 19:00–24:00` (SPM-320 AC5). Empty when the venue has no hours. */
export function formatOpeningHours(windows: readonly OpeningWindow[]): string {
  return windows.map((window) => `${window.start}–${window.end}`).join(", ");
}

/** A window as minutes after midnight. Assumes it came through `defineOpeningHours`. */
export function toRange(window: OpeningWindow): TimeRange {
  return { start: toMinutes(window.start) ?? 0, end: toMinutes(window.end) ?? 0 };
}

function toWindow(range: TimeRange): OpeningWindow {
  return { start: fromMinutes(range.start), end: fromMinutes(range.end) };
}

function gridTime(raw: string): number {
  const minutes = toMinutes(raw);
  if (minutes === null) {
    throw refuse(`${raw.trim() || "A blank"} is not a time -- enter it as HH:MM, such as 07:00.`);
  }
  if (!isOnGrid(minutes)) {
    throw refuse(`${raw.trim()} is not on the 15-minute grid -- use :00, :15, :30 or :45.`);
  }
  return minutes;
}

function refuse(reason: string): InvalidVenueError {
  return new InvalidVenueError(reason, "openingHours");
}
