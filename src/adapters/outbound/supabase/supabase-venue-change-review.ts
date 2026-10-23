import { VenueMaintenanceNotPermittedError } from "@/core/domain/errors";
import type { VenueChangeBooking, VenueChangeFlag } from "@/core/domain/venue-change-flag";
import type { VenueId } from "@/core/domain/venue";
import type { VenueChangeReview } from "@/core/ports/outbound/venue-change-review";

import type { SupabaseServerClient } from "./client";
import { toVenueChangeBooking, toVenueChangeFlagArgument, type VenueChangeBookingRow } from "./venue-change-mapper";

// Raised by venue_catalogue_require_staff, which both functions call.
const NOT_PERMITTED = "CS020";

/**
 * Reached through `venue_change_bookings` and `venue_change_flag_bookings`, `security
 * definer` functions that answer only Venue Staff: the flag table has RLS enabled with no policy.
 */
export class SupabaseVenueChangeReview implements VenueChangeReview {
  constructor(private readonly client: SupabaseServerClient) {}

  async bookingsAt(venueId: VenueId): Promise<readonly VenueChangeBooking[]> {
    const { data, error } = await this.client.rpc("venue_change_bookings", { p_venue_id: Number(venueId) });
    if (error) throw translate(error, "read the venue's bookings");

    return ((data ?? []) as unknown as VenueChangeBookingRow[]).map(toVenueChangeBooking);
  }

  async flag(venueId: VenueId, flags: readonly VenueChangeFlag[]): Promise<void> {
    const { error } = await this.client.rpc("venue_change_flag_bookings", {
      p_venue_id: Number(venueId),
      p_flags: flags.map(toVenueChangeFlagArgument),
    });
    if (error) throw translate(error, "flag the venue's bookings");
  }
}

function translate(error: { code?: string; message: string }, action: string): Error {
  if (error.code === NOT_PERMITTED) return new VenueMaintenanceNotPermittedError();
  return new Error(`Failed to ${action}: ${error.message}`, { cause: error });
}
