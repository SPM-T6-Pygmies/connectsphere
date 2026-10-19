import { holdsSlot, slotEndsAt, slotStartsAt, type BookingStatus, type SlotOnDate } from "./booking";
import type { VenueId } from "./venue";
import type { VenueUnavailabilityEntry } from "./venue-unavailability";

/** The reason code for a booking flagged because a block covers it (SPM-313). */
export const VENUE_UNAVAILABLE_FLAG = "venue-unavailable";

export interface TimeWindow {
  readonly startsAt: Date;
  readonly endsAt: Date;
}

/**
 * The time a booked slot takes from its venue. Everything that asks "does this
 * booking clash with that?" goes through here, so the setup and turnaround
 * padding of SPM-23 widens it in one place. Until then it is the slot's own
 * hours, as the booking was made.
 */
export function bookingWindow(slot: SlotOnDate): TimeWindow {
  return { startsAt: slotStartsAt(slot), endsAt: slotEndsAt(slot) };
}

/** Half-open: a window ending exactly when another starts does not overlap it. */
export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

/** A booking as the flagging rule sees it. */
export interface FlaggableBooking {
  readonly id: string;
  readonly venueId: VenueId;
  readonly status: BookingStatus;
  readonly holdExpiresAt: Date | null;
  readonly slots: readonly SlotOnDate[];
}

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

/** The booked slots a block's slots overlap, in the order the booking lists them. */
function overlappedSlots(booking: FlaggableBooking, block: VenueUnavailabilityEntry): readonly SlotOnDate[] {
  const blocked = block.slots.map(bookingWindow);
  return booking.slots.filter((slot) => {
    const window = bookingWindow(slot);
    return blocked.some((blockWindow) => windowsOverlap(window, blockWindow));
  });
}

function hhmm(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/**
 * What the coordinator reads: the block's date and times, its reason, and, once
 * Venue Staff lift it, that it was lifted and when. Lifting never clears the
 * flag, so the reason has to say it.
 */
export function blockFlagDetail(
  block: VenueUnavailabilityEntry,
  overlapping: readonly SlotOnDate[],
): string {
  const spans = overlapping
    .map((slot) => {
      const { startsAt, endsAt } = bookingWindow(slot);
      return `${slot.date} ${hhmm(startsAt)} to ${hhmm(endsAt)}`;
    })
    .join(", ");
  const lifted = block.status === "Lifted" && block.liftedAt !== null ? `, block lifted ${block.liftedAt}` : "";
  return `${block.reason}: ${spans}${lifted}`;
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
  block: VenueUnavailabilityEntry,
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
    const overlapping = overlappedSlots(booking, block);
    if (overlapping.length === 0) {
      continue;
    }
    flagged.push({
      bookingId: booking.id,
      reason: {
        code: VENUE_UNAVAILABLE_FLAG,
        sourceBlockId: block.id,
        detail: blockFlagDetail(block, overlapping),
      },
    });
  }
  return flagged;
}
