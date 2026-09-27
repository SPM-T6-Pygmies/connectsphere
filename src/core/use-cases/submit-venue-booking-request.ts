import {
  requestVenueBooking,
  roomLayoutId,
  venueId,
  type BookingSlot,
} from "../domain/booking";
import { CoordinatorEventNotFoundError, VenueNotFoundError } from "../domain/errors";
import { userAccountId } from "../domain/user-account";
import type { BookingRepository } from "../ports/outbound/booking-repository";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";

export interface SubmitVenueBookingRequestCommand {
  readonly eventId: string;
  /** The Event Coordinator asking. */
  readonly userAccountId: string;
  readonly venueId: string;
  /** Null when the form offered no choice. */
  readonly roomLayoutId: string | null;
  readonly slots: ReadonlyArray<{ readonly date: string; readonly slot: BookingSlot }>;
}

export interface SubmitVenueBookingRequestResult {
  readonly bookingId: string;
  readonly status: "Requested";
  readonly venueLocation: string;
}

export interface SubmitVenueBookingRequestDeps {
  readonly events: CoordinatorEventRepository;
  readonly venues: VenueCatalogue;
  readonly bookings: BookingRepository;
}

/**
 * SPM-46 (with SPM-104's layout capture): the event's assigned Event
 * Coordinator asks Venue Staff for a venue.
 *
 * Only the coordinator planning the event may ask; anyone else is told the
 * event does not exist (#91). Whether the layout is needed and supported,
 * and whether a slot is already held, are `requestVenueBooking`'s calls --
 * this file only gathers what it needs to decide.
 */
export class SubmitVenueBookingRequestUseCase {
  constructor(private readonly deps: SubmitVenueBookingRequestDeps) {}

  async execute(
    command: SubmitVenueBookingRequestCommand,
  ): Promise<SubmitVenueBookingRequestResult> {
    const { events, venues, bookings } = this.deps;
    const requestedBy = userAccountId(command.userAccountId);

    const event = await events.findAssigned(requestedBy, command.eventId);
    if (event === null) {
      throw new CoordinatorEventNotFoundError(command.eventId);
    }

    const venue = await venues.findBookable(venueId(command.venueId));
    if (venue === null) {
      throw new VenueNotFoundError(command.venueId);
    }

    const dates = [...new Set(command.slots.map(({ date }) => date))];
    const occupied = dates.length === 0 ? [] : await bookings.listSlotsAt(venue.id, dates);

    const request = requestVenueBooking({
      eventId: event.id,
      venue,
      roomLayoutId: command.roomLayoutId === null ? null : roomLayoutId(command.roomLayoutId),
      slots: command.slots,
      requestedBy,
      occupied,
    });

    const bookingId = await bookings.submit(request);

    return { bookingId, status: request.status, venueLocation: venue.location };
  }
}
