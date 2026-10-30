import { holdsSlot, type BookingStatus } from "./booking";
import { NoFlagToClearError, NoFlagToReRequestError, ReRequestPendingError } from "./errors";
import { joinSlotCodes, slotCodeRange, type SlotCodeOnDate } from "./slot-grid";
import type { TimeRangeOnDate } from "./event-times";
import { fromMinutes } from "./time-of-day";
import type { Venue, VenueId } from "./venue";
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
 * a booking of twenty 15-minute slots reads `2026-11-16 13:00 to 18:00`.
 * `merge_time_spans` in the database writes the same text.
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

/**
 * SPM-310 AC1, AC4, AC6: the open reasons the coordinator clears when they decide a flagged
 * booking still fits. Clearing is per booking, so it takes every reason on it and none on the
 * event's other bookings. A booking with none open has nothing to clear.
 */
export function flagsToClear<F extends { readonly bookingId: string }>(
  openFlags: readonly F[],
  bookingId: string,
): readonly F[] {
  const clearing = openFlags.filter((flag) => flag.bookingId === bookingId);
  if (clearing.length === 0) {
    throw new NoFlagToClearError(bookingId);
  }
  return clearing;
}

/** A booking as the re-request rule sees it: its status, and the flagged booking it asks to replace. */
export interface ReRequestingBooking {
  readonly status: BookingStatus;
  readonly replacesBookingId: string | null;
}

/**
 * SPM-251 AC9: whether a re-request for `bookingId` is still waiting for Venue Staff. Once one
 * is decided it is not: a rejected one leaves the booking to be re-requested again (AC7).
 */
export function reRequestPending(bookings: readonly ReRequestingBooking[], bookingId: string): boolean {
  return bookings.some((booking) => booking.replacesBookingId === bookingId && booking.status === "Requested");
}

/**
 * SPM-251 AC1, AC9: the flagged booking a coordinator asks a venue for again. Only a booking with
 * an open flag can be re-requested -- `openFlags` holds none for one that no longer holds its
 * venue -- and only one re-request for it waits for Venue Staff at a time.
 */
export function bookingToReplace(
  openFlags: readonly { readonly bookingId: string }[],
  eventBookings: readonly ReRequestingBooking[],
  bookingId: string,
): string {
  if (!openFlags.some((flag) => flag.bookingId === bookingId)) {
    throw new NoFlagToReRequestError(bookingId);
  }
  if (reRequestPending(eventBookings, bookingId)) {
    throw new ReRequestPendingError(bookingId);
  }
  return bookingId;
}

/** SPM-251 AC2: what the re-request form starts from. */
export interface ReRequestDraft {
  readonly venueId: VenueId;
  readonly roomLayout: string | null;
  readonly times: readonly TimeRangeOnDate[];
}

/**
 * SPM-251 AC2: a re-request starts from the event as it is now, not as it was booked: its
 * current times, or the booking's when the event has none, at the booking's own venue. The
 * layout is the event's preference if that venue supports it, else the booking's layout, else
 * the venue's only one. The coordinator can change any of it before sending (AC3).
 */
export function reRequestDraft(
  event: { readonly times: readonly TimeRangeOnDate[]; readonly roomLayoutPreference: string | null },
  flagged: { readonly venueId: VenueId; readonly roomLayoutName: string | null; readonly times: readonly TimeRangeOnDate[] },
  venue: Pick<Venue, "layouts"> | undefined,
): ReRequestDraft {
  const supported = (name: string | null) =>
    name === null
      ? undefined
      : venue?.layouts.find((layout) => layout.name.toLowerCase() === name.trim().toLowerCase())?.name;
  const onlyLayout = venue?.layouts.length === 1 ? venue.layouts[0].name : undefined;

  return {
    venueId: flagged.venueId,
    roomLayout: supported(event.roomLayoutPreference) ?? supported(flagged.roomLayoutName) ?? onlyLayout ?? null,
    times: event.times.length > 0 ? event.times : flagged.times,
  };
}
