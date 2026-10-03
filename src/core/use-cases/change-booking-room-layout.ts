import {
  checkLayoutCapacity,
  chooseLayoutChange,
  type LayoutCapacityCheck,
} from "../domain/booking";
import {
  BookingNotFoundError,
  CoordinatorEventNotFoundError,
  VenueNotFoundError,
} from "../domain/errors";
import { userAccountId } from "../domain/user-account";
import type { BookingRepository } from "../ports/outbound/booking-repository";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";

export interface ChangeBookingRoomLayoutCommand {
  readonly eventId: string;
  readonly bookingId: string;
  /** The Event Coordinator asking. */
  readonly userAccountId: string;
  /** The name of a layout the venue supports; null when the form offered no choice. */
  readonly roomLayout: string | null;
}

export interface ChangeBookingRoomLayoutResult {
  readonly bookingId: string;
  readonly capacity: LayoutCapacityCheck;
}

export interface ChangeBookingRoomLayoutDeps {
  readonly events: CoordinatorEventRepository;
  readonly venues: VenueCatalogue;
  readonly bookings: BookingRepository;
}

/**
 * SPM-104: the assigned Event Coordinator moves a pending booking request to
 * another layout of the same venue, and sees whether the event still fits.
 *
 * Only the coordinator planning the event may do this; anyone else is told
 * the event does not exist (#91). Which layouts are allowed, and that only a
 * pending request can change, are `chooseLayoutChange`'s calls -- this file
 * gathers what it needs to decide. The capacity is a result to show, not a
 * gate: whether over capacity blocks or only warns is still open (SPM-107).
 */
export class ChangeBookingRoomLayoutUseCase {
  constructor(private readonly deps: ChangeBookingRoomLayoutDeps) {}

  async execute(
    command: ChangeBookingRoomLayoutCommand,
  ): Promise<ChangeBookingRoomLayoutResult> {
    const { events, venues, bookings } = this.deps;
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

    const venue = await venues.find(booking.venueId);
    if (venue === null) {
      throw new VenueNotFoundError();
    }

    const roomLayout = chooseLayoutChange(booking, venue, command.roomLayout);
    await bookings.changeRoomLayout(coordinatorId, booking.id, roomLayout);

    return {
      bookingId: booking.id,
      capacity: checkLayoutCapacity(
        venue,
        roomLayout,
        event.expectedAttendance,
      ),
    };
  }
}
