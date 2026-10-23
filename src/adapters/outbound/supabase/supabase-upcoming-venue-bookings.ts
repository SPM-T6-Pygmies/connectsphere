import type { VenueId } from "@/core/domain/venue";
import type { UpcomingVenueBookings } from "@/core/ports/outbound/upcoming-venue-bookings";

import type { SupabaseServerClient } from "./client";
import { toKey } from "./coordinator-event-mapper";

/**
 * Whether a venue has a booking that has not yet ended, through `venue_has_upcoming_booking`.
 * The database judges it against its own clock, so `now` is not sent; the venue guard that
 * refuses the definition uses the same function, so the two cannot disagree.
 */
export class SupabaseUpcomingVenueBookings implements UpcomingVenueBookings {
  constructor(private readonly client: SupabaseServerClient) {}

  async hasUpcomingBooking(venue: VenueId): Promise<boolean> {
    const key = toKey(venue);
    if (key === null) {
      return false;
    }
    const { data, error } = await this.client.rpc("venue_has_upcoming_booking", { p_venue_id: key });
    if (error) {
      throw new Error(`Failed to check the venue's bookings: ${error.message}`, { cause: error });
    }
    return data === true;
  }
}
