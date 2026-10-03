import type { EventId } from "@/core/domain/event";
import type { ReadinessFacts } from "@/core/domain/event-readiness";
import type { UserAccountId } from "@/core/domain/user-account";
import type { EventReadinessRepository } from "@/core/ports/outbound/event-readiness-repository";

export class InMemoryEventReadinessRepository implements EventReadinessRepository {
  private readonly rows: ReadonlyMap<string, ReadinessFacts>;

  /** `assigned` maps each event id to its coordinator, standing in for the store's own assignment. */
  constructor(
    seed: readonly ReadinessFacts[] = [],
    private readonly assigned: ReadonlyMap<string, string> = new Map(),
  ) {
    this.rows = new Map(seed.map((facts) => [facts.eventId, facts]));
  }

  /** An unseeded but assigned event reads back with no essential arrangements -- vacuously ready, matching today's real behaviour (decision 1, SPM-144). */
  async factsFor(coordinatorId: UserAccountId, eventId: EventId): Promise<ReadinessFacts | null> {
    if (this.assigned.get(eventId) !== coordinatorId) {
      return null;
    }
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
