import type { EventId } from "@/core/domain/event";
import type { ArrangementType, EventReadiness } from "@/core/domain/event-readiness";
import type { EventReadinessRepository } from "@/core/ports/outbound/event-readiness-repository";

import type { SupabaseServerClient } from "./client";
import { toKey } from "./coordinator-event-mapper";

interface EventReadinessRow {
  arrangement_type: ArrangementType;
  is_complete: boolean;
  detail: string;
}

/**
 * Reached through `event_readiness`, not the table -- `event_essential_arrangement`
 * has RLS enabled with no policies (schema.sql), so a `security definer`
 * function is the only way in. Only computes venue/programme/registration
 * (decision 2, SPM-50 plan): equipment/technical_support/other never appear
 * in the returned rows, so they can never block or pass confirmation here.
 */
export class SupabaseEventReadinessRepository implements EventReadinessRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async readinessFor(eventId: EventId): Promise<EventReadiness> {
    const key = toKey(eventId);
    if (key === null) {
      return { eventId, essentialArrangements: [] };
    }

    const { data, error } = await this.client.rpc("event_readiness", { p_event_id: key });

    if (error) {
      throw new Error(`Failed to look up event readiness: ${error.message}`, { cause: error });
    }

    const rows = (data ?? []) as unknown as EventReadinessRow[];
    return {
      eventId,
      essentialArrangements: rows.map((row) => ({
        type: row.arrangement_type,
        complete: row.is_complete,
        detail: row.detail,
      })),
    };
  }
}
