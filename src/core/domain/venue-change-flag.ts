import { holdsSlot, type BookingStatus } from "./booking";
import { bookingWindow } from "./booking-review-flag";
import type { SlotCodeOnDate } from "./slot-grid";
import type { Venue } from "./venue";
import { checkVenueSuitability, type EventNeeds, type SuitabilityCheck, type SuitabilityRow } from "./venue-suitability";

/** The reason code for a booking flagged because Venue Staff changed its venue (SPM-105). */
export const VENUE_ATTRIBUTES_FLAG = "venue-attributes";

/** A booking at the changed venue, with the needs of its event as they are now. */
export interface VenueChangeBooking {
  readonly id: string;
  readonly status: BookingStatus;
  readonly holdExpiresAt: Date | null;
  readonly slots: readonly SlotCodeOnDate[];
  readonly roomLayoutName: string | null;
  readonly needs: EventNeeds;
}

export interface VenueChangeFlag {
  readonly bookingId: string;
  /** What changed, e.g. `capacity:Banquet`: one open reason per booking and source (AC8). */
  readonly sourceRef: string;
  /** The reason as the coordinator reads it, e.g. `Capacity: Banquet seats 80, 40 over`. */
  readonly detail: string;
  /**
   * True when the check passed (or could not be judged) before the change: the booking is
   * flagged. False when it already failed and now fails for a new reason: only a reason
   * still open is restated, so a cleared one is not reopened (AC3, AC8).
   */
  readonly startsFailing: boolean;
}

const LABELS: Readonly<Record<SuitabilityCheck, string>> = {
  layout: "Layout",
  capacity: "Capacity",
  accessibility: "Accessibility",
  facilities: "Facilities",
};

function sourceRef(check: SuitabilityCheck, booking: VenueChangeBooking): string {
  if (check === "layout") return `layout:${booking.needs.preferredLayout}`;
  if (check === "capacity") return `capacity:${booking.roomLayoutName ?? booking.needs.preferredLayout}`;
  return check;
}

/** A Confirmed booking or live hold whose time has not all passed: one there is still time to act on. */
function stillToCome(booking: VenueChangeBooking, now: Date): boolean {
  return holdsSlot(booking, now) && booking.slots.some((slot) => bookingWindow(slot).endsAt > now);
}

/**
 * SPM-105: which bookings a venue edit flags, and why. Each booking is judged with the
 * SPM-45 suitability check against the venue as it was and as it is now, with the
 * event's needs as they are now. A check that fails now and did not before flags the
 * booking (AC1); one that fails both times, for the same reason, is left alone (AC3).
 * A check it cannot judge never flags (AC5). Only the four checks are compared, so an
 * edit to anything else flags nothing (AC4).
 */
export function flagsForVenueChange(
  before: Venue,
  after: Venue,
  bookings: readonly VenueChangeBooking[],
  now: Date,
): readonly VenueChangeFlag[] {
  return bookings
    .filter((booking) => stillToCome(booking, now))
    .flatMap((booking) => {
      const was = checkVenueSuitability(before, booking.roomLayoutName, booking.needs).rows;
      const is = checkVenueSuitability(after, booking.roomLayoutName, booking.needs).rows;
      return is.flatMap((row): VenueChangeFlag[] => {
        const previous = was.find((candidate) => candidate.check === row.check);
        if (row.status !== "fail" || sameFailure(previous, row)) {
          return [];
        }
        return [
          {
            bookingId: booking.id,
            sourceRef: sourceRef(row.check, booking),
            detail: `${LABELS[row.check]}: ${row.detail}`,
            startsFailing: previous?.status !== "fail",
          },
        ];
      });
    });
}

function sameFailure(previous: SuitabilityRow | undefined, row: SuitabilityRow): boolean {
  return previous?.status === "fail" && previous.detail === row.detail;
}

/**
 * SPM-71: the reasons each booking starts failing for, one entry per booking in the order
 * flagged: what its coordinator is told. A reason that only restates a check already failing
 * tells nobody: the booking was flagged for it before (AC4).
 */
export function newlyFlaggedReasons(flags: readonly VenueChangeFlag[]): ReadonlyMap<string, readonly string[]> {
  const reasons = new Map<string, string[]>();
  for (const { bookingId, detail, startsFailing } of flags) {
    if (startsFailing) reasons.set(bookingId, [...(reasons.get(bookingId) ?? []), detail]);
  }
  return reasons;
}
