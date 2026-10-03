import type { EventId } from "@/core/domain/event";
import type { ReadinessFacts } from "@/core/domain/event-readiness";
import type { EventReadinessRepository } from "@/core/ports/outbound/event-readiness-repository";

export class InMemoryEventReadinessRepository implements EventReadinessRepository {
  private readonly rows: ReadonlyMap<string, ReadinessFacts>;

  constructor(seed: readonly ReadinessFacts[] = []) {
    this.rows = new Map(seed.map((facts) => [facts.eventId, facts]));
  }

  /** An unseeded event reads back with no essential arrangements -- vacuously ready, matching today's real behaviour (decision 1, SPM-144). */
  async factsFor(eventId: EventId): Promise<ReadinessFacts> {
    return (
      this.rows.get(eventId) ?? {
        eventId,
        essentialTypes: [],
        confirmedVenueLocation: null,
        programmeAgenda: null,
        registrationEnabled: false,
        registrationOpenDate: null,
        registrationCloseDate: null,
      }
    );
  }
}
