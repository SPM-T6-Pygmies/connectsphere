import type { Venue, VenueId } from "@/core/domain/venue";
import type { VenueOption, VenueRepository } from "@/core/ports/outbound/venue-repository";

import type { SupabaseServerClient } from "./client";
import { toKey, toVenue, toVenueOptions, type VenueBookingRow } from "./venue-mapper";

/**
 * Venues are reached through `venues_for_booking`/`venue`, not the table --
 * `venue`, `room_layout` and `venue_supported_layout` are RLS-enabled with no
 * policy, so `anon` has no grant on any of them.
 */
export class SupabaseVenueRepository implements VenueRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async listForBooking(): Promise<readonly VenueOption[]> {
    const { data, error } = await this.client.rpc("venues_for_booking");

    if (error) {
      throw new Error(`Failed to list venues: ${error.message}`, { cause: error });
    }

    const rows = (data ?? []) as unknown as VenueBookingRow[];
    return toVenueOptions(rows);
  }

  async findById(id: VenueId): Promise<Venue | null> {
    const key = toKey(id);
    if (key === null) {
      return null;
    }

    const { data, error } = await this.client.rpc("venue", { p_venue_id: key });

    if (error) {
      throw new Error(`Failed to look up venue: ${error.message}`, { cause: error });
    }

    const rows = (data ?? []) as unknown as VenueBookingRow[];
    return toVenue(rows);
  }
}
