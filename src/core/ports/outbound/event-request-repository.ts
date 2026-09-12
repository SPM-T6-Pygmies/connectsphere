import type { ClientOrganisationId } from "../../domain/client-organisation";
import type {
  EventRequest,
  EventRequestId,
  NewEventRequest,
} from "../../domain/event-request";

/** Read/write access to event requests, scoped the way the domain scopes them. */
export interface EventRequestRepository {
  listByClientOrganisation(clientOrganisationId: ClientOrganisationId): Promise<readonly EventRequest[]>;
  findById(id: EventRequestId): Promise<EventRequest | null>;
  /** Stores a request the core has built and hands back the id the store chose. */
  create(request: NewEventRequest): Promise<EventRequest>;
  save(request: EventRequest): Promise<void>;
  delete(request: EventRequest): Promise<void>;
  /**
   * Persists a change of responsible Organiser (#61, #59).
   *
   * Deliberately not `save()`: that path is guarded to a request's own
   * responsible Organiser amending their still-`Draft` request (SPM-38).
   * Reassignment must cross both of those on purpose -- the request need not
   * be `Draft`, and the id on `request` is already the *incoming* Organiser,
   * not whoever currently owns the stored row.
   */
  reassignResponsibleOrganiser(request: EventRequest): Promise<void>;
}
