import type { Event, EventId } from "@/core/domain/event";
import type { EventCatalogue } from "@/core/ports/outbound/event-catalogue";

import type { SupabaseServerClient } from "./client";
import { EVENT_COLUMNS, toDomain, type EventRow } from "./event-mapper";

export class SupabaseEventCatalogue implements EventCatalogue {
  constructor(private readonly client: SupabaseServerClient) {}

  async listConfirmed(): Promise<Event[]> {
    // Status is the only filter here: an Attendee must not see events still
    // being planned. Whether registration is *open* is the domain's answer, so
    // it is applied to what comes back rather than pushed into SQL.
    const { data, error } = await this.client
      .from("events")
      .select(EVENT_COLUMNS)
      .eq("status", "confirmed")
      .order("starts_at");

    if (error) {
      throw new Error(`Failed to list events: ${error.message}`, { cause: error });
    }

    return ((data ?? []) as unknown as EventRow[]).map(toDomain);
  }

  async findEvent(id: EventId): Promise<Event | null> {
    const { data, error } = await this.client
      .from("events")
      .select(EVENT_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to look up event: ${error.message}`, { cause: error });
    }

    return data ? toDomain(data as unknown as EventRow) : null;
  }
}
