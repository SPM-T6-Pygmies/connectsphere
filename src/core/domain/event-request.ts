import type { Brand } from "./brand";
import type { ClientOrganisationId } from "./client-organisation";
import { IncompleteEventRequestError, InvalidEventRequestIdError } from "./errors";
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
 * What the Event Organiser actually fills in, one member per column of
 * `event_request` in `supabase/schema.sql`.
 *
 * `preferredDate` and `preferredTime` are strings, not instants, on purpose:
 * the customer books venues in AM/PM/Night slots (#50) and the organiser is
 * stating a calendar preference, not an instant. Turning "the 4th" into a
 * moment needs a timezone the domain has no business holding an opinion
 * about -- the adapter that stores it does.
 *
 * `categoryType` is deliberately absent: the brief lists it under Event, not
 * Event Request, and `event_request` has no column for it. Adding it is a
 * schema change, not a form change.
 */
export interface EventRequestDetails {
  readonly eventName: string;
  readonly description: string | null;
  readonly purpose: string | null;
  /** ISO calendar date, `YYYY-MM-DD`. */
  readonly preferredDate: string | null;
  /** Free text, as the column is -- "09:00 - 17:00", "all day", "TBC". */
  readonly preferredTime: string | null;
  readonly expectedAttendance: number | null;
  readonly venueRequirements: string | null;
  readonly roomLayoutPreferences: string | null;
  readonly accessibilityNeeds: string | null;
  readonly equipmentRequirements: string | null;
  readonly registrationRequirements: string | null;
  readonly generalProgramme: string | null;
  readonly otherSpecialArrangements: string | null;
}

/**
 * An event request as its responsible Event Organiser, and colleagues in the
 * same client organisation, are allowed to see it.
 */
export interface EventRequest {
  readonly id: EventRequestId;
  readonly details: EventRequestDetails;
  readonly status: EventRequestStatus;
  readonly clientOrganisationId: ClientOrganisationId;
  readonly responsibleOrganiserId: UserAccountId;
  /** Null until the request leaves Draft. */
  readonly submittedAt: Date | null;
}

/**
 * A request that has not been stored yet, and so has no id.
 *
 * `event_request_id` is `generated always as identity`, so the store chooses
 * the id and hands it back -- the core cannot mint one, and pretending
 * otherwise (a `nextId()` on the port) would be a lie the Supabase adapter
 * could not honour.
 */
export type NewEventRequest = Omit<EventRequest, "id">;

/** A request that has just been submitted, so its `submittedAt` is never null. */
export type SubmittedEventRequest = NewEventRequest & { readonly submittedAt: Date };

export function eventRequestId(raw: string): EventRequestId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvalidEventRequestIdError(raw);
  }
  return trimmed as EventRequestId;
}

/**
 * Mandatory Fields are not set by the customer yet, to be refined later. These
 * fields are placeholders for now (9 Sep 2026).
 *
 * Single home for that answer: the submit rule, the form's required markers
 * and its submit gate all read this array, so settling #72 is a change here
 * and nowhere else.
 */
export const MANDATORY_SUBMISSION_FIELDS = [
  "eventName",
  "preferredDate",
  "preferredTime",
  "expectedAttendance",
] as const satisfies ReadonlyArray<keyof EventRequestDetails>;

export type MandatoryEventRequestField = (typeof MANDATORY_SUBMISSION_FIELDS)[number];

function isBlank(value: EventRequestDetails[keyof EventRequestDetails]): boolean {
  if (value === null) {
    return true;
  }
  return typeof value === "string" && value.trim().length === 0;
}

/**
 * Which mandatory fields this request cannot be submitted without.
 *
 * Returns them all rather than the first, so the Organiser is told everything
 * that is missing in one pass instead of one field per round trip.
 */
export function missingMandatoryFields(
  details: EventRequestDetails,
): readonly MandatoryEventRequestField[] {
  return MANDATORY_SUBMISSION_FIELDS.filter((field) => isBlank(details[field]));
}

export function isSubmittable(details: EventRequestDetails): boolean {
  return missingMandatoryFields(details).length === 0;
}

/**
 * The only way to build a Submitted request.
 *
 * Because completeness is enforced here rather than in the caller, an
 * incomplete request is unrepresentable: the Server Action gets the rule, and
 * so will the draft-submit path (SPM-38) and any bulk importer, without any of
 * them restating it.
 */
export function submitEventRequest(params: {
  details: EventRequestDetails;
  clientOrganisationId: ClientOrganisationId;
  responsibleOrganiserId: UserAccountId;
  submittedAt: Date;
}): SubmittedEventRequest {
  const missing = missingMandatoryFields(params.details);
  if (missing.length > 0) {
    throw new IncompleteEventRequestError(missing);
  }

  return { ...params, status: "Submitted" };
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
