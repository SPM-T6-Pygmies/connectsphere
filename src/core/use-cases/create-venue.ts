import { VenueMaintenanceNotPermittedError } from "../domain/errors";
import { canMaintainVenues, defineVenue, type Venue } from "../domain/venue";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";

export interface CreateVenueCommand {
  /** The roles of the signed-in member of staff making the change. */
  readonly roles: readonly string[];
  readonly location: string;
  readonly facilities: string | null;
  readonly accessibility: string | null;
  readonly openingHours: readonly { readonly start: string; readonly end: string }[];
  readonly capacity: number | null;
  readonly bookingHorizonDays: number | null;
  /** SPM-23: both or neither; defined once, then locked. */
  readonly setupMinutes: number | null;
  readonly turnaroundMinutes: number | null;
  readonly layouts: readonly { readonly name: string; readonly capacity: number }[];
}

export interface CreateVenueResult {
  /** The venue as the catalogue now holds it. */
  readonly venue: Venue;
}

export interface CreateVenueDeps {
  readonly venues: VenueCatalogue;
}

/** SPM-146 (SPM-42 AC1, AC2): Venue Staff add a venue and its supported layouts. */
export class CreateVenueUseCase {
  constructor(private readonly deps: CreateVenueDeps) {}

  async execute(command: CreateVenueCommand): Promise<CreateVenueResult> {
    if (!canMaintainVenues(command.roles)) {
      throw new VenueMaintenanceNotPermittedError();
    }

    const venue = await this.deps.venues.add(
      defineVenue({
        location: command.location,
        facilities: command.facilities,
        accessibility: command.accessibility,
        openingHours: command.openingHours,
        capacity: command.capacity,
        bookingHorizonDays: command.bookingHorizonDays,
        setupMinutes: command.setupMinutes,
        turnaroundMinutes: command.turnaroundMinutes,
        layouts: command.layouts,
      }),
    );

    return { venue };
  }
}
