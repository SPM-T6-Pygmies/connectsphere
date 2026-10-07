import type { CoordinatorEvent } from "@/core/domain/coordinator-event";
import { NotCoordinatorLeadError } from "@/core/domain/errors";
import type { UserAccountId } from "@/core/domain/user-account";
import type { LeadEventRepository } from "@/core/ports/outbound/lead-event-repository";

export class InMemoryLeadEventRepository implements LeadEventRepository {
  private readonly events: CoordinatorEvent[];
  private readonly leads: ReadonlySet<UserAccountId>;

  constructor(
    seed: {
      readonly events?: readonly CoordinatorEvent[];
      /** The accounts holding the Event Coordinator Lead role. */
      readonly leads?: readonly UserAccountId[];
    } = {},
  ) {
    this.events = [...(seed.events ?? [])];
    this.leads = new Set(seed.leads ?? []);
  }

  async listAll(reader: UserAccountId): Promise<readonly CoordinatorEvent[]> {
    if (!this.leads.has(reader)) {
      throw new NotCoordinatorLeadError();
    }
    return [...this.events];
  }
}
