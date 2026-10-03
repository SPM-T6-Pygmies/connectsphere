import type { EventId } from "@/core/domain/event";
import type { EventReadiness } from "@/core/domain/event-readiness";
import type { EventReadinessRepository } from "@/core/ports/outbound/event-readiness-repository";

export class InMemoryEventReadinessRepository implements EventReadinessRepository {
  private readonly rows: ReadonlyMap<string, EventReadiness>;

  constructor(seed: readonly EventReadiness[] = []) {
    this.rows = new Map(seed.map((readiness) => [readiness.eventId, readiness]));
  }

  /** An unseeded event reads back with no essential arrangements -- vacuously ready, matching today's real behaviour (decision 1, SPM-144). */
  async readinessFor(eventId: EventId): Promise<EventReadiness> {
    return this.rows.get(eventId) ?? { eventId, essentialArrangements: [] };
  }
}
