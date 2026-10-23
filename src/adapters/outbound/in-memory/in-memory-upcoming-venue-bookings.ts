import type { BookingStatus } from "@/core/domain/booking";
import type { VenueId } from "@/core/domain/venue";
import { isUpcomingBooking } from "@/core/domain/venue-buffers";
import type { UpcomingVenueBookings } from "@/core/ports/outbound/upcoming-venue-bookings";

/** A booking the adapter knows of: where it is, its state and when it ends. */
export interface KnownVenueBooking {
  readonly venueId: VenueId;
  readonly status: BookingStatus;
  readonly endsAt: Date;
  readonly holdExpiresAt?: Date | null;
}

/** A list-backed store that obeys the same contract as the Supabase one. */
export class InMemoryUpcomingVenueBookings implements UpcomingVenueBookings {
  constructor(private readonly bookings: readonly KnownVenueBooking[] = []) {}

  async hasUpcomingBooking(venue: VenueId, now: Date): Promise<boolean> {
    return this.bookings.some(
      (booking) =>
        booking.venueId === venue &&
        isUpcomingBooking({ ...booking, holdExpiresAt: booking.holdExpiresAt ?? null }, now),
    );
  }
}
