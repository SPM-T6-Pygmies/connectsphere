import type { VenueId } from "@/core/domain/booking";
import type {
  BookableVenueSummary,
  VenueCatalogue,
} from "@/core/ports/outbound/venue-catalogue";

import { toBookableVenueSummary, type BookableVenueRow } from "./booking-mapper";
import type { SupabaseServerClient } from "./client";
import { toKey } from "./coordinator-event-mapper";

/**
 * Through `bookable_venues`, not the tables: `venue`, `room_layout` and
 * `venue_supported_layout` have RLS enabled with no policies.
 */
export class SupabaseVenueCatalogue implements VenueCatalogue {
  constructor(private readonly client: SupabaseServerClient) {}

  async listBookable(): Promise<readonly BookableVenueSummary[]> {
    return this.read(null);
  }

  async findBookable(id: VenueId): Promise<BookableVenueSummary | null> {
    const key = toKey(id);
    if (key === null) {
      return null;
    }
    return (await this.read(key))[0] ?? null;
  }

  private async read(key: number | null): Promise<BookableVenueSummary[]> {
    const { data, error } = await this.client.rpc(
      "bookable_venues",
      key === null ? {} : { p_venue_id: key },
    );
    if (error) {
      throw new Error(`Failed to read the venue catalogue: ${error.message}`, { cause: error });
    }
    return ((data ?? []) as unknown as BookableVenueRow[]).map(toBookableVenueSummary);
  }
}
