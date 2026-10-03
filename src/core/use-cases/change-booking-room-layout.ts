import {
  checkLayoutCapacity,
  chooseRoomLayout,
  type Booking,
  type BookingId,
  type LayoutCapacityCheck,
} from "../domain/booking";
import {
  BookingNotFoundError,
  BookingRoomLayoutNotChangeableError,
  VenueNotFoundError,
} from "../domain/errors";
import type { BookingRepository } from "../ports/outbound/booking-repository";
import type { EventAttendance } from "../ports/outbound/event-attendance";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";

export interface ChangeBookingRoomLayoutCommand {
  readonly bookingId: BookingId;
  readonly roomLayout: string | null;
}

export interface ChangeBookingRoomLayoutResult {
  readonly booking: Booking;
  /** Re-run against the new layout's capacity. */
  readonly capacity: LayoutCapacityCheck;
}

export interface ChangeBookingRoomLayoutDeps {
  readonly venues: VenueCatalogue;
  readonly bookings: BookingRepository;
  readonly attendance: EventAttendance;
}

/**
 * SPM-104: changing a booking's layout re-runs the capacity check against the
 * new layout's figure. Only a booking still 'Requested' can change: once Venue
 * Staff have decided, the layout is part of what they decided on.
 *
 * The new layout is checked before anything is written, so a refused change
 * leaves the booking as it was.
 */
export class ChangeBookingRoomLayoutUseCase {
  constructor(private readonly deps: ChangeBookingRoomLayoutDeps) {}

  async execute(command: ChangeBookingRoomLayoutCommand): Promise<ChangeBookingRoomLayoutResult> {
    const { venues, bookings, attendance } = this.deps;

    const booking = await bookings.find(command.bookingId);
    if (booking === null) {
      throw new BookingNotFoundError();
    }
    if (booking.status !== "Requested") {
      throw new BookingRoomLayoutNotChangeableError(booking.status);
    }
    const venue = await venues.find(booking.venueId);
    if (venue === null) {
      throw new VenueNotFoundError();
    }

    const roomLayout = chooseRoomLayout(venue, command.roomLayout);
    const changed = await bookings.changeRoomLayout(booking.id, roomLayout);

    return {
      booking: changed,
      capacity: checkLayoutCapacity(
        venue,
        roomLayout,
        await attendance.expectedAttendance(booking.eventId),
      ),
    };
  }
}
