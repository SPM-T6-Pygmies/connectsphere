import type { Brand } from "./brand";
import type { ClientOrganisationId } from "./client-organisation";
import { InvalidEventRequestIdError } from "./errors";
import type { UserAccountId } from "./user-account";

export type EventRequestId = Brand<string, "EventRequestId">;

/**
 * Mirrors the team's `event_request_status_chk` (`supabase/schema.sql`), one
 * member per allowed value. Widen both together.
 */
export type EventRequestStatus =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Returned"
  | "Withdrawn";

/**
 * An event request as its responsible Event Organiser, and colleagues in the
 * same client organisation, are allowed to see it.
 */
export interface EventRequest {
  readonly id: EventRequestId;
  readonly eventName: string;
  readonly status: EventRequestStatus;
  readonly clientOrganisationId: ClientOrganisationId;
  readonly responsibleOrganiserId: UserAccountId;
}

export function eventRequestId(raw: string): EventRequestId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvalidEventRequestIdError(raw);
  }
  return trimmed as EventRequestId;
}

export interface OrganiserContext {
  readonly userAccountId: UserAccountId;
  readonly clientOrganisationId: ClientOrganisationId;
}

export type EventRequestAccess = "none" | "view" | "edit";

/**
 * The single answer to "what may this Event Organiser do with this request?"
 *
 * SPM-39, reconciling #81 with #102's later narrowing: view is automatic and
 * organisation-wide with no stage qualifier, but edit is granted only to the
 * responsible Organiser, and only while the request is still `Draft` --
 * after submission, changes route through the Event Coordinator instead
 * (#102, #61). An unrelated client organisation gets neither (#81's hard
 * boundary) -- callers should turn `"none"` into a not-found, not a
 * forbidden, so a cross-org guess can't confirm a request even exists (#91).
 *
 * Deliberately does not special-case `Returned`: the wiki records this as an
 * open, unconfirmed team decision (the state's documented resubmission exit
 * is otherwise unreachable) rather than a settled rule, so this predicate
 * does not invent an answer for it.
 */
export function eventRequestAccessFor(
  request: EventRequest,
  organiser: OrganiserContext,
): EventRequestAccess {
  if (request.clientOrganisationId !== organiser.clientOrganisationId) {
    return "none";
  }

  const isResponsible = request.responsibleOrganiserId === organiser.userAccountId;
  if (isResponsible && request.status === "Draft") {
    return "edit";
  }

  return "view";
}

/**
 * The one place responsibility for a request can change hands (#61, #59).
 *
 * Delegation does not exist -- there is always exactly one responsible
 * Organiser, never zero, never two -- so reassignment replaces the id rather
 * than adding to a set.
 */
export function reassignResponsibleOrganiser(
  request: EventRequest,
  newOrganiserId: UserAccountId,
): EventRequest {
  return { ...request, responsibleOrganiserId: newOrganiserId };
}
