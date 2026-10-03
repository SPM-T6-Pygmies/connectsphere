import { venueId } from "@/core/domain/venue";
import type { BookedSlot } from "@/core/domain/venue-search";
import type { VenueAvailability } from "@/core/ports/outbound/venue-availability";

import { toTime } from "./booking-mapper";
import type { SupabaseServerClient } from "./client";

/** One slot as `public.venues_booked_on()` returns it. */
interface BookedSlotRow {
  venue_id: number;
  slot_date: string;
  start: string;
  end: string;
}

/**
 * Booked times from Postgres, through `venues_booked_on`, which reads the
 * `booking_slot` rows of live bookings -- the same slots a booking request
 * checks for a clash (supabase/migrations/20261003010000_venues_booked_on.sql).
 */
export class SupabaseVenueAvailability implements VenueAvailability {
  constructor(private readonly client: SupabaseServerClient) {}

  async bookedSlots(date: string): Promise<readonly BookedSlot[]> {
    const { data, error } = await this.client.rpc("venues_booked_on", {
      p_date: date,
    });
    if (error) {
      throw new Error(`Failed to read venue bookings: ${error.message}`, {
        cause: error,
      });
    }

    return (data as BookedSlotRow[]).map((row) => ({
      venueId: venueId(String(row.venue_id)),
      date: row.slot_date.slice(0, 10),
      start: toTime(row.start),
      end: toTime(row.end),
    }));
  }
}
