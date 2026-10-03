import { chooseRoomLayout, type Booking } from "../domain/booking";
import { VenueNotFoundError } from "../domain/errors";
import { venueId } from "../domain/venue";
import type { BookingRepository } from "../ports/outbound/booking-repository";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";

export interface RequestVenueBookingCommand {
  readonly eventId: string;
  readonly venueId: string;
  /** Null when none was chosen -- refused, since a layout is required. */
  readonly roomLayout: string | null;
}

export interface RequestVenueBookingDeps {
  readonly venues: VenueCatalogue;
  readonly bookings: BookingRepository;
}

/**
 * SPM-104's slice of SPM-46: a booking request records which of the venue's
 * layouts it assumes. Slots, clash blocking and who may ask are SPM-46 (PR #75)
 * and are not here.
 *
 * Throws `VenueNotFoundError`, `RoomLayoutRequiredError` or
 * `UnsupportedRoomLayoutError`; nothing is stored then.
 */
export class RequestVenueBookingUseCase {
  constructor(private readonly deps: RequestVenueBookingDeps) {}

  async execute(command: RequestVenueBookingCommand): Promise<Booking> {
    const { venues, bookings } = this.deps;

    const venue = await venues.find(venueId(command.venueId));
    if (venue === null) {
      throw new VenueNotFoundError();
    }

    const roomLayout = chooseRoomLayout(venue, command.roomLayout);
    return bookings.add({ eventId: command.eventId, venueId: venue.id, roomLayout });
  }
}
