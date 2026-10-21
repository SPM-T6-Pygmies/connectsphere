import { holdsSlot, type BookingStatus } from "./booking";
import { joinSlotCodes, slotCodeRange, type SlotCodeOnDate } from "./slot-grid";
import { fromMinutes } from "./time-of-day";
import type { VenueId } from "./venue";
import type { VenueUnavailabilityEntry } from "./venue-unavailability";

/** The reason code for a booking flagged because a block covers it (SPM-313). */
export const VENUE_UNAVAILABLE_FLAG = "venue-unavailable";

/** `booking_review_flag_reason_chk`: SPM-105 and SPM-309 add the other two. */
export type FlagReasonCode = typeof VENUE_UNAVAILABLE_FLAG | "venue-attributes" | "event-change";

export interface TimeWindow {
  readonly startsAt: Date;
  readonly endsAt: Date;
}

/**
 * The time a booked slot takes from its venue. Everything that asks "does this
 * booking clash with that?" goes through here, so the setup and turnaround
 * padding of SPM-23 widens it in one place. Until then it is the slot's own hours.
 */
export function bookingWindow({ date, slot }: SlotCodeOnDate): TimeWindow {
  const { start, end } = slotCodeRange(slot);
  const midnight = Date.parse(`${date}T00:00:00+08:00`);
  return { startsAt: new Date(midnight + start * 60_000), endsAt: new Date(midnight + end * 60_000) };
}

/** Half-open: a window ending exactly when another starts does not overlap it. */
export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/**
 * Slots as the day and hours a person reads, with slots that run into each other joined:
 * a booking of twenty 15-minute slots reads `2026-11-16 13:00 to 18:00`, the same as one
 * PM slot. `merge_time_spans` in the database writes the same text.
 */
export function timeSpans(slots: readonly SlotCodeOnDate[]): string {
  const byDate = new Map<string, string[]>();
  for (const { date, slot } of slots) {
    byDate.set(date, [...(byDate.get(date) ?? []), slot]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([date, codes]) =>
      joinSlotCodes(codes).map(({ start, end }) => `${date} ${fromMinutes(start)} to ${fromMinutes(end)}`),
    )
    .join(", ");
}

/** A booking as the flagging rule sees it. */
export interface FlaggableBooking {
  readonly id: string;
  readonly venueId: VenueId;
  readonly status: BookingStatus;
  readonly holdExpiresAt: Date | null;
  readonly slots: readonly SlotCodeOnDate[];
}

/** The parts of a block the rule reads. A recorded block is one; so is a block on 15-minute codes. */
export type FlaggingBlock = Pick<VenueUnavailabilityEntry, "id" | "venueId" | "reason" | "status"> & {
  readonly slots: readonly SlotCodeOnDate[];
};

export interface BlockFlagReason {
  readonly code: typeof VENUE_UNAVAILABLE_FLAG;
  /** One reason per block: saving the same block twice must not add it twice. */
  readonly sourceBlockId: string;
  readonly detail: string;
}

export interface BookingToFlag {
  readonly bookingId: string;
  readonly reason: BlockFlagReason;
}

/** The block's own slots that share time with the booking: the time the coordinator is told is lost. */
function blockedSlotsOver(bookedSlots: readonly SlotCodeOnDate[], block: FlaggingBlock): readonly SlotCodeOnDate[] {
  const booked = bookedSlots.map(bookingWindow);
  return block.slots.filter((slot) => {
    const window = bookingWindow(slot);
    return booked.some((bookedWindow) => windowsOverlap(window, bookedWindow));
  });
}

/**
 * What the coordinator reads: the block's reason and the block's own day and hours that
 * clash with the booking. Whether the block has since been lifted is not part of the text:
 * the page shows it from the block itself, so it can stand out. `venue_staff_record_unavailability`
 * writes the same text.
 */
export function blockFlagDetail(block: FlaggingBlock, bookedSlots: readonly SlotCodeOnDate[]): string {
  return `${block.reason}: ${timeSpans(blockedSlotsOver(bookedSlots, block))}`;
}

/**
 * SPM-313 AC1-AC3, AC5, AC7: which bookings a block flags, and why.
 *
 * Only a Confirmed booking or a live Tentative Hold is flagged. A Requested one
 * is not: Venue Staff cannot approve it over the block (SPM-22). A lapsed hold
 * is not, because it holds nothing. A booking at another venue, or one that
 * only touches the block, is left alone. Bookings of one event are judged one by
 * one (AC7).
 */
export function bookingsToFlagForBlock(
  block: FlaggingBlock,
  bookings: readonly FlaggableBooking[],
  now: Date,
): readonly BookingToFlag[] {
  if (block.status !== "In force") {
    return [];
  }
  const flagged: BookingToFlag[] = [];
  for (const booking of bookings) {
    if (booking.venueId !== block.venueId || !holdsSlot(booking, now)) {
      continue;
    }
    if (blockedSlotsOver(booking.slots, block).length === 0) {
      continue;
    }
    flagged.push({
      bookingId: booking.id,
      reason: {
        code: VENUE_UNAVAILABLE_FLAG,
        sourceBlockId: block.id,
        detail: blockFlagDetail(block, booking.slots),
      },
    });
  }
  return flagged;
}
