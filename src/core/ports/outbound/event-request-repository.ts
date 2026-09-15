import type { ClientOrganisationId } from "../../domain/client-organisation";
import type {
  EventRequest,
  EventRequestId,
  EventRequestStatus,
  NewEventRequest,
} from "../../domain/event-request";
import type { UserAccountId } from "../../domain/user-account";

/**
 * One row of an Organiser's own "My event requests" list.
 *
 * The view the screen needs, as plain data: nothing in the domain decides
 * anything about this list, so no entity is built only to be copied into it
 * (ARCHITECTURE.md section 11, the thin read path).
 */
export interface MyEventRequestSummary {
  readonly id: string;
  readonly eventName: string;
  readonly status: EventRequestStatus;
  readonly preferredDate: string | null;
  readonly description: string | null;
  /** ISO 8601. Null for a request still in Draft -- it has never been submitted. */
  readonly submittedAt: string | null;
}

/** Read/write access to event requests, scoped the way the domain scopes them. */
export interface EventRequestRepository {
  /** Every request visible to Event Operations, without organisation or status filtering. */
  listAll(): Promise<readonly EventRequest[]>;
  listByClientOrganisation(clientOrganisationId: ClientOrganisationId): Promise<readonly EventRequest[]>;
  /** The requests `organiser` raised in `organisation`, newest first -- never a colleague's. */
  listRaisedBy(
    organiser: UserAccountId,
    organisation: ClientOrganisationId,
  ): Promise<readonly MyEventRequestSummary[]>;
  listByAssignedCoordinator(coordinatorId: UserAccountId): Promise<readonly EventRequest[]>;
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
  /** Persists an Event Coordinator assignment and any resulting status transition. */
  assignEventCoordinator(request: EventRequest): Promise<void>;
  /**
   * Persists an approval (SPM-34) made by `decidedBy`, the request's assigned
   * Event Coordinator. The same unit of work opens the request's event in
   * `Planning` and records who approved it, and when -- approval *is* the
   * event's creation, so a request is never Approved without one.
   */
  approveEventRequest(request: EventRequest, decidedBy: UserAccountId): Promise<void>;
  /** Persists a rejection (SPM-34) made by `decidedBy`, recording who rejected it and when. */
  rejectEventRequest(request: EventRequest, decidedBy: UserAccountId): Promise<void>;
}
