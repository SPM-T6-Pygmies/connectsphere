import type { EventId } from "@/core/domain/event";
import type { EquipmentLineState } from "@/core/domain/equipment-requirement";
import type { ArrangementType, FlaggedBookingFacts, ReadinessFacts } from "@/core/domain/event-readiness";
import type { UserAccountId } from "@/core/domain/user-account";
import type { EventReadinessRepository } from "@/core/ports/outbound/event-readiness-repository";

import type { SupabaseServerClient } from "./client";
import { toKey } from "./to-key";

/** The one row `event_readiness` returns. */
export interface EventReadinessRow {
  essential_types: ArrangementType[] | null;
  confirmed_venue_location: string | null;
  programme_agenda: string | null;
  registration_enabled: boolean | null;
  /** Postgres `date`: `YYYY-MM-DD`. */
  registration_open_date: string | null;
  registration_close_date: string | null;
  /** SPM-318: the event's essential equipment lines. */
  essential_equipment: EssentialEquipmentRow[] | null;
  /** SPM-312: the event's bookings with an open flag, one each. */
  flagged_bookings: FlaggedBookingRow[] | null;
}

interface EssentialEquipmentRow {
  equipment_type: string;
  line_state: EquipmentLineState;
  quantity_requested: number;
  quantity_reserved: number;
}

/** One element of `flagged_bookings`; `coordinator_confirm_event`'s CS094 DETAIL is an array of these. */
export interface FlaggedBookingRow {
  booking_id: number;
  venue_location: string;
  booked_for: string;
}

export function toFlaggedBookingFacts(row: FlaggedBookingRow): FlaggedBookingFacts {
  return { bookingId: String(row.booking_id), venueLocation: row.venue_location, bookedFor: row.booked_for };
}

export function toReadinessFacts(eventId: EventId, row: EventReadinessRow): ReadinessFacts {
  return {
    eventId,
    essentialTypes: row.essential_types ?? [],
    confirmedVenueLocation: row.confirmed_venue_location,
    programmeAgenda: row.programme_agenda,
    registrationEnabled: row.registration_enabled ?? false,
    registrationOpenDate: row.registration_open_date,
    registrationCloseDate: row.registration_close_date,
    essentialEquipment: (row.essential_equipment ?? []).map((line) => ({
      equipmentType: line.equipment_type,
      state: line.line_state,
      quantityRequested: line.quantity_requested,
      quantityReserved: line.quantity_reserved,
    })),
    flaggedBookings: (row.flagged_bookings ?? []).map(toFlaggedBookingFacts),
  };
}

/**
 * Reached through `event_readiness`, not the tables --
 * `event_essential_arrangement` has RLS enabled with no policies
 * (schema.sql), so a `security definer` function is the only way in. It
 * returns facts only; `assessReadiness` decides what they mean.
 */
export class SupabaseEventReadinessRepository implements EventReadinessRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async factsFor(coordinatorId: UserAccountId, eventId: EventId): Promise<ReadinessFacts | null> {
    const key = toKey(eventId);
    const coordinatorKey = toKey(coordinatorId);
    if (key === null || coordinatorKey === null) {
      return null;
    }

    const { data, error } = await this.client.rpc("event_readiness", {
      p_event_id: key,
      p_coordinator_user_account_id: coordinatorKey,
    });

    if (error) {
      throw new Error(`Failed to look up event readiness: ${error.message}`, { cause: error });
    }

    const [row] = (data ?? []) as unknown as EventReadinessRow[];
    return row === undefined ? null : toReadinessFacts(eventId, row);
  }
}
