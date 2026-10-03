import { venueId } from "@/core/domain/venue";
import type { BusyInterval } from "@/core/domain/venue-search";
import type { VenueAvailability } from "@/core/ports/outbound/venue-availability";

import type { SupabaseServerClient } from "./client";

/** One interval as `public.venue_busy_intervals()` returns it. */
interface BusyIntervalRow {
  venue_id: number;
  starts_at: string;
  ends_at: string;
}

/**
 * Busy intervals from Postgres, through `venue_busy_intervals`, which derives a
 * booking's time from the event or session it books
 * (supabase/migrations/20261001000000_venue_busy_intervals.sql).
 */
export class SupabaseVenueAvailability implements VenueAvailability {
  constructor(private readonly client: SupabaseServerClient) {}

  async busyIntervals(from: Date, to: Date): Promise<readonly BusyInterval[]> {
    const { data, error } = await this.client.rpc("venue_busy_intervals", {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    });
    if (error) {
      throw new Error(`Failed to read venue bookings: ${error.message}`, { cause: error });
    }

    return (data as BusyIntervalRow[]).map((row) => ({
      venueId: venueId(String(row.venue_id)),
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at),
    }));
  }
}
