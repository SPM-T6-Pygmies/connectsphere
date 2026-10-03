/**
 * Errors the business rules themselves can raise.
 *
 * These are deliberately not HTTP statuses, not Supabase errors and not
 * `Error` strings to be regex-matched. Driving adapters translate a
 * `DomainError` into whatever their transport calls a failure -- a 409, a form
 * message, a tRPC error code -- and that translation is the adapter's job, not
 * the core's.
 */
export abstract class DomainError extends Error {
  /** Stable, transport-agnostic identifier for adapters to switch on. */
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidMemberIdError extends DomainError {
  readonly code = "invalid_member_id";

  constructor(raw: string) {
    super(`"${raw}" is not a usable member id.`);
  }
}

export class InvalidConnectionIdError extends DomainError {
  readonly code = "invalid_connection_id";

  constructor(raw: string) {
    super(`"${raw}" is not a usable connection id.`);
  }
}

export class SelfConnectionError extends DomainError {
  readonly code = "self_connection";

  constructor() {
    super("A member cannot connect with themselves.");
  }
}

export class MemberNotFoundError extends DomainError {
  readonly code = "member_not_found";

  constructor(id: string) {
    super(`No member exists with id ${id}.`);
  }
}

export class DuplicateConnectionError extends DomainError {
  readonly code = "duplicate_connection";

  constructor(existingStatus: string) {
    super(`These members already have a ${existingStatus} connection.`);
  }
}

export class InvalidEventIdError extends DomainError {
  readonly code = "invalid_event_id";

  constructor(raw: string) {
    super(`"${raw}" is not a usable event id.`);
  }
}

export class InvalidRegistrationIdError extends DomainError {
  readonly code = "invalid_registration_id";

  constructor(raw: string) {
    super(`"${raw}" is not a usable registration id.`);
  }
}

export class InvalidAttendeeNameError extends DomainError {
  readonly code = "invalid_attendee_name";

  constructor() {
    super("A registration needs the attendee's full name.");
  }
}

export class InvalidAttendeeEmailError extends DomainError {
  readonly code = "invalid_attendee_email";

  constructor() {
    super("A registration needs the attendee's email address.");
  }
}

export class EventNotFoundError extends DomainError {
  readonly code = "event_not_found";

  constructor(id: string) {
    super(`No event exists with id ${id}.`);
  }
}

export class EventNotOpenForRegistrationError extends DomainError {
  readonly code = "event_not_open_for_registration";

  constructor(name: string) {
    super(`Registration for ${name} is not open.`);
  }
}

export class EventFullError extends DomainError {
  readonly code = "event_full";

  constructor() {
    super("This event is full.");
  }
}

export class DuplicateRegistrationError extends DomainError {
  readonly code = "duplicate_registration";

  constructor(email: string) {
    super(`${email} is already registered for this event.`);
  }
}

export class RegistrationNotFoundError extends DomainError {
  readonly code = "registration_not_found";

  constructor(reference: string) {
    super(`No registration exists with reference ${reference}.`);
  }
}

/**
 * Withdrawn is terminal (SPM-84), so a second withdrawal is a refusal rather
 * than a no-op.
 *
 * Takes no argument for the same reason `EventFullError` takes none: the
 * Supabase adapter raises this one too, when it loses the race to a withdrawal
 * that landed first, and there it holds nothing to put in the message.
 */
export class RegistrationAlreadyWithdrawnError extends DomainError {
  readonly code = "registration_already_withdrawn";

  constructor() {
    super("This registration has already been withdrawn.");
  }
}

export class EventAlreadyCompletedError extends DomainError {
  readonly code = "event_already_completed";

  constructor() {
    super("This event has already taken place, so the registration cannot be withdrawn.");
  }
}

export class InvalidEventRequestIdError extends DomainError {
  readonly code = "invalid_event_request_id";

  constructor(raw: string) {
    super(`"${raw}" is not a usable event request id.`);
  }
}

export class InvalidClientOrganisationIdError extends DomainError {
  readonly code = "invalid_client_organisation_id";

  constructor(raw: string) {
    super(`"${raw}" is not a usable client organisation id.`);
  }
}

export class InvalidUserAccountIdError extends DomainError {
  readonly code = "invalid_user_account_id";

  constructor(raw: string) {
    super(`"${raw}" is not a usable user account id.`);
  }
}

export class EventRequestNotFoundError extends DomainError {
  readonly code = "event_request_not_found";

  constructor(id: string) {
    super(`No event request exists with id ${id}.`);
  }
}

export class EventCoordinatorNotFoundError extends DomainError {
  readonly code = "event_coordinator_not_found";

  constructor(id: string) {
    super(`No Event Coordinator exists with user account id ${id}.`);
  }
}

export class EventRequestNotAssignableError extends DomainError {
  readonly code = "event_request_not_assignable";

  constructor(readonly status: string) {
    super(`An event request with status ${status} cannot be assigned.`);
  }
}

/**
 * SPM-34: only a request awaiting the Coordinator's decision (`Submitted` or
 * `Under Review`) can be approved or rejected, and a decided request is final.
 *
 * Takes no argument for the same reason `RegistrationAlreadyWithdrawnError`
 * takes none: the Supabase adapter raises this one too, when a concurrent
 * decision landed first, and there it holds no status to put in the message.
 */
export class EventRequestNotDecidableError extends DomainError {
  readonly code = "event_request_not_decidable";

  constructor() {
    super("This event request is no longer awaiting a decision.");
  }
}

/**
 * SPM-101: only a request not yet decided can be withdrawn (#103), and a
 * withdrawn request stays withdrawn.
 *
 * Takes no argument for the same reason `EventRequestNotDecidableError` takes
 * none: the Supabase adapter raises it too, after losing a race.
 */
export class EventRequestNotWithdrawableError extends DomainError {
  readonly code = "event_request_not_withdrawable";

  constructor() {
    super("Only an event request that has not been decided can be withdrawn.");
  }
}

/** SPM-34: a rejection must say why -- the reason is the decision record it keeps. */
export class DecisionReasonRequiredError extends DomainError {
  readonly code = "decision_reason_required";

  constructor() {
    super("Give a reason for rejecting this request.");
  }
}

/**
 * SPM-31 AC3: the Organiser is told exactly what is missing.
 *
 * Carries the field names rather than a rendered sentence, so the driving
 * adapter can put each message against its own input. Naming the fields is not
 * a transport concern leaking inward -- they are the domain's own field names,
 * and the adapter is free to label them however its UI does.
 */
export class IncompleteEventRequestError extends DomainError {
  readonly code = "incomplete_event_request";

  constructor(readonly missing: readonly string[]) {
    super(`This request is missing ${missing.length} required detail(s).`);
  }
}

/**
 * SPM-31: the Organiser is requesting a future event, not a past or same-day
 * one -- "later than today" per the rule, not "today or later".
 */
export class PreferredDateNotInFutureError extends DomainError {
  readonly code = "preferred_date_not_in_future";

  constructor(readonly preferredDate: string) {
    super(`Preferred date ${preferredDate} must be later than today.`);
  }
}

/**
 * SPM-31: replacing free-text `preferred_time` with two instants only works if
 * they actually describe a span.
 */
export class PreferredEndTimeNotAfterStartError extends DomainError {
  readonly code = "preferred_end_time_not_after_start";

  constructor(
    readonly preferredStartTime: string,
    readonly preferredEndTime: string,
  ) {
    super(
      `Preferred end time (${preferredEndTime}) must be after preferred start time ` +
        `(${preferredStartTime}).`,
    );
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly code = "invalid_credentials";

  constructor() {
    super("Invalid credentials.");
  }
}

/**
 * Login is for staff only -- an Attendee is never issued an account (they
 * register by name and email, no credential), so any account with no staff
 * role reaching this far is refused rather than sent anywhere in `/staff`.
 */
export class NoStaffRoleError extends DomainError {
  readonly code = "no_staff_role";

  constructor() {
    super("This account has no staff role.");
  }
}

/**
 * SPM-38: a draft may only be edited by its own responsible Organiser, and
 * only while it is still `Draft` -- the same rule `eventRequestAccessFor`
 * already draws for viewing. Once a coordinator has taken it further, or it
 * belongs to someone else, this is the answer for both "no such draft" and
 * "not yours", for the same not-found-shaped reason #91 gives to viewing.
 */
export class DraftNotEditableError extends DomainError {
  readonly code = "draft_not_editable";

  constructor(readonly id: string) {
    super(`Event request ${id} is not an editable draft.`);
  }
}

/**
 * SPM-33 AC2: a clarification can only be requested on a request that is still
 * pre-decision -- `Submitted`, `Under Review`, or already `Returned` (decision
 * 5: a request can be returned more than once, with or without a Resolve in
 * between). A decided request has no clarification left to ask for.
 *
 * Takes no argument for the same reason `EventRequestNotDecidableError` takes
 * none: the Supabase adapter raises this one too, after losing a race to a
 * concurrent decision, and there it holds no status to put in the message.
 */
export class EventRequestNotReturnableError extends DomainError {
  readonly code = "event_request_not_returnable";

  constructor() {
    super("This event request can no longer be returned for clarification.");
  }
}

/**
 * SPM-33 AC3: a clarification request must say what needs clarifying -- by the
 * same rule that makes a rejection state its reason.
 */
export class ClarificationMessageRequiredError extends DomainError {
  readonly code = "clarification_message_required";

  constructor() {
    super("Say what needs clarifying.");
  }
}

/**
 * SPM-33 AC6: only a `Returned` request can be marked resolved -- resolving is
 * the Coordinator's "I am no longer waiting on the Organiser" signal, and there
 * is nothing to stop waiting for on a request that was never returned.
 *
 * Argument-free for the same race-losing reason as the two above.
 */
export class ClarificationNotResolvableError extends DomainError {
  readonly code = "clarification_not_resolvable";

  constructor() {
    super("This event request is not waiting on the Organiser.");
  }
}

export class InvalidClarificationMessageIdError extends DomainError {
  readonly code = "invalid_clarification_message_id";

  constructor(raw: string) {
    super(`"${raw}" is not a usable clarification message id.`);
  }
}

/**
 * SPM-33 decision 6: comment threading follows Linear -- top-level messages
 * with one level of reply -- so a reply's parent must itself be top-level, and
 * must be on the same request.
 *
 * Argument-free like the other clarification errors: the Supabase function
 * raises this one too, and there it holds nothing useful to name.
 */
export class ClarificationReplyNotTopLevelError extends DomainError {
  readonly code = "clarification_reply_not_top_level";

  constructor() {
    super("You can only reply to a top-level message.");
  }
}

/**
 * SPM-33 AC6: only a question the Coordinator asked can be marked answered,
 * and only once. An ordinary comment asked for nothing, and a resolved
 * question is already cleared.
 *
 * Argument-free like the other clarification errors: the Supabase function
 * raises this one too, after losing a race to a concurrent resolve.
 */
export class ClarificationThreadNotResolvableError extends DomainError {
  readonly code = "clarification_thread_not_resolvable";

  constructor() {
    super("That is not an open question on this request.");
  }
}

/**
 * SPM-33: a decided request's clarification thread is closed -- nothing more
 * can be posted, replied or resolved on it. See `canDiscussEventRequest`.
 *
 * Argument-free for the same reason: the Supabase functions raise it too,
 * after losing a race to a concurrent decision.
 */
export class ClarificationThreadClosedError extends DomainError {
  readonly code = "clarification_thread_closed";

  constructor() {
    super("This request has been decided, so its clarification thread is closed.");
  }
}

export class InvalidVenueIdError extends DomainError {
  readonly code = "invalid_venue_id";

  constructor(raw: string) {
    super(`"${raw}" is not a usable venue id.`);
  }
}

/**
 * SPM-42: a venue record the catalogue would not accept -- a missing location,
 * a layout with no capacity, hours that run backwards. The reason is written
 * for the person filling in the form, so it can be shown as it is.
 */
export class InvalidVenueError extends DomainError {
  readonly code = "invalid_venue";

  /** Which form field the reason is about, so the screen can flag that one. */
  constructor(
    reason: string,
    readonly field: VenueField | null = null,
  ) {
    super(reason);
  }
}

export type VenueField =
  | "location"
  | "facilities"
  | "accessibility"
  | "operatingHoursStart"
  | "operatingHoursEnd"
  | "capacity"
  | "bookingHorizonDays"
  | "layouts";

/**
 * SPM-44: venue search criteria that cannot be searched on -- an end time
 * before the start, a date without times, a facility that is not an option.
 * Written for the Coordinator, so it can be shown as it is.
 */
export class InvalidVenueSearchError extends DomainError {
  readonly code = "invalid_venue_search";

  constructor(
    reason: string,
    readonly field: VenueSearchField | null = null,
  ) {
    super(reason);
  }
}

export type VenueSearchField =
  | "layout"
  | "attendance"
  | "facilities"
  | "accessibility"
  | "date"
  | "startTime"
  | "endTime";

export class VenueNotFoundError extends DomainError {
  readonly code = "venue_not_found";

  constructor() {
    super("That venue is not in the catalogue.");
  }
}

/**
 * SPM-42 (#66): only Venue Staff maintain the catalogue. Argument-free because
 * the Supabase functions raise it too, when the database's own role check
 * refuses a write the application let through.
 */
export class VenueMaintenanceNotPermittedError extends DomainError {
  readonly code = "venue_maintenance_not_permitted";

  constructor() {
    super("Only Venue Staff can create or update venues.");
  }
}

/**
 * SPM-50: only an event in `Planning` can be confirmed -- `Blocked`,
 * `Confirmed`, `Completed` and `Cancelled` all refuse, each for its own
 * reason the ticket and schema leave undefined beyond "not Planning".
 */
export class EventNotConfirmableError extends DomainError {
  readonly code = "event_not_confirmable";

  constructor(readonly status: string) {
    super(`An event with status ${status} cannot be confirmed.`);
  }
}

/**
 * SPM-50 AC1: confirmation is blocked while an essential arrangement is
 * incomplete, and the incomplete ones are named -- carries the list rather
 * than a rendered sentence, the same choice `IncompleteEventRequestError`
 * already makes for the same reason.
 */
export class EventNotReadyForConfirmationError extends DomainError {
  readonly code = "event_not_ready_for_confirmation";

  constructor(readonly blockingArrangements: readonly string[]) {
    super(
      `This event cannot be confirmed: ${blockingArrangements.join(", ")} ` +
        `${blockingArrangements.length === 1 ? "is" : "are"} not complete.`,
    );
  }
}

export class InvalidEquipmentItemIdError extends DomainError {
  readonly code = "invalid_equipment_item_id";

  constructor(raw: string) {
    super(`"${raw}" is not a usable equipment item id.`);
  }
}

/** SPM-41 AC3: a requirement is for at least one whole item. */
export class InvalidEquipmentQuantityError extends DomainError {
  readonly code = "invalid_equipment_quantity";

  constructor(readonly quantity: number) {
    super(`Quantity must be a whole number of at least 1, not ${quantity}.`);
  }
}

/** SPM-41 AC5: technical requirements are optional, but bounded. */
export class TechnicalRequirementsTooLongError extends DomainError {
  readonly code = "technical_requirements_too_long";

  constructor(readonly maxLength: number) {
    super(`Technical requirements must be at most ${maxLength} characters.`);
  }
}

/**
 * SPM-41 AC2: one line per equipment type, so a second line for the same type
 * is refused and the coordinator is pointed at the existing one.
 *
 * Takes no argument for the same reason `RegistrationAlreadyWithdrawnError`
 * takes none: the Supabase adapter raises this one too, when a concurrent add
 * of the same type landed first, and there it holds nothing to put in the
 * message.
 */
export class DuplicateEquipmentRequirementError extends DomainError {
  readonly code = "duplicate_equipment_requirement";

  constructor() {
    super("This event already has a line for that equipment type. Edit the existing line instead.");
  }
}

/** SPM-41 AC13: a Completed or Cancelled event's equipment requirements are read-only. */
export class EquipmentRequirementsLockedError extends DomainError {
  readonly code = "equipment_requirements_locked";

  constructor(readonly status: string) {
    super(`Equipment requirements on a ${status} event are read-only.`);
  }
}

/**
 * SPM-41 AC11: once removal of a reserved line is requested, the line waits
 * for Technical Support to release it (SPM-108). Until then the coordinator
 * can only undo the removal (AC17) -- not edit the line or remove it again.
 */
export class EquipmentRemovalAlreadyRequestedError extends DomainError {
  readonly code = "equipment_removal_already_requested";

  constructor() {
    super("Removal of this line has already been requested. Undo the removal to change it.");
  }
}

/**
 * SPM-41 AC17: only a line whose removal is pending can have that removal
 * undone. A second undo is a refusal rather than a no-op, the same choice
 * `RegistrationAlreadyWithdrawnError` makes for a second withdrawal.
 */
export class EquipmentRemovalNotRequestedError extends DomainError {
  readonly code = "equipment_removal_not_requested";

  constructor() {
    super("This line has no pending removal to undo.");
  }
}

/** SPM-41 AC4: an equipment requirement's type must be picked from the catalogue. */
export class EquipmentItemNotInCatalogueError extends DomainError {
  readonly code = "equipment_item_not_in_catalogue";

  constructor(readonly equipmentItemId: string) {
    super(`Equipment item ${equipmentItemId} is not in the catalogue.`);
  }
}

/**
 * SPM-41: an edit, removal or undo named a type the event has no line for --
 * the line was removed in the meantime, or never existed.
 */
export class EquipmentRequirementNotFoundError extends DomainError {
  readonly code = "equipment_requirement_not_found";

  constructor(readonly equipmentItemId: string) {
    super(`This event has no equipment line for item ${equipmentItemId}.`);
  }
}

/**
 * SPM-41: Technical Support reserved against a line after the coordinator's
 * change was decided, so the change was not stored -- deciding it again
 * against the new reservation may flag it where it would not have been.
 *
 * Takes no argument: only the Supabase adapter raises this, when it loses the
 * race, and there it holds nothing to put in the message.
 */
/** SPM-41 AC16: only Technical Support Staff may read the equipment re-check list. */
export class NotTechnicalSupportStaffError extends DomainError {
  readonly code = "not_technical_support_staff";

  constructor() {
    super("Only Technical Support Staff can see the equipment re-check list.");
  }
}

export class EquipmentRequirementConflictError extends DomainError {
  readonly code = "equipment_requirement_conflict";

  constructor() {
    super("Technical Support Staff have just reserved equipment against this line. Reload and try again.");
  }
}
