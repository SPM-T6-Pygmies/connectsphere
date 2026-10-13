import { BOOKING_SLOTS, holdsSlot, isCalendarDate, type BookingSlot, type OccupiedSlot, type SlotOnDate } from "./booking";
import { InvalidCalendarRangeError } from "./errors";
import type { UnavailabilityReason } from "./venue-unavailability";

/**
 * What a Coordinator sees in one slot of a venue's calendar (SPM-43).
 *
 * - `available`  nothing holds it; a request may be made
 * - `booked`     a Confirmed booking holds it
 * - `held`       a Tentative Hold holds it until `holdExpiresAt` (Week 7 C4)
 * - `blocked`    an In force Venue Staff block covers it (SPM-21)
 * - `notOffered` the venue is never booked in this slot (`venue_slot`)
 */
export type CalendarSlotStatus = "available" | "booked" | "held" | "blocked" | "notOffered";

export interface CalendarSlot {
  readonly slot: BookingSlot;
  readonly status: CalendarSlotStatus;
  /** When the hold lapses; set only when `status` is `held`, and null if the hold has no expiry. */
  readonly holdExpiresAt: Date | null;
}

export interface CalendarDay {
  readonly date: string;
  /** In `BOOKING_SLOTS` order. */
  readonly slots: readonly CalendarSlot[];
}

/** A slot an In force block covers, with the reason Venue Staff recorded. */
export interface CalendarBlock extends SlotOnDate {
  readonly reason: UnavailabilityReason;
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
 * SPM-152: each slot's status on each day, from what the venue offers, the
 * bookings on it and the blocks over it, as of `now`.
 *
 * When more than one thing applies, the first wins:
 *
 *   blocked > booked > held > notOffered > available
 *
 * - A block beats a booking: approval over a block is refused (SPM-22), so a
 *   booking under one cannot go ahead.
 * - Booked and held never meet on one slot: only one live hold or
 *   confirmation per venue and slot (`booking_slot_no_double_booking_uidx`).
 * - Whether a booking holds its slot is `holdsSlot`: a Requested, Rejected,
 *   Released or Cancelled booking, or a hold past its expiry, holds nothing
 *   and leaves the slot available.
 * - A slot the venue is not booked in cannot be requested, but a booking or
 *   block already on it still shows, so dropping a slot hides nothing.
 *
 * Setup and turnaround buffers are not counted (#123, SPM-23).
 */
export function deriveVenueCalendar(input: {
  readonly days: readonly string[];
  readonly offeredSlots: readonly BookingSlot[];
  readonly occupied: readonly OccupiedSlot[];
  readonly blocked: readonly CalendarBlock[];
  readonly now: Date;
}): CalendarDay[] {
  const blocked = new Set(input.blocked.map(slotKey));
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

      if (blocked.has(key)) {
        return { slot, status: "blocked", holdExpiresAt: null };
      }
      if (booking?.status === "Confirmed") {
        return { slot, status: "booked", holdExpiresAt: null };
      }
      if (booking !== undefined) {
        return { slot, status: "held", holdExpiresAt: booking.holdExpiresAt };
      }
      if (!input.offeredSlots.includes(slot)) {
        return { slot, status: "notOffered", holdExpiresAt: null };
      }
      return { slot, status: "available", holdExpiresAt: null };
    }),
  }));
}
