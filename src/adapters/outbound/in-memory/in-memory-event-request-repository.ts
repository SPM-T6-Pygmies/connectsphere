import type { ClientOrganisationId } from "@/core/domain/client-organisation";
import {
  eventRequestId,
  type EventRequest,
  type EventRequestId,
  type NewEventRequest,
} from "@/core/domain/event-request";
import type { UserAccountId } from "@/core/domain/user-account";
import type {
  EventRequestRepository,
  MyEventRequestSummary,
} from "@/core/ports/outbound/event-request-repository";

export class InMemoryEventRequestRepository implements EventRequestRepository {
  private readonly rows = new Map<EventRequestId, EventRequest>();
  private sequence = 0;

  constructor(seed: readonly EventRequest[] = []) {
    for (const request of seed) {
      this.rows.set(request.id, request);
    }
  }

  async listAll(): Promise<readonly EventRequest[]> {
    return [...this.rows.values()];
  }

  async listByClientOrganisation(
    clientOrganisationId: ClientOrganisationId,
  ): Promise<readonly EventRequest[]> {
    return [...this.rows.values()].filter(
      (request) => request.clientOrganisationId === clientOrganisationId,
    );
  }

  async listRaisedBy(
    organiser: UserAccountId,
    organisation: ClientOrganisationId,
  ): Promise<readonly MyEventRequestSummary[]> {
    return [...this.rows.values()]
      .filter(
        (request) =>
          request.clientOrganisationId === organisation &&
          request.responsibleOrganiserId === organiser,
      )
      .map((request) => ({
        id: request.id,
        eventName: request.details.eventName,
        status: request.status,
        preferredDate: request.details.preferredDate,
        description: request.details.description,
        submittedAt: request.submittedAt?.toISOString() ?? null,
      }));
  }

  async listByAssignedCoordinator(coordinatorId: UserAccountId): Promise<readonly EventRequest[]> {
    return [...this.rows.values()].filter(
      (request) => request.assignedCoordinatorUserAccountId === coordinatorId,
    );
  }

  async findById(id: EventRequestId): Promise<EventRequest | null> {
    return this.rows.get(id) ?? null;
  }

  /** Assigns the id the way the real store does -- the caller does not choose it. */
  async create(request: NewEventRequest): Promise<EventRequest> {
    this.sequence += 1;
    const storedAt = request.submittedAt ?? new Date(0);
    const stored: EventRequest = {
      ...request,
      id: eventRequestId(`request-${this.sequence}`),
      assignedCoordinatorUserAccountId: null,
      decisionRecord: null,
      createdAt: storedAt,
      updatedAt: storedAt,
    };
    this.rows.set(stored.id, stored);
    return stored;
  }

  async save(request: EventRequest): Promise<void> {
    this.rows.set(request.id, request);
  }

  async delete(request: EventRequest): Promise<void> {
    this.rows.delete(request.id);
  }

  async reassignResponsibleOrganiser(request: EventRequest): Promise<void> {
    this.rows.set(request.id, request);
  }

  async assignEventCoordinator(request: EventRequest): Promise<void> {
    this.rows.set(request.id, request);
  }

  /** Stores the approved request. The event it opens, and the audit record, are not modelled in memory. */
  async approveEventRequest(request: EventRequest): Promise<void> {
    this.rows.set(request.id, request);
  }

  async rejectEventRequest(request: EventRequest): Promise<void> {
    this.rows.set(request.id, request);
  }

  /** Stores the withdrawn request. The audit record is not modelled in memory. */
  async withdrawEventRequest(request: EventRequest): Promise<void> {
    this.rows.set(request.id, request);
  }

  /** Test-only window on what was stored, so a test can assert nothing was written. */
  all(): readonly EventRequest[] {
    return [...this.rows.values()];
  }
}
