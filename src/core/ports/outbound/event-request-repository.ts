import type { ClientOrganisationId } from "../../domain/client-organisation";
import type {
  EventRequest,
  EventRequestId,
  NewEventRequest,
} from "../../domain/event-request";
import type { UserAccountId } from "../../domain/user-account";

/** Read/write access to event requests, scoped the way the domain scopes them. */
export interface EventRequestRepository {
  listByClientOrganisation(clientOrganisationId: ClientOrganisationId): Promise<readonly EventRequest[]>;
  listByAssignedCoordinator(coordinatorId: UserAccountId): Promise<readonly EventRequest[]>;
  findById(id: EventRequestId): Promise<EventRequest | null>;
  /** Stores a request the core has built and hands back the id the store chose. */
  create(request: NewEventRequest): Promise<EventRequest>;
  save(request: EventRequest): Promise<void>;
  delete(request: EventRequest): Promise<void>;
}
