import type { Booking, BookingId } from "../../domain/booking";
import type { VenueId } from "../../domain/venue";

/** What a booking needs to be raised; the store assigns its id and status. */
export interface NewBooking {
  readonly eventId: string;
  readonly venueId: VenueId;
  readonly roomLayout: string;
}

/**
 * Driven port: venue bookings, as far as SPM-104 needs them. Stands in for the
 * fuller booking store SPM-46 (PR #75) brings.
 */
export interface BookingRepository {
  /** Stores the booking as 'Requested' and returns it as stored. */
  add(booking: NewBooking): Promise<Booking>;

  /** Null when there is no such booking. */
  find(id: BookingId): Promise<Booking | null>;

  /** Replaces the layout and returns the booking as stored. Throws `BookingNotFoundError`. */
  changeRoomLayout(id: BookingId, roomLayout: string): Promise<Booking>;
}
