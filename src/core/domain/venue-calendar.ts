import { BOOKING_SLOTS, holdsSlot, isCalendarDate, slotRange, type BookingSlot, type OccupiedSlot, type SlotOnDate } from "./booking";
import { InvalidCalendarRangeError } from "./errors";
import { closedPeriods, type OpeningWindow } from "./opening-hours";
import { slotCodeRange, type SlotCodeOnDate } from "./slot-grid";
import { overlaps } from "./time-of-day";
import type { UnavailabilityReason } from "./venue-unavailability";

/**
 * What a Coordinator sees in one slot of a venue's calendar (SPM-43).
 *
 * - `available`  nothing holds it; a request may be made
 * - `booked`     a Confirmed booking holds it
 * - `held`       a Tentative Hold holds it until `holdExpiresAt` (Week 7 C4)
 * - `blocked`    an In force Venue Staff block covers it (SPM-21)
 * - `closed`     the venue is closed for some of the slot's hours (SPM-320)
 */
export type CalendarSlotStatus = "available" | "booked" | "held" | "blocked" | "closed";

export interface CalendarSlot {
  readonly slot: BookingSlot;
  readonly status: CalendarSlotStatus;
  /** When the hold lapses; set only when `status` is `held`, and null if the hold has no expiry. */
  readonly holdExpiresAt: Date | null;
  /**
   * SPM-153: why the slot is blocked, once per reason, in the order the blocks
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
  /** In `BOOKING_SLOTS` order. */
  readonly slots: readonly CalendarSlot[];
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

function slotKey({ date, slot }: SlotOnDate): string {
  return `${date}|${slot}`;
}

/**
 * SPM-152: each slot's status on each day, from the venue's opening hours, the
 * bookings on it and the blocks over it, as of `now`.
 *
 * When more than one thing applies, the first wins:
 *
 *   blocked > booked > held > closed > available
 *
 * - A block beats a booking: approval over a block is refused (SPM-22), so a
 *   booking under one cannot go ahead.
 * - Booked and held never meet on one slot: only one live hold or
 *   confirmation per venue and slot (`booking_slot_no_double_booking_uidx`).
 * - Whether a booking holds its slot is `holdsSlot`: a Requested, Rejected,
 *   Released or Cancelled booking, or a hold past its expiry, holds nothing
 *   and leaves the slot available.
 * - A slot the venue is closed for cannot be requested, but a booking or
 *   block already on it still shows, so changing the hours hides nothing.
 *
 * Setup and turnaround buffers are not counted (#123, SPM-23).
 */
export function deriveVenueCalendar(input: {
  readonly days: readonly string[];
  readonly openingHours: readonly OpeningWindow[];
  readonly occupied: readonly OccupiedSlot[];
  readonly blocked: readonly CalendarBlock[];
  readonly now: Date;
}): CalendarDay[] {
  const blocked = new Map<string, { reasons: UnavailabilityReason[]; notes: string[] }>();
  // A block is on 15-minute slots (SPM-321); a calendar slot is blocked when any of them falls in its hours.
  for (const block of input.blocked) {
    const covered = slotCodeRange(block.slot);
    for (const slot of BOOKING_SLOTS) {
      if (!overlaps(covered, slotRange(slot))) {
        continue;
      }
      const key = slotKey({ date: block.date, slot });
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
  const holding = new Map<string, OccupiedSlot>();
  for (const occupied of input.occupied) {
    if (holdsSlot(occupied, input.now)) {
      holding.set(slotKey(occupied), occupied);
    }
  }

  return input.days.map((date) => ({
    date,
    slots: BOOKING_SLOTS.map((slot): CalendarSlot => {
      const key = slotKey({ date, slot });
      const booking = holding.get(key);
      const why = blocked.get(key);

      if (why !== undefined) {
        return { slot, status: "blocked", holdExpiresAt: null, ...why };
      }
      if (booking?.status === "Confirmed") {
        return { slot, status: "booked", holdExpiresAt: null, reasons: [], notes: [] };
      }
      if (booking !== undefined) {
        return { slot, status: "held", holdExpiresAt: booking.holdExpiresAt, reasons: [], notes: [] };
      }
      if (closedPeriods(input.openingHours, slotRange(slot)).length > 0) {
        return { slot, status: "closed", holdExpiresAt: null, reasons: [], notes: [] };
      }
      return { slot, status: "available", holdExpiresAt: null, reasons: [], notes: [] };
    }),
  }));
}
