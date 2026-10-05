import type { Event, EventId } from "@/core/domain/event";
import type { EventCatalogue } from "@/core/ports/outbound/event-catalogue";

import type { SupabaseServerClient } from "./client";
import {
  EVENT_COLUMNS,
  slotsByEvent,
  toDomain,
  toKey,
  type EventRow,
  type EventSlotRow,
} from "./event-mapper";

export class SupabaseEventCatalogue implements EventCatalogue {
  constructor(private readonly client: SupabaseServerClient) {}

  async listConfirmed(): Promise<Event[]> {
    // Status is the only business filter here: an Attendee must not see events
    // still being planned. Whether registration is *open* is the domain's
    // answer, so it is applied to what comes back rather than pushed into SQL.
    const { data, error } = await this.client
      .from("event")
      .select(EVENT_COLUMNS)
      .eq("status", "Confirmed");

    if (error) {
      throw new Error(`Failed to list events: ${error.message}`, { cause: error });
    }

    return this.withSlots((data ?? []) as unknown as EventRow[]);
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
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to look up event: ${error.message}`, { cause: error });
    }

    const [event] = await this.withSlots(data ? [data as unknown as EventRow] : []);
    return event ?? null;
  }

  /**
   * The events, each with its slots -- read through `confirmed_event_slots`,
   * since anon may not pass a whole `event` row to a computed field.
   *
   * An event with no slots is left out. That is not a business rule: the
   * schema lets an event exist before it is scheduled, and an event with no
   * slots is not something a domain `Event` can represent.
   */
  private async withSlots(rows: readonly EventRow[]): Promise<Event[]> {
    if (rows.length === 0) {
      return [];
    }

    const { data, error } = await this.client.rpc("confirmed_event_slots", {
      p_event_ids: rows.map((row) => row.event_id),
    });

    if (error) {
      throw new Error(`Failed to read event slots: ${error.message}`, { cause: error });
    }

    const slots = slotsByEvent((data ?? []) as unknown as EventSlotRow[]);
    return rows.flatMap((row) => {
      const eventSlots = slots.get(row.event_id);
      return eventSlots === undefined ? [] : [toDomain(row, eventSlots)];
    });
  }
}
