import { VenueNotFoundError, VenueUnavailabilityNotPermittedError } from "../domain/errors";
import { userAccountId } from "../domain/user-account";
import { canMaintainVenues, venueId } from "../domain/venue";
import {
  defineVenueUnavailability,
  VENUE_TIME_ZONE,
  type VenueUnavailabilityEntry,
} from "../domain/venue-unavailability";
import type { Clock } from "../ports/outbound/clock";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";
import type {
  AffectedBooking,
  FlaggedBooking,
  VenueUnavailabilityRepository,
} from "../ports/outbound/venue-unavailability-repository";

export interface RecordVenueUnavailabilityCommand {
  /** The roles of the signed-in member of staff recording the block. */
  readonly roles: readonly string[];
  readonly userAccountId: string;
  readonly venueId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly reason: string;
  readonly note: string | null;
}

export interface RecordVenueUnavailabilityResult {
  /** The block as stored, In force. */
  readonly entry: VenueUnavailabilityEntry;
  /** The bookings the block sits over. They are left exactly as they were (AC10). */
  readonly affectedBookings: readonly AffectedBooking[];
  /**
   * SPM-313: the Confirmed bookings and live holds the block flagged, one entry each, with
   * the coordinator to tell. Recording flagged them in the same transaction (AC1); a
   * Requested booking is not among them.
   */
  readonly flaggedBookings: readonly FlaggedBooking[];
}

export interface RecordVenueUnavailabilityDeps {
  readonly unavailability: VenueUnavailabilityRepository;
  readonly venues: VenueCatalogue;
  readonly clock: Clock;
}

/**
 * SPM-21 AC1-AC8, AC10, AC11, AC19: Venue Staff block a venue for a date range
 * and a time of day within the venue's opening hours, with a reason. Over days that already have bookings is fine:
 * those bookings are listed back, and not changed.
 *
 * SPM-313: the store flags the Confirmed bookings and live holds the block overlaps as it
 * records the block, so this reads them back for whoever tells their coordinators.
 */
export class RecordVenueUnavailabilityUseCase {
  constructor(private readonly deps: RecordVenueUnavailabilityDeps) {}

  async execute(command: RecordVenueUnavailabilityCommand): Promise<RecordVenueUnavailabilityResult> {
    const { unavailability, venues, clock } = this.deps;
    if (!canMaintainVenues(command.roles)) {
      throw new VenueUnavailabilityNotPermittedError();
    }
    const staff = userAccountId(command.userAccountId);
    const id = venueId(command.venueId);

    const venue = await venues.find(id);
    if (venue === null) {
      throw new VenueNotFoundError();
    }

    const block = defineVenueUnavailability({
      details: {
        venueId: id,
        startDate: command.startDate,
        endDate: command.endDate,
        startTime: command.startTime,
        endTime: command.endTime,
        reason: command.reason,
        note: command.note,
      },
      openingHours: venue.openingHours,
      now: clock.now(),
      timeZone: VENUE_TIME_ZONE,
    });

    const entry = await unavailability.record(block, staff);
    const affectedBookings = await unavailability.affectedBookings(staff, id, block.slots);
    const flaggedBookings = await unavailability.flaggedBookings(staff, entry.id);
    return { entry, affectedBookings, flaggedBookings };
  }
}
