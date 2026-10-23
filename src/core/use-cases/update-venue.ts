import { VenueMaintenanceNotPermittedError } from "../domain/errors";
import { canMaintainVenues, defineVenue, venueId, type Venue } from "../domain/venue";
import { flagsForVenueChange, newlyFlaggedReasons, VENUE_ATTRIBUTES_FLAG } from "../domain/venue-change-flag";
import type { Clock } from "../ports/outbound/clock";
import type { Notifier } from "../ports/outbound/notifier";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";
import type { VenueChangeReview } from "../ports/outbound/venue-change-review";

export interface UpdateVenueCommand {
  /** The roles of the signed-in member of staff making the change. */
  readonly roles: readonly string[];
  readonly venueId: string;
  readonly location: string;
  readonly facilities: string | null;
  readonly accessibility: string | null;
  readonly openingHours: readonly { readonly start: string; readonly end: string }[];
  readonly capacity: number | null;
  readonly bookingHorizonDays: number | null;
  /** The venue's supported layouts after the update: one not listed here is removed. */
  readonly layouts: readonly { readonly name: string; readonly capacity: number }[];
}

export interface UpdateVenueResult {
  /** The venue as the catalogue now holds it. */
  readonly venue: Venue;
}

export interface UpdateVenueDeps {
  readonly venues: VenueCatalogue;
  readonly review: VenueChangeReview;
  readonly clock: Clock;
  readonly notifier: Pick<Notifier, "venueBookingFlagged">;
}

/**
 * SPM-147 (SPM-42 AC3): Venue Staff edit a venue's attributes, and add, edit or
 * remove its supported layouts, including a layout's capacity.
 *
 * SPM-105: the live bookings the edit no longer fits are then flagged for their
 * coordinator. The booking itself is left as it is.
 *
 * SPM-71: each booking the edit newly flags has its coordinator told, once, with every
 * reason. A booking whose event has no coordinator has nobody to tell.
 */
export class UpdateVenueUseCase {
  constructor(private readonly deps: UpdateVenueDeps) {}

  async execute(command: UpdateVenueCommand): Promise<UpdateVenueResult> {
    if (!canMaintainVenues(command.roles)) {
      throw new VenueMaintenanceNotPermittedError();
    }

    const id = venueId(command.venueId);
    const before = await this.deps.venues.find(id);
    const venue = await this.deps.venues.revise(
      id,
      defineVenue({
        location: command.location,
        facilities: command.facilities,
        accessibility: command.accessibility,
        openingHours: command.openingHours,
        capacity: command.capacity,
        bookingHorizonDays: command.bookingHorizonDays,
        layouts: command.layouts,
      }),
    );

    // `revise` has already thrown if there is no such venue.
    if (before !== null) {
      const bookings = await this.deps.review.bookingsAt(id);
      const flags = flagsForVenueChange(before, venue, bookings, this.deps.clock.now());
      if (flags.length > 0) {
        await this.deps.review.flag(id, flags);
      }

      const reasons = newlyFlaggedReasons(flags);
      for (const booking of bookings) {
        const details = reasons.get(booking.id);
        if (details === undefined || booking.coordinatorUserAccountId === null) continue;
        await this.deps.notifier.venueBookingFlagged({
          recipientUserAccountId: booking.coordinatorUserAccountId,
          bookingId: booking.id,
          eventId: booking.eventId,
          eventName: booking.eventName,
          venueLocation: venue.location,
          reasonCode: VENUE_ATTRIBUTES_FLAG,
          reasons: details,
        });
      }
    }

    return { venue };
  }
}
