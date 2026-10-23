import { VenueMaintenanceNotPermittedError } from "../domain/errors";
import { VenueNotFoundError } from "../domain/errors";
import { canMaintainVenues, defineVenue, venueId, type Venue } from "../domain/venue";
import { buffersOf, checkBuffersChange } from "../domain/venue-buffers";
import type { Clock } from "../ports/outbound/clock";
import type { UpcomingVenueBookings } from "../ports/outbound/upcoming-venue-bookings";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";

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
  /** SPM-23: defined once, then locked. Send the venue's own values back to leave them as they are. */
  readonly setupMinutes: number | null;
  readonly turnaroundMinutes: number | null;
  /** The venue's supported layouts after the update: one not listed here is removed. */
  readonly layouts: readonly { readonly name: string; readonly capacity: number }[];
}

export interface UpdateVenueResult {
  /** The venue as the catalogue now holds it. */
  readonly venue: Venue;
}

export interface UpdateVenueDeps {
  readonly venues: VenueCatalogue;
  readonly upcomingBookings: UpcomingVenueBookings;
  readonly clock: Clock;
}

/**
 * SPM-147 (SPM-42 AC3): Venue Staff edit a venue's attributes, and add, edit or
 * remove its supported layouts, including a layout's capacity.
 *
 * SPM-23: setup and turnaround are defined once and then locked, and cannot be defined while
 * the venue has a booking that has not yet ended.
 */
export class UpdateVenueUseCase {
  constructor(private readonly deps: UpdateVenueDeps) {}

  async execute(command: UpdateVenueCommand): Promise<UpdateVenueResult> {
    if (!canMaintainVenues(command.roles)) {
      throw new VenueMaintenanceNotPermittedError();
    }

    const id = venueId(command.venueId);
    const details = defineVenue({
      location: command.location,
      facilities: command.facilities,
      accessibility: command.accessibility,
      openingHours: command.openingHours,
      capacity: command.capacity,
      bookingHorizonDays: command.bookingHorizonDays,
      setupMinutes: command.setupMinutes,
      turnaroundMinutes: command.turnaroundMinutes,
      layouts: command.layouts,
    });

    const current = await this.deps.venues.find(id);
    if (current === null) {
      throw new VenueNotFoundError();
    }
    checkBuffersChange(
      buffersOf(current),
      buffersOf(details),
      await this.deps.upcomingBookings.hasUpcomingBooking(id, this.deps.clock.now()),
    );

    const venue = await this.deps.venues.revise(id, details);

    return { venue };
  }
}
