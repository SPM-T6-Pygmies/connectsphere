import type { ClientOrganisationId } from "@/core/domain/client-organisation";
import {
  eventRequestId,
  type EventRequest,
  type EventRequestId,
  type NewEventRequest,
} from "@/core/domain/event-request";
import type { EventRequestRepository } from "@/core/ports/outbound/event-request-repository";

export class InMemoryEventRequestRepository implements EventRequestRepository {
  private readonly rows = new Map<EventRequestId, EventRequest>();
  private sequence = 0;

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

  /** Assigns the id the way the real store does -- the caller does not choose it. */
  async create(request: NewEventRequest): Promise<EventRequest> {
    this.sequence += 1;
    const stored: EventRequest = { ...request, id: eventRequestId(`request-${this.sequence}`) };
    this.rows.set(stored.id, stored);
    return stored;
  }

  async save(request: EventRequest): Promise<void> {
    this.rows.set(request.id, request);
  }

  /** Test-only window on what was stored, so a test can assert nothing was written. */
  all(): readonly EventRequest[] {
    return [...this.rows.values()];
  }
}
