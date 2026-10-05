import type { SlotOnDate } from "@/core/domain/booking";
import {
  UnavailabilityAlreadyLiftedError,
  VenueNotFoundError,
  VenueUnavailabilityNotFoundError,
  VenueUnavailabilityNotPermittedError,
} from "@/core/domain/errors";
import type { UserAccountId } from "@/core/domain/user-account";
import type { VenueId } from "@/core/domain/venue";
import type {
  UnavailabilityLift,
  VenueUnavailabilityBlock,
  VenueUnavailabilityEntry,
} from "@/core/domain/venue-unavailability";
import type {
  AffectedBooking,
  VenueUnavailabilityRepository,
} from "@/core/ports/outbound/venue-unavailability-repository";

import type { SupabaseServerClient } from "./client";
import { toKey } from "./coordinator-event-mapper";
import {
  toAffectedBooking,
  toRecordUnavailabilityArgs,
  toVenueUnavailabilityEntry,
  type AffectedBookingRow,
  type VenueUnavailabilityRow,
} from "./venue-unavailability-mapper";

// SQLSTATEs raised by the venue_staff_*_unavailability functions (see their migration).
const NOT_VENUE_STAFF = "CS036";
const NOT_FOUND = "CS037";
const ALREADY_LIFTED = "CS038";
const VENUE_NOT_FOUND = "CS039";

/**
 * Reached through `security definer` functions, not the tables: they have RLS
 * enabled with no policy. The functions answer only for an account holding the
 * Venue Staff role, and the triggers on the tables write the audit rows.
 */
export class SupabaseVenueUnavailabilityRepository implements VenueUnavailabilityRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async record(
    block: VenueUnavailabilityBlock,
    actor: UserAccountId,
  ): Promise<VenueUnavailabilityEntry> {
    const staff = toKey(actor);
    const venue = toKey(block.venueId);
    if (staff === null) {
      throw new VenueUnavailabilityNotPermittedError();
    }
    if (venue === null) {
      throw new VenueNotFoundError();
    }

    const { data, error } = await this.client.rpc(
      "venue_staff_record_unavailability",
      toRecordUnavailabilityArgs(block, staff, venue),
    );
    if (error) {
      throw translate(error, "record the block");
    }

    const stored = await this.find(actor, String(data));
    if (stored === null) {
      throw new Error("The block was recorded but could not be read back.");
    }
    return stored;
  }

  async list(reader: UserAccountId): Promise<readonly VenueUnavailabilityEntry[]> {
    return this.read(reader, null);
  }

  async find(reader: UserAccountId, id: string): Promise<VenueUnavailabilityEntry | null> {
    const key = toKey(id);
    if (key === null) {
      return null;
    }
    const [entry] = await this.read(reader, key);
    return entry ?? null;
  }

  /** The function locks the block, so losing a race reads as the block already lifted. */
  async lift(lift: UnavailabilityLift): Promise<void> {
    const staff = toKey(lift.liftedBy);
    const block = toKey(lift.id);
    if (staff === null) {
      throw new VenueUnavailabilityNotPermittedError();
    }
    if (block === null) {
      throw new VenueUnavailabilityNotFoundError();
    }

    const { error } = await this.client.rpc("venue_staff_lift_unavailability", {
      p_staff_user_account_id: staff,
      p_unavailability_id: block,
    });
    if (error) {
      throw translate(error, "lift the block");
    }
  }

  async affectedBookings(
    reader: UserAccountId,
    venue: VenueId,
    slots: readonly SlotOnDate[],
  ): Promise<readonly AffectedBooking[]> {
    const staff = toKey(reader);
    const venueKey = toKey(venue);
    if (staff === null || venueKey === null) {
      return [];
    }

    const { data, error } = await this.client.rpc("venue_staff_unavailability_affected", {
      p_staff_user_account_id: staff,
      p_venue_id: venueKey,
      p_slots: slots.map(({ date, slot }) => ({ date, slot })),
    });
    if (error) {
      throw new Error(`Failed to read the affected bookings: ${error.message}`, { cause: error });
    }
    return ((data ?? []) as unknown as AffectedBookingRow[]).map(toAffectedBooking);
  }

  private async read(
    reader: UserAccountId,
    blockKey: number | null,
  ): Promise<readonly VenueUnavailabilityEntry[]> {
    const staff = toKey(reader);
    if (staff === null) {
      return [];
    }

    const { data, error } = await this.client.rpc("venue_staff_unavailability", {
      p_staff_user_account_id: staff,
      ...(blockKey === null ? {} : { p_unavailability_id: blockKey }),
    });
    if (error) {
      throw new Error(`Failed to read venue unavailability: ${error.message}`, { cause: error });
    }
    return ((data ?? []) as unknown as VenueUnavailabilityRow[]).map(toVenueUnavailabilityEntry);
  }
}

/** The domain's own error for a SQLSTATE the functions raise; anything else is a failure. */
function translate(error: { code?: string; message: string }, doing: string): Error {
  switch (error.code) {
    case NOT_VENUE_STAFF:
      return new VenueUnavailabilityNotPermittedError();
    case NOT_FOUND:
      return new VenueUnavailabilityNotFoundError();
    case ALREADY_LIFTED:
      return new UnavailabilityAlreadyLiftedError();
    case VENUE_NOT_FOUND:
      return new VenueNotFoundError();
    default:
      return new Error(`Failed to ${doing}: ${error.message}`, { cause: error });
  }
}
