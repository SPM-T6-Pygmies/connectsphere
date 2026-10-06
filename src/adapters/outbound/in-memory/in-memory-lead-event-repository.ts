import type { CoordinatorEvent } from "@/core/domain/coordinator-event";
import type { LeadEvent } from "@/core/domain/coordinator-workload";
import { NotCoordinatorLeadError } from "@/core/domain/errors";
import type { EventId } from "@/core/domain/event";
import type { UserAccountId } from "@/core/domain/user-account";
import type { LeadEventRepository } from "@/core/ports/outbound/lead-event-repository";

/** One reassignment as the store records it: the audit trail's who, from and to (SPM-257 AC4). */
export interface RecordedReassignment {
  readonly eventId: EventId;
  readonly from: UserAccountId | null;
  readonly to: UserAccountId | null;
  readonly by: UserAccountId;
}

export class InMemoryLeadEventRepository implements LeadEventRepository {
  private readonly events: LeadEvent[];
  private readonly leads: ReadonlySet<UserAccountId>;
  readonly reassignments: RecordedReassignment[] = [];

  constructor(
    seed: {
      readonly events?: readonly LeadEvent[];
      /** The accounts holding the Event Coordinator Lead role. */
      readonly leads?: readonly UserAccountId[];
    } = {},
  ) {
    this.events = [...(seed.events ?? [])];
    this.leads = new Set(seed.leads ?? []);
  }

  async listAll(reader: UserAccountId): Promise<readonly CoordinatorEvent[]> {
    this.assertLead(reader);
    return [...this.events];
  }

  async findById(reader: UserAccountId, id: EventId): Promise<LeadEvent | null> {
    this.assertLead(reader);
    return this.events.find((event) => event.id === id) ?? null;
  }

  async reassignCoordinator(event: LeadEvent, reassignedBy: UserAccountId): Promise<void> {
    this.assertLead(reassignedBy);
    const index = this.events.findIndex((stored) => stored.id === event.id);
    this.reassignments.push({
      eventId: event.id,
      from: this.events[index].assignedCoordinatorUserAccountId,
      to: event.assignedCoordinatorUserAccountId,
      by: reassignedBy,
    });
    this.events[index] = event;
  }

  private assertLead(id: UserAccountId): void {
    if (!this.leads.has(id)) {
      throw new NotCoordinatorLeadError();
    }
  }
}
