import { holdsSlot, isCalendarDate, type OccupiedTime } from "./booking";
import { InvalidCalendarRangeError } from "./errors";
import { closedPeriods, toRange, type OpeningWindow } from "./opening-hours";
import { slotCodeRange, type SlotCodeOnDate } from "./slot-grid";
import { fromMinutes, slotCodes, toMinutes, type TimeRange } from "./time-of-day";
import type { UnavailabilityReason } from "./venue-unavailability";

/**
 * What a Coordinator sees in one 15-minute period of a venue's calendar (SPM-323).
 *
 * - `available`  nothing holds it; a request may be made
 * - `confirmed`  a Confirmed booking holds it
 * - `held`       a Tentative Hold holds it until `holdExpiresAt` (Week 7 C4)
 * - `blocked`    an In force Venue Staff block covers it (SPM-21)
 * - `closed`     the venue is closed then (SPM-320)
 */
export type CalendarPeriodStatus = "available" | "confirmed" | "held" | "blocked" | "closed";

export interface CalendarPeriod {
  /** `HH:MM`, on the 15-minute grid. */
  readonly start: string;
  /** `HH:MM`, 15 minutes after `start`; `24:00` for the last period of the day. */
  readonly end: string;
  readonly status: CalendarPeriodStatus;
  /** When the hold lapses; set only when `status` is `held`, and null if the hold has no expiry. */
  readonly holdExpiresAt: Date | null;
  /**
   * SPM-153: why the period is blocked, once per reason, in the order the blocks
   * were given. Empty unless `status` is `blocked`. Overlapping blocks may give
   * more than one.
   */
  readonly reasons: readonly UnavailabilityReason[];
  /**
   * SPM-43 AC2: the notes Venue Staff wrote, once each, in the order the
   * blocks were given. Only an Other block carries a note, so every note here
   * explains `Other`. Empty unless `status` is `blocked`.
   */
  readonly notes: readonly string[];
}

export interface CalendarDay {
  readonly date: string;
  /** Earliest first. Every day of one calendar has the same periods, so they line up as rows. */
  readonly periods: readonly CalendarPeriod[];
}

/** A slot an In force block covers, with the reason and any note Venue Staff recorded. */
export interface CalendarBlock extends SlotCodeOnDate {
  readonly reason: UnavailabilityReason;
  /** Only ever set when the reason is Other. */
  readonly note: string | null;
}

/** How many days the calendar shows at once: one week. */
export const CALENDAR_WEEK_DAYS = 7;

/** `date` moved by `days` (negative moves back). `date` must be a real `YYYY-MM-DD`. */
export function addDays(date: string, days: number): string {
  if (!isCalendarDate(date)) {
    throw new InvalidCalendarRangeError(`${date} is not a date.`);
  }
  const moved = new Date(`${date}T00:00:00.000Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/** The longest range one calendar read covers, so a request cannot ask for years of slots. */
export const CALENDAR_MAX_DAYS = 31;

/**
 * SPM-43: the days a calendar shows, `from` to `to` inclusive. Both must be
 * real dates (`YYYY-MM-DD`), `from` not after `to`, and the range at most
 * `CALENDAR_MAX_DAYS` long.
 */
export function calendarDays(from: string, to: string): string[] {
  for (const date of [from, to]) {
    if (!isCalendarDate(date)) {
      throw new InvalidCalendarRangeError(`${date} is not a date.`);
    }
  }
  if (from > to) {
    throw new InvalidCalendarRangeError(`The end date ${to} is before the start date ${from}.`);
  }

  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const last = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (days.length > CALENDAR_MAX_DAYS) {
    throw new InvalidCalendarRangeError(`Show at most ${CALENDAR_MAX_DAYS} days at a time.`);
  }
  return days;
}

function periodKey(date: string, code: string): string {
  return `${date}|${code}`;
}

/**
 * SPM-323: each day as 15-minute periods, each with its status, from the
 * venue's opening hours, the bookings on it and the blocks over it, as of `now`.
 *
 * The periods run from the venue's opening to its closing (AC1). A live
 * booking or block outside those hours widens them, so changing the hours
 * hides nothing: its periods show it, and the rest of the widening reads
 * closed. A venue with no hours and nothing on it has no periods.
 *
 * When more than one thing applies to a period, the first wins:
 *
 *   blocked > confirmed > held > closed > available
 *
 * - A block beats a booking: approval over a block is refused (SPM-22), so a
 *   booking under one cannot go ahead.
 * - A period is confirmed or held only when a live booking covers it, so a
 *   booking from 10:15 to 11:45 leaves 10:00-10:15 and 11:45-12:00 as they
 *   were (AC2).
 * - Whether a booking holds its time is `holdsSlot`: a Requested, Rejected,
 *   Released or Cancelled booking, or a hold past its expiry, holds nothing.
 * - A block recorded on AM, PM or Night before SPM-321 covers the 15-minute
 *   periods of those hours.
 *
 * Setup and turnaround are not shown: the calendar is the time booked, not
 * the time the room is in use (SPM-19).
 */
export function deriveVenueCalendar(input: {
  readonly days: readonly string[];
  readonly openingHours: readonly OpeningWindow[];
  readonly occupied: readonly OccupiedTime[];
  readonly blocked: readonly CalendarBlock[];
  readonly now: Date;
}): CalendarDay[] {
  const onDays = new Set(input.days);
  const live = input.occupied.filter((o) => onDays.has(o.date) && holdsSlot(o, input.now));
  const blocks = input.blocked.filter((b) => onDays.has(b.date));

  const blocked = new Map<string, { reasons: UnavailabilityReason[]; notes: string[] }>();
  for (const block of blocks) {
    for (const code of slotCodes(slotCodeRange(block.slot))) {
      const key = periodKey(block.date, code);
      const why = blocked.get(key) ?? { reasons: [], notes: [] };
      if (!why.reasons.includes(block.reason)) {
        why.reasons.push(block.reason);
      }
      if (block.note !== null && !why.notes.includes(block.note)) {
        why.notes.push(block.note);
      }
      blocked.set(key, why);
    }
  }

  // A confirmed booking outranks a hold on the same period, whichever comes first.
  const booked = new Map<string, OccupiedTime>();
  for (const booking of live) {
    for (const code of slotCodes(timeRange(booking))) {
      const key = periodKey(booking.date, code);
      if (booked.get(key)?.status !== "Confirmed") {
        booked.set(key, booking);
      }
    }
  }

  const spans = [
    ...input.openingHours.map(toRange),
    ...live.map(timeRange),
    ...blocks.map((b) => slotCodeRange(b.slot)),
  ];
  const rows =
    spans.length === 0
      ? []
      : slotCodes({ start: Math.min(...spans.map((s) => s.start)), end: Math.max(...spans.map((s) => s.end)) });

  return input.days.map((date) => ({
    date,
    periods: rows.map((code): CalendarPeriod => {
      const range = slotCodeRange(code);
      const at = { start: fromMinutes(range.start), end: fromMinutes(range.end) };
      const key = periodKey(date, code);
      const why = blocked.get(key);
      const booking = booked.get(key);

      if (why !== undefined) {
        return { ...at, status: "blocked", holdExpiresAt: null, ...why };
      }
      if (booking?.status === "Confirmed") {
        return { ...at, status: "confirmed", holdExpiresAt: null, reasons: [], notes: [] };
      }
      if (booking !== undefined) {
        return { ...at, status: "held", holdExpiresAt: booking.holdExpiresAt, reasons: [], notes: [] };
      }
      if (closedPeriods(input.openingHours, range).length > 0) {
        return { ...at, status: "closed", holdExpiresAt: null, reasons: [], notes: [] };
      }
      return { ...at, status: "available", holdExpiresAt: null, reasons: [], notes: [] };
    }),
  }));
}

/** A booking's time as minutes after midnight. Bookings are kept on the 15-minute grid (SPM-324). */
function timeRange({ start, end }: OccupiedTime): TimeRange {
  return { start: toMinutes(start) ?? 0, end: toMinutes(end) ?? 0 };
}
