import type { Event, EventId } from "@/core/domain/event";
import type { EventCatalogue } from "@/core/ports/outbound/event-catalogue";

/**
 * A real implementation of the port that happens to store rows in a Map.
 *
 * Note what it does *not* do: it never asks `isOpenForRegistration`. It
 * narrows on status exactly as its Supabase twin does, so the use case's
 * filter is the thing under test rather than a rule the double enforces on its
 * behalf.
 */
export class InMemoryEventCatalogue implements EventCatalogue {
  private readonly rows = new Map<EventId, Event>();

  constructor(seed: readonly Event[] = []) {
    for (const event of seed) {
      this.rows.set(event.id, event);
    }
  }

  async listConfirmed(): Promise<Event[]> {
    return [...this.rows.values()].filter((event) => event.status === "confirmed");
  }

  async findEvent(id: EventId): Promise<Event | null> {
    return this.rows.get(id) ?? null;
  }
}
