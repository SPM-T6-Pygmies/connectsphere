import { requestVenueBooking, type BookingId, type BookingTimeInput } from "../domain/booking";
import { bookingToReplace } from "../domain/booking-review-flag";
import { CoordinatorEventNotFoundError, VenueNotFoundError } from "../domain/errors";
import { userAccountId, type UserAccountId } from "../domain/user-account";
import { venueId } from "../domain/venue";
import type { BookingFlagRepository } from "../ports/outbound/booking-flag-repository";
import type { BookingRepository } from "../ports/outbound/booking-repository";
import type { Clock } from "../ports/outbound/clock";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";
import type { Notifier } from "../ports/outbound/notifier";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";
import type { VenueStaffDirectory } from "../ports/outbound/venue-staff-directory";

export interface SubmitVenueBookingRequestCommand {
  readonly eventId: string;
  /** The Event Coordinator asking. */
  readonly userAccountId: string;
  readonly venueId: string;
  /** The name of a layout the venue supports; null when the form offered no choice. */
  readonly roomLayout: string | null;
  /** One start and end time per date, as entered; a blank is `""` (SPM-324). */
  readonly times: readonly BookingTimeInput[];
  /** SPM-251: the flagged booking this request replaces; absent or null for an ordinary request. */
  readonly replacesBookingId?: string | null;
}

export interface SubmitVenueBookingRequestResult {
  readonly bookingId: string;
  readonly status: "Requested";
  readonly venueLocation: string;
  /** SPM-251: the venue of the booking a re-request replaces, which stays until it is approved. */
  readonly replacingVenueLocation: string | null;
}

export interface SubmitVenueBookingRequestDeps {
  readonly events: CoordinatorEventRepository;
  readonly venues: VenueCatalogue;
  readonly bookings: BookingRepository;
  /** SPM-251: which of the event's bookings are flagged, and so can be re-requested. */
  readonly flags: Pick<BookingFlagRepository, "openForEvent">;
  readonly venueStaff: VenueStaffDirectory;
  readonly notifier: Notifier;
  readonly clock: Clock;
}

/**
 * SPM-46 (with SPM-104's layout capture): the event's assigned Event
 * Coordinator asks Venue Staff for a venue.
 *
 * Only the coordinator planning the event may ask; anyone else is told the
 * event does not exist (#91). Whether the layout is needed and supported,
 * and whether the time is already held, are `requestVenueBooking`'s calls --
 * this file only gathers what it needs to decide.
 *
 * SPM-61: once the request is saved, every Venue Staff member is told, so it
 * does not sit unreviewed. A refused request is never saved, so never told.
 *
 * SPM-251: a re-request is this same request, naming the flagged booking it
 * replaces. Whether that booking can be re-requested is `bookingToReplace`'s
 * call, and that it does not clash with itself is `requestVenueBooking`'s.
 */
export class SubmitVenueBookingRequestUseCase {
  constructor(private readonly deps: SubmitVenueBookingRequestDeps) {}

  async execute(
    command: SubmitVenueBookingRequestCommand,
  ): Promise<SubmitVenueBookingRequestResult> {
    const { events, venues, bookings, clock } = this.deps;
    const requestedBy = userAccountId(command.userAccountId);

    const event = await events.findAssigned(requestedBy, command.eventId);
    if (event === null) {
      throw new CoordinatorEventNotFoundError(command.eventId);
    }

    const venue = await venues.find(venueId(command.venueId));
    if (venue === null) {
      throw new VenueNotFoundError();
    }

    const replacing =
      command.replacesBookingId == null ? null : await this.flaggedBooking(requestedBy, event.id, command.replacesBookingId);

    const dates = [...new Set(command.times.map(({ date }) => date.trim()).filter((date) => date !== ""))];
    const occupied = dates.length === 0 ? [] : await bookings.listSlotsAt(venue.id, dates);

    const request = requestVenueBooking({
      eventId: event.id,
      eventStatus: event.status,
      venue,
      roomLayout: command.roomLayout,
      times: command.times,
      requestedBy,
      occupied,
      now: clock.now(),
      replacing: replacing?.id ?? null,
    });

    const bookingId = await bookings.submit(request);

    for (const staff of await this.deps.venueStaff.venueStaff()) {
      await this.deps.notifier.venueBookingRequested({
        recipientUserAccountId: staff,
        bookingId,
        eventName: event.name,
        venueLocation: venue.location,
        times: request.times,
      });
    }

    return {
      bookingId,
      status: request.status,
      venueLocation: venue.location,
      replacingVenueLocation: replacing?.venueLocation ?? null,
    };
  }

  /** The flagged booking a re-request names, refused unless `bookingToReplace` allows it (SPM-251). */
  private async flaggedBooking(
    coordinatorId: UserAccountId,
    eventId: string,
    bookingId: string,
  ): Promise<{ readonly id: BookingId; readonly venueLocation: string }> {
    const openFlags = await this.deps.flags.openForEvent(coordinatorId, eventId);
    const id = bookingToReplace(openFlags, await this.deps.bookings.listForEvent(coordinatorId, eventId), bookingId);
    const flag = openFlags.find((candidate) => candidate.bookingId === id);
    return { id: id as BookingId, venueLocation: flag?.venueLocation ?? "" };
  }
}
