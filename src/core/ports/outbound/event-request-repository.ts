import type { ClientOrganisationId } from "../../domain/client-organisation";
import type { EventRequest, EventRequestId } from "../../domain/event-request";

/** Read/write access to event requests, scoped the way the domain scopes them. */
export interface EventRequestRepository {
  listByClientOrganisation(clientOrganisationId: ClientOrganisationId): Promise<readonly EventRequest[]>;
  findById(id: EventRequestId): Promise<EventRequest | null>;
  save(request: EventRequest): Promise<void>;
}
