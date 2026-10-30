import type {
  ChangeRequest,
  ChangeRequestId,
  ChangeRequestItem,
  ChangeRequestTarget,
  RequestedChange,
} from "../../domain/change-request";
import type { EventId } from "../../domain/event";
import type { EventRequestId } from "../../domain/event-request";
import type { UserAccountId } from "../../domain/user-account";

/** A change request the core has checked, ready to store. */
export interface NewChangeRequest {
  /** The request the event was opened from, which is how the Organiser reaches it. */
  readonly eventRequestId: EventRequestId;
  readonly requestedBy: UserAccountId;
  readonly changes: readonly RequestedChange[];
}

/**
 * Where an event's change requests are kept. The Organiser submits through the
 * event request, the only way they see their event (SPM-52); the assigned
 * Coordinator reads and decides them on the event itself (SPM-100).
 */
export interface ChangeRequestRepository {
  /** The event opened from this request, or null when it has not been approved into one. */
  findTarget(eventRequestId: EventRequestId): Promise<ChangeRequestTarget | null>;
  /** Stores the request with every field Pending. */
  submit(changeRequest: NewChangeRequest): Promise<void>;
  /** Every request on the event, newest first; empty unless the event is assigned to this Coordinator. */
  listForEvent(coordinatorId: UserAccountId, eventId: EventId): Promise<readonly ChangeRequest[]>;
  /**
   * Stores the decided items and applies the accepted values to the event, in
   * one transaction. The caller has already decided them; this re-checks the
   * assignment, the event's status and that the request is still Pending.
   */
  decide(coordinatorId: UserAccountId, id: ChangeRequestId, items: readonly ChangeRequestItem[]): Promise<void>;
}
