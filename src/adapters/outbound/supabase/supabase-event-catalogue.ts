import type { Event, EventId } from "@/core/domain/event";
import type { EventCatalogue } from "@/core/ports/outbound/event-catalogue";

import type { SupabaseServerClient } from "./client";
import { EVENT_COLUMNS, toDomain, type EventRow } from "./event-mapper";

/**
 * The domain's `EventId` is an opaque string, which is what keeps the core from
 * knowing that this store numbers its rows. Turning it back into a key is this
 * adapter's job, and an id that was never one of ours is simply not found --
 * a hand-typed URL is a miss, not a failure.
 */
function toKey(id: EventId): number | null {
  return /^\d+$/.test(id) ? Number(id) : null;
}

export class SupabaseEventCatalogue implements EventCatalogue {
  constructor(private readonly client: SupabaseServerClient) {}

  async listConfirmed(): Promise<Event[]> {
    // Status is the only business filter here: an Attendee must not see events
    // still being planned. Whether registration is *open* is the domain's
    // answer, so it is applied to what comes back rather than pushed into SQL.
    //
    // The two null checks are not a business rule. The team's schema lets an
    // event exist before it has been scheduled, and an event with no start is
    // not something a domain `Event` can represent -- so it is excluded here
    // rather than crashing the mapper.
    const { data, error } = await this.client
      .from("event")
      .select(EVENT_COLUMNS)
      .eq("status", "Confirmed")
      .not("start_time", "is", null)
      .not("end_time", "is", null)
      .order("start_time");

    if (error) {
      throw new Error(`Failed to list events: ${error.message}`, { cause: error });
    }

    return ((data ?? []) as unknown as EventRow[]).map(toDomain);
  }

  async findEvent(id: EventId): Promise<Event | null> {
    const key = toKey(id);
    if (key === null) {
      return null;
    }

    const { data, error } = await this.client
      .from("event")
      .select(EVENT_COLUMNS)
      .eq("event_id", key)
      .not("start_time", "is", null)
      .not("end_time", "is", null)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to look up event: ${error.message}`, { cause: error });
    }

    return data ? toDomain(data as unknown as EventRow) : null;
  }
}
