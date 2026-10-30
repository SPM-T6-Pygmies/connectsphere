import {
  DuplicateUnavailabilityError,
  VenueNotFoundError,
  VenueUnavailabilityNotPermittedError,
} from "../domain/errors";
import { userAccountId } from "../domain/user-account";
import { canMaintainVenues, venueId } from "../domain/venue";
import {
  defineVenueUnavailability,
  duplicatesInForceBlock,
  VENUE_TIME_ZONE,
  type VenueUnavailabilityEntry,
} from "../domain/venue-unavailability";
import type { Clock } from "../ports/outbound/clock";
import type { ConfirmationLapses } from "../ports/outbound/confirmation-lapses";
import type { Notifier } from "../ports/outbound/notifier";
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
  /** SPM-111: the events the block took out of Confirmed. */
  readonly lapses: ConfirmationLapses;
  readonly notifier: Pick<Notifier, "venueBookingFlagged" | "eventNoLongerConfirmed">;
}

/**
 * SPM-21 AC1-AC8, AC10, AC11, AC19: Venue Staff block a venue for a date range
 * and a time of day within the venue's opening hours, with a reason. The same block twice is refused (SPM-321); over days that already have bookings is fine:
 * those bookings are listed back, and not changed.
 *
 * SPM-313: the store flags the Confirmed bookings and live holds the block overlaps as it
 * records the block, so this reads them back for whoever tells their coordinators.
 *
 * SPM-71: each flagged booking's coordinator is told, one notice per booking. A refused
 * block is never saved, so never told; a booking whose event has no coordinator has
 * nobody to tell.
 *
 * SPM-111: a Confirmed event with a booking the block flagged goes back to Planning in
 * the same transaction, and its Organiser is told what lapsed.
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

    if (duplicatesInForceBlock(block, await unavailability.list(staff))) {
      throw new DuplicateUnavailabilityError();
    }

    const entry = await unavailability.record(block, staff);
    const affectedBookings = await unavailability.affectedBookings(staff, id, block.slots);
    const flaggedBookings = await unavailability.flaggedBookings(staff, entry.id);

    for (const flagged of flaggedBookings) {
      if (flagged.coordinatorUserAccountId === null) continue;
      await this.deps.notifier.venueBookingFlagged({
        recipientUserAccountId: flagged.coordinatorUserAccountId,
        bookingId: flagged.bookingId,
        eventId: flagged.eventId,
        eventName: flagged.eventName,
        venueLocation: flagged.venueLocation,
        reasonCode: "venue-unavailable",
        reasons: [flagged.detail],
      });
    }

    for (const lapse of await this.deps.lapses.causedBy(staff, "venue-unavailable", entry.id)) {
      await this.deps.notifier.eventNoLongerConfirmed({
        recipientUserAccountId: lapse.owningOrganiserUserAccountId,
        eventId: lapse.eventId,
        eventRequestId: lapse.eventRequestId,
        eventName: lapse.eventName,
        lapsed: lapse.lapsed,
      });
    }

    return { entry, affectedBookings, flaggedBookings };
  }
}
