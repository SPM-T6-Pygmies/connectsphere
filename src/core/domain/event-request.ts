import type { Brand } from "./brand";
import type { ClientOrganisationId } from "./client-organisation";
import {
  DecisionReasonRequiredError,
  EventRequestNotAssignableError,
  EventRequestNotDecidableError,
  EventRequestNotWithdrawableError,
  IncompleteEventRequestError,
  InvalidEventRequestIdError,
  PreferredDateNotInFutureError,
  PreferredEndTimeNotAfterStartError,
} from "./errors";
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
 * `preferredDate` is a string, not an instant, on purpose: the organiser is
 * stating a calendar preference, and a bare calendar date has no timezone to
 * hold an opinion about. `preferredStartTime`/`preferredEndTime` are also
 * strings crossing this boundary (never `Date` -- see
 * `SubmitEventRequestCommand`), even though the underlying columns are
 * `timestamptz`: parsing them into instants is deferred to the two places
 * that actually need to compare them, in `submitEventRequest` below, rather
 * than baked into the shape everywhere else in the domain reads it.
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
  /** ISO 8601 datetime string (the column is `timestamptz`). */
  readonly preferredStartTime: string | null;
  /**
   * ISO 8601 datetime string (the column is `timestamptz`). Must be after
   * `preferredStartTime` -- see `submitEventRequest`.
   */
  readonly preferredEndTime: string | null;
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
 * An event request as its responsible Event Organiser, colleagues in the same
 * client organisation, and (once assigned) its Event Coordinator are allowed
 * to see it.
 */
export interface EventRequest {
  readonly id: EventRequestId;
  readonly details: EventRequestDetails;
  readonly status: EventRequestStatus;
  readonly clientOrganisationId: ClientOrganisationId;
  readonly responsibleOrganiserId: UserAccountId;
  /**
   * Null until the Event Operations Manager assigns a coordinator (SPM-97),
   * which is also what moves a Submitted request to `Under Review` -- see
   * `assignEventCoordinator`. Frozen once the request is `Approved`
   * (schema.sql).
   */
  readonly assignedCoordinatorUserAccountId: UserAccountId | null;
  readonly decisionRecord: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
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
export type NewEventRequest = Omit<
  EventRequest,
  | "id"
  | "assignedCoordinatorUserAccountId"
  | "decisionRecord"
  | "createdAt"
  | "updatedAt"
>;

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
 * Mandatory Fields are not set by the customer yet, to be refined later. These fields are placeholders for now (9 Sep 2026).
 */
export const MANDATORY_SUBMISSION_FIELDS = [
  "eventName",
  "preferredDate",
  "preferredStartTime",
  "preferredEndTime",
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
 * `now`'s calendar date in the Organiser's own timezone, not the server's --
 * "later than today" means the Organiser's today, and comparing against the
 * server's (or UTC's) would wrongly accept or refuse dates near midnight.
 */
function isNotInTheFuture(preferredDate: string, now: Date, organiserTimeZone: string): boolean {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: organiserTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return preferredDate <= today;
}

function isNotAfter(start: string, end: string): boolean {
  return new Date(end).getTime() <= new Date(start).getTime();
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
  /** IANA zone, e.g. `"Asia/Singapore"` -- whose "today" the future-date rule means. */
  organiserTimeZone: string;
}): SubmittedEventRequest {
  const { organiserTimeZone, ...rest } = params;

  const missing = missingMandatoryFields(rest.details);
  if (missing.length > 0) {
    throw new IncompleteEventRequestError(missing);
  }

  const { preferredDate, preferredStartTime, preferredEndTime } = rest.details;

  if (preferredDate !== null && isNotInTheFuture(preferredDate, rest.submittedAt, organiserTimeZone)) {
    throw new PreferredDateNotInFutureError(preferredDate);
  }

  if (
    preferredStartTime !== null &&
    preferredEndTime !== null &&
    isNotAfter(preferredStartTime, preferredEndTime)
  ) {
    throw new PreferredEndTimeNotAfterStartError(preferredStartTime, preferredEndTime);
  }

  return { ...rest, status: "Submitted" };
}

/**
 * The only way to build a new Draft, or restate an existing one after edits.
 *
 * SPM-38: unlike `submitEventRequest`, mandatory-field completeness and the
 * preferred-date/time rules do not apply here -- that is the point of a
 * draft, which exists so an Organiser can save incomplete progress and come
 * back to it. The one rule that still holds is the store's own (`event_name
 * not null` on `event_request`): a request needs a name to be addressable in
 * "My requests" at all.
 */
export function saveEventRequestDraft(params: {
  details: EventRequestDetails;
  clientOrganisationId: ClientOrganisationId;
  responsibleOrganiserId: UserAccountId;
}): NewEventRequest {
  if (isBlank(params.details.eventName)) {
    throw new IncompleteEventRequestError(["eventName"]);
  }

  return {
    details: params.details,
    clientOrganisationId: params.clientOrganisationId,
    responsibleOrganiserId: params.responsibleOrganiserId,
    status: "Draft",
    submittedAt: null,
  };
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

export interface CoordinatorContext {
  readonly userAccountId: UserAccountId;
}

/**
 * The single answer to "what may this Event Coordinator do with this
 * request?" (SPM-32, SPM-121).
 *
 * Unlike the Organiser's access, there is no organisation scoping and no
 * edit case: a Coordinator's access is purely "am I the one this was
 * assigned to", and it never grants edit -- a decision is not an edit to the
 * request (SPM-34's use case asks this predicate who may call
 * `approveEventRequest`/`rejectEventRequest`). Same not-found convention as
 * `eventRequestAccessFor`: callers should turn `"none"` into a not-found,
 * never a forbidden (#91).
 */
export function eventRequestAccessForCoordinator(
  request: EventRequest,
  coordinator: CoordinatorContext,
): EventRequestAccess {
  if (request.assignedCoordinatorUserAccountId === coordinator.userAccountId) {
    return "view";
  }
  return "none";
}

/**
 * A request's standing as its assigned Event Coordinator reads it (SPM-121).
 *
 * `EventRequestStatus` is the Organiser's vocabulary: it distinguishes
 * `Submitted` from `Under Review` because those mean different things to
 * whoever raised the request. To the Coordinator they mean the same thing --
 * a request sitting with them, waiting to be approved, rejected or returned
 * ([[event-request-workflow]] Steps 4-5) -- so both collapse to
 * `"awaiting-decision"`. The one pre-decision distinction a Coordinator does
 * need is `Returned`: the ball is in the Organiser's court until they amend
 * and resubmit, and nothing the Coordinator does moves it.
 *
 * Decided requests keep their own names, because an outcome means the same
 * thing to everyone who reads it.
 *
 * `null` means the request is not a Coordinator's to see at all: `Draft` is
 * the Organiser's alone and cannot carry an assignment. Returning `null`
 * rather than a state is what makes this the single answer to "is this in my
 * queue?" as well as "what do I call it?" -- the two cannot drift apart.
 */
export type CoordinatorRequestState =
  | "awaiting-decision"
  | "with-organiser"
  | "approved"
  | "rejected"
  | "withdrawn";

const COORDINATOR_REQUEST_STATES: Readonly<
  Record<EventRequestStatus, CoordinatorRequestState | null>
> = {
  Draft: null,
  Submitted: "awaiting-decision",
  "Under Review": "awaiting-decision",
  Returned: "with-organiser",
  Approved: "approved",
  Rejected: "rejected",
  Withdrawn: "withdrawn",
};

export function coordinatorRequestStateFor(
  status: EventRequestStatus,
): CoordinatorRequestState | null {
  return COORDINATOR_REQUEST_STATES[status];
}

/** The states that put a request in the Coordinator's queue: theirs to act on, or waiting on the Organiser. */
const QUEUE_STATES: ReadonlySet<CoordinatorRequestState> = new Set([
  "awaiting-decision",
  "with-organiser",
]);

/**
 * A request's state if it belongs in the assigned Coordinator's queue, and
 * `null` if it does not (SPM-121).
 *
 * `Submitted` counts. `assignEventCoordinator` (SPM-97) does move a
 * Submitted request to `Under Review` as it assigns, so the normal path
 * never leaves one here -- but assignment is a plain column write, and a
 * request assigned by any other route (a seed, a migration, a future
 * bulk-assign) would otherwise be invisible to the only person who can act
 * on it. A queue that silently drops an assigned request is the worse
 * failure, so membership follows the assignment, not the status.
 *
 * One call answers membership and label together, so a caller cannot filter
 * on one rule and display another.
 */
export function coordinatorQueueStateFor(
  status: EventRequestStatus,
): CoordinatorRequestState | null {
  const state = coordinatorRequestStateFor(status);
  return state !== null && QUEUE_STATES.has(state) ? state : null;
}

/** The states that put a request in the Coordinator's Archive: decided without becoming an event. */
const ARCHIVE_STATES: ReadonlySet<CoordinatorRequestState> = new Set(["rejected", "withdrawn"]);

/**
 * A request's state if it belongs in the assigned Coordinator's Archive, and
 * `null` if it does not. `Approved` is decided too, but it carries on as an
 * event in "My events" rather than ending here.
 *
 * The Archive's counterpart to `coordinatorQueueStateFor`, and like it one
 * call answers membership and label together.
 */
export function coordinatorArchiveStateFor(
  status: EventRequestStatus,
): CoordinatorRequestState | null {
  const state = coordinatorRequestStateFor(status);
  return state !== null && ARCHIVE_STATES.has(state) ? state : null;
}

/** The two queues an Event Operations Manager works from. */
export type OperationsQueue = "unassigned" | "assigned";

/**
 * Which Event Operations queue a request belongs in, and `null` if it is not
 * Operations' to see at all.
 *
 * A `Draft` is the Organiser's alone -- unfinished, unsubmitted, and not
 * something Operations can act on (`assignEventCoordinator` refuses it) -- so
 * it is in neither queue. Every other request is sorted by whether it has an
 * Event Coordinator yet, whatever its status: a decided request keeps its
 * coordinator and stays under "assigned".
 *
 * Like `coordinatorQueueStateFor`, one call answers membership and placement
 * together, so a screen cannot filter on one rule and file on another.
 */
export function operationsQueueFor(
  request: Pick<EventRequest, "status" | "assignedCoordinatorUserAccountId">,
): OperationsQueue | null {
  if (request.status === "Draft") {
    return null;
  }
  return request.assignedCoordinatorUserAccountId === null ? "unassigned" : "assigned";
}

/** The three places an Event Coordinator's work lives. */
export type CoordinatorSection = "requests" | "events" | "archive";

/**
 * Which of the Coordinator's sections a request assigned to them lives under:
 * an Approved request carries on as an event in "My events", a request decided
 * without becoming an event is in the Archive, and everything else is still in
 * "My requests".
 *
 * The single-request counterpart of `coordinatorQueueStateFor` and
 * `coordinatorArchiveStateFor`, so a request's own page files it exactly where
 * the lists do.
 */
export function coordinatorSectionFor(status: EventRequestStatus): CoordinatorSection {
  if (coordinatorRequestStateFor(status) === "approved") {
    return "events";
  }
  return coordinatorArchiveStateFor(status) !== null ? "archive" : "requests";
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

/**
 * Whether an Event Coordinator can be assigned to a request in this status.
 *
 * Not a Draft, which the Organiser has not submitted, and not a request
 * decided without becoming an event (Rejected, Withdrawn), which has no review
 * left to run. Every other request can take a coordinator, or a new one.
 */
export function canAssignEventCoordinator(status: EventRequestStatus): boolean {
  return status !== "Draft" && status !== "Withdrawn" && status !== "Rejected";
}

/**
 * Assigns or reassigns the Event Coordinator responsible for reviewing a request.
 *
 * Assignment starts the review only when the request has just been Submitted.
 * Requests already further through an assignable workflow retain their status.
 */
export function assignEventCoordinator(
  request: EventRequest,
  coordinatorId: UserAccountId,
): EventRequest {
  if (!canAssignEventCoordinator(request.status)) {
    throw new EventRequestNotAssignableError(request.status);
  }

  return {
    ...request,
    assignedCoordinatorUserAccountId: coordinatorId,
    status: request.status === "Submitted" ? "Under Review" : request.status,
  };
}

/**
 * A request is the Coordinator's to decide only while it awaits their decision
 * -- `Submitted` or `Under Review`, the same reading `coordinatorRequestStateFor`
 * gives the queue. `Returned` is waiting on the Organiser, and every decided
 * state is final: rejection in particular has no resubmission path (#67).
 *
 * Who may decide is not asked here. The use case asks
 * `eventRequestAccessForCoordinator`, the same split the draft use cases draw.
 */
function assertDecidable(request: EventRequest): void {
  if (coordinatorRequestStateFor(request.status) !== "awaiting-decision") {
    throw new EventRequestNotDecidableError();
  }
}

/**
 * SPM-34: approval means only that the request holds enough to plan against --
 * it commits ConnectSphere to nothing yet (#80). The note is optional, so a
 * blank one records nothing rather than an empty string.
 *
 * Opening the request's event in `Planning` is the store's half of the same
 * act (SPM-140), not something this value can express.
 */
export function approveEventRequest(request: EventRequest, note: string): EventRequest {
  assertDecidable(request);

  return { ...request, status: "Approved", decisionRecord: note.trim() || null };
}

/**
 * SPM-34: rejection is terminal (#67) and must say why -- the reason is the
 * decision record a rejected request keeps.
 *
 * Status is checked before the reason, so an already-decided request is
 * refused as such rather than asked for a reason it could never use.
 */
export function rejectEventRequest(request: EventRequest, reason: string): EventRequest {
  assertDecidable(request);

  const decisionRecord = reason.trim();
  if (decisionRecord.length === 0) {
    throw new DecisionReasonRequiredError();
  }

  return { ...request, status: "Rejected", decisionRecord };
}

/**
 * SPM-101: the assigned Coordinator records a withdrawal the Organiser asked
 * for outside the system (#103). Withdrawal is not a decision, so it has its
 * own source-state rule rather than `assertDecidable`'s: only `Under Review`,
 * the one state #103 names. `Submitted -> Withdrawn` is deliberately not an
 * edge (team decision, 2026-09-23).
 *
 * The note is optional, so a blank one records nothing, as for approval.
 */
export function withdrawEventRequest(request: EventRequest, note: string): EventRequest {
  if (request.status !== "Under Review") {
    throw new EventRequestNotWithdrawableError();
  }

  return { ...request, status: "Withdrawn", decisionRecord: note.trim() || null };
}
