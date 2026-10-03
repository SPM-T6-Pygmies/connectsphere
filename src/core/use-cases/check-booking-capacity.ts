import { checkLayoutCapacity, type BookingId, type LayoutCapacityCheck } from "../domain/booking";
import { BookingNotFoundError, VenueNotFoundError } from "../domain/errors";
import type { BookingRepository } from "../ports/outbound/booking-repository";
import type { EventAttendance } from "../ports/outbound/event-attendance";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";

export interface CheckBookingCapacityCommand {
  readonly bookingId: BookingId;
}

export interface CheckBookingCapacityDeps {
  readonly venues: VenueCatalogue;
  readonly bookings: BookingRepository;
  readonly attendance: EventAttendance;
}

/**
 * SPM-104: the capacity check a booking supports -- the capacity of the layout
 * it assumes against the event's attendance as it is now. This is the figure
 * SPM-45's suitability check will read.
 */
export class CheckBookingCapacityUseCase {
  constructor(private readonly deps: CheckBookingCapacityDeps) {}

  async execute(command: CheckBookingCapacityCommand): Promise<LayoutCapacityCheck> {
    const { venues, bookings, attendance } = this.deps;

    const booking = await bookings.find(command.bookingId);
    if (booking === null) {
      throw new BookingNotFoundError();
    }
    const venue = await venues.find(booking.venueId);
    if (venue === null) {
      throw new VenueNotFoundError();
    }

    return checkLayoutCapacity(
      venue,
      booking.roomLayout,
      await attendance.expectedAttendance(booking.eventId),
    );
  }
}
