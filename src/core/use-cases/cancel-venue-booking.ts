import { cancelBooking } from "../domain/booking";
import { BookingNotFoundError, CoordinatorEventNotFoundError } from "../domain/errors";
import { userAccountId } from "../domain/user-account";
import type { BookingRepository } from "../ports/outbound/booking-repository";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";

export interface CancelVenueBookingCommand {
  readonly eventId: string;
  readonly bookingId: string;
  /** The Event Coordinator asking. */
  readonly userAccountId: string;
}

export interface CancelVenueBookingResult {
  readonly bookingId: string;
  readonly venueLocation: string;
}

export interface CancelVenueBookingDeps {
  readonly events: CoordinatorEventRepository;
  readonly bookings: BookingRepository;
}

/**
 * SPM-20: the assigned Event Coordinator cancels one of the event's venue
 * bookings, so its slots are free for other coordinators at once.
 *
 * Only the coordinator assigned to the event may (AC1); anyone else is told
 * the event does not exist (#91). Which bookings can still be cancelled is
 * `cancelBooking`'s call -- this file gathers what it needs to decide.
 * Telling Venue Staff is SPM-63's.
 */
export class CancelVenueBookingUseCase {
  constructor(private readonly deps: CancelVenueBookingDeps) {}

  async execute(command: CancelVenueBookingCommand): Promise<CancelVenueBookingResult> {
    const { events, bookings } = this.deps;
    const coordinatorId = userAccountId(command.userAccountId);

    const event = await events.findAssigned(coordinatorId, command.eventId);
    if (event === null) {
      throw new CoordinatorEventNotFoundError(command.eventId);
    }

    const booking = (await bookings.listForEvent(coordinatorId, event.id)).find(
      ({ id }) => id === command.bookingId,
    );
    if (booking === undefined) {
      throw new BookingNotFoundError(command.bookingId);
    }

    cancelBooking(booking);
    await bookings.cancel(coordinatorId, booking.id);

    return { bookingId: booking.id, venueLocation: booking.venueLocation };
  }
}
