import type { ClientOrganisationId } from "../../domain/client-organisation";
import type {
  EventRequest,
  EventRequestId,
  NewEventRequest,
} from "../../domain/event-request";

/** Read/write access to event requests, scoped the way the domain scopes them. */
export interface EventRequestRepository {
  /** Every request visible to Event Operations, without organisation or status filtering. */
  listAll(): Promise<readonly EventRequest[]>;
  listByClientOrganisation(clientOrganisationId: ClientOrganisationId): Promise<readonly EventRequest[]>;
  findById(id: EventRequestId): Promise<EventRequest | null>;
  /** Stores a request the core has built and hands back the id the store chose. */
  create(request: NewEventRequest): Promise<EventRequest>;
  save(request: EventRequest): Promise<void>;
  delete(request: EventRequest): Promise<void>;
}
