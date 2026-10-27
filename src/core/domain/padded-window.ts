import type { TimeRangeOnDate } from "./event-times";
import { END_OF_DAY, fromMinutes, overlaps, toMinutes, type TimeRange } from "./time-of-day";

/** A venue's setup and turnaround in minutes, an undefined one already counted as 0 (`bufferMinutes`). */
export interface Buffers {
  readonly setup: number;
  readonly turnaround: number;
}

/**
 * SPM-23 AC6: the one rule for what a booking takes from its venue. The booked time plus the
 * venue's setup before it and turnaround after it: 10:00-12:00 with 30 and 45 minutes occupies
 * 09:30-12:45. Every check that asks "does this clash?" uses it, so the padding is written once.
 * A Tentative Hold is padded in the same way as any other booking (SPM-23 AC7, changed 2026-10-24),
 * so the booking's status does not matter here.
 *
 * AC8: opening hours apply to the booked time only. Setup may begin before the venue opens and
 * turnaround may run past closing, and a window that passes midnight continues on the
 * neighbouring date, so it comes back as one piece per date. A value is at most a day
 * (`MAX_BUFFER_MINUTES`), so a window reaches only the date before and the date after.
 */
export function paddedWindows(booked: TimeRangeOnDate, buffers: Buffers): TimeRangeOnDate[] {
  const { start, end } = minutes(booked);
  const from = start - buffers.setup;
  const to = end + buffers.turnaround;

  const pieces: TimeRangeOnDate[] = [];
  if (from < 0) {
    pieces.push(piece(shiftDate(booked.date, -1), { start: END_OF_DAY + from, end: END_OF_DAY }));
  }
  pieces.push(piece(booked.date, { start: Math.max(from, 0), end: Math.min(to, END_OF_DAY) }));
  if (to > END_OF_DAY) {
    pieces.push(piece(shiftDate(booked.date, 1), { start: 0, end: to - END_OF_DAY }));
  }
  return pieces;
}

/**
 * Whether two bookings' windows share any time. They clash when one's turnaround meets the
 * other's event or setup; a window ending exactly when another begins does not (SPM-23 AC6).
 */
export function paddedWindowsClash(
  a: readonly TimeRangeOnDate[],
  b: readonly TimeRangeOnDate[],
): boolean {
  return a.some((one) => b.some((other) => one.date === other.date && overlaps(minutes(one), minutes(other))));
}

/** One stretch of time another booking's padded window shares with a request's (SPM-19). */
export interface PaddedClash {
  readonly eventName: string;
  readonly date: string;
  readonly start: string;
  readonly end: string;
  /** Set when the booking in the way is a Tentative Hold: when it expires (null: no expiry). */
  readonly hold: { readonly expiresAt: string | null } | null;
}

/**
 * SPM-19: where a request's padded windows overlap the padded windows of the live bookings at its
 * venue (`others`, already filtered to those that hold the venue), naming the event in the way, in
 * date then start order. Windows that only touch do not overlap. The database function
 * `booking_padded_clashes` applies the same rule at the approval itself.
 */
export function paddedClashes(
  requested: readonly TimeRangeOnDate[],
  others: ReadonlyArray<{
    readonly eventName: string;
    readonly times: readonly TimeRangeOnDate[];
    /** Set for a Tentative Hold, so the refusal can say so and when it expires. */
    readonly hold?: { readonly expiresAt: string | null };
  }>,
  buffers: Buffers,
): PaddedClash[] {
  const mine = requested.flatMap((time) => paddedWindows(time, buffers));
  return others
    .flatMap(({ eventName, times, hold }) =>
      times.flatMap((time) => paddedWindows(time, buffers)).flatMap((theirs) =>
        mine.flatMap((window) => {
          if (window.date !== theirs.date) return [];
          const start = Math.max(minutes(window).start, minutes(theirs).start);
          const end = Math.min(minutes(window).end, minutes(theirs).end);
          return start < end
            ? [{ eventName, date: window.date, start: fromMinutes(start), end: fromMinutes(end), hold: hold ?? null }]
            : [];
        }),
      ),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

function minutes({ start, end }: TimeRangeOnDate): TimeRange {
  return { start: toMinutes(start) ?? 0, end: toMinutes(end) ?? 0 };
}

function piece(date: string, range: TimeRange): TimeRangeOnDate {
  return { date, start: fromMinutes(range.start), end: fromMinutes(range.end) };
}

export function shiftDate(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00.000Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}
