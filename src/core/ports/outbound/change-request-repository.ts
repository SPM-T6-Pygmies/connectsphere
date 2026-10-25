import type { ChangeRequestTarget, RequestedChange } from "../../domain/change-request";
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
 * Where an event's change requests are kept (SPM-52). Keyed by the event
 * request, because the Organiser only ever sees their event through it.
 *
 * Submit-only for now: deciding a request is SPM-100.
 */
export interface ChangeRequestRepository {
  /** The event opened from this request, or null when it has not been approved into one. */
  findTarget(eventRequestId: EventRequestId): Promise<ChangeRequestTarget | null>;
  /** Stores the request with every field Pending. */
  submit(changeRequest: NewChangeRequest): Promise<void>;
}
