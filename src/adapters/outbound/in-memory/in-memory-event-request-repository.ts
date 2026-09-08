import type { ClientOrganisationId } from "@/core/domain/client-organisation";
import type { EventRequest, EventRequestId } from "@/core/domain/event-request";
import type { EventRequestRepository } from "@/core/ports/outbound/event-request-repository";

export class InMemoryEventRequestRepository implements EventRequestRepository {
  private readonly rows = new Map<EventRequestId, EventRequest>();

  constructor(seed: readonly EventRequest[] = []) {
    for (const request of seed) {
      this.rows.set(request.id, request);
    }
  }

  async listByClientOrganisation(
    clientOrganisationId: ClientOrganisationId,
  ): Promise<readonly EventRequest[]> {
    return [...this.rows.values()].filter(
      (request) => request.clientOrganisationId === clientOrganisationId,
    );
  }

  async findById(id: EventRequestId): Promise<EventRequest | null> {
    return this.rows.get(id) ?? null;
  }

  async save(request: EventRequest): Promise<void> {
    this.rows.set(request.id, request);
  }
}
