import { VenueMaintenanceNotPermittedError } from "../domain/errors";
import { canMaintainVenues, defineVenue, venueId, type Venue } from "../domain/venue";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";

export interface UpdateVenueCommand {
  /** The roles of the signed-in member of staff making the change. */
  readonly roles: readonly string[];
  readonly venueId: string;
  readonly location: string;
  readonly facilities: string | null;
  readonly accessibility: string | null;
  readonly operatingHoursStart: string | null;
  readonly operatingHoursEnd: string | null;
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
}

/**
 * SPM-147 (SPM-42 AC3): Venue Staff edit a venue's attributes, and add, edit or
 * remove its supported layouts, including a layout's capacity.
 */
export class UpdateVenueUseCase {
  constructor(private readonly deps: UpdateVenueDeps) {}

  async execute(command: UpdateVenueCommand): Promise<UpdateVenueResult> {
    if (!canMaintainVenues(command.roles)) {
      throw new VenueMaintenanceNotPermittedError();
    }

    const venue = await this.deps.venues.revise(
      venueId(command.venueId),
      defineVenue({
        location: command.location,
        facilities: command.facilities,
        accessibility: command.accessibility,
        operatingHoursStart: command.operatingHoursStart,
        operatingHoursEnd: command.operatingHoursEnd,
        capacity: command.capacity,
        bookingHorizonDays: command.bookingHorizonDays,
        layouts: command.layouts,
      }),
    );

    return { venue };
  }
}
