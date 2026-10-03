import type { EventId } from "@/core/domain/event";
import type { ArrangementType, ReadinessFacts } from "@/core/domain/event-readiness";
import type { EventReadinessRepository } from "@/core/ports/outbound/event-readiness-repository";

import type { SupabaseServerClient } from "./client";
import { toKey } from "./coordinator-event-mapper";

/** The one row `event_readiness` returns. */
export interface EventReadinessRow {
  essential_types: ArrangementType[] | null;
  confirmed_venue_location: string | null;
  programme_agenda: string | null;
  registration_enabled: boolean | null;
  /** Postgres `date`: `YYYY-MM-DD`. */
  registration_open_date: string | null;
  registration_close_date: string | null;
}

export function toReadinessFacts(eventId: EventId, row: EventReadinessRow | undefined): ReadinessFacts {
  return {
    eventId,
    essentialTypes: row?.essential_types ?? [],
    confirmedVenueLocation: row?.confirmed_venue_location ?? null,
    programmeAgenda: row?.programme_agenda ?? null,
    registrationEnabled: row?.registration_enabled ?? false,
    registrationOpenDate: row?.registration_open_date ?? null,
    registrationCloseDate: row?.registration_close_date ?? null,
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

  async factsFor(eventId: EventId): Promise<ReadinessFacts> {
    const key = toKey(eventId);
    if (key === null) {
      return toReadinessFacts(eventId, undefined);
    }

    const { data, error } = await this.client.rpc("event_readiness", { p_event_id: key });

    if (error) {
      throw new Error(`Failed to look up event readiness: ${error.message}`, { cause: error });
    }

    const [row] = (data ?? []) as unknown as EventReadinessRow[];
    return toReadinessFacts(eventId, row);
  }
}
