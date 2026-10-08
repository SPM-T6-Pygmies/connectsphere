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
 * SPM-46: the event a booking is for either does not exist or is not the
 * caller's to plan -- one answer for both, as for requests (#91).
 */
export class CoordinatorEventNotFoundError extends DomainError {
  readonly code = "coordinator_event_not_found";

  constructor(readonly id: string) {
    super(`Event ${id} was not found.`);
  }
}

export class NoBookingSlotsError extends DomainError {
  readonly code = "no_booking_slots";

  constructor() {
    super("Choose at least one slot to book.");
  }
}

export class InvalidBookingDateError extends DomainError {
  readonly code = "invalid_booking_date";

  constructor(readonly date: string) {
    super(`"${date}" is not a valid date.`);
  }
}

export class DuplicateBookingSlotError extends DomainError {
  readonly code = "duplicate_booking_slot";

  constructor(
    readonly date: string,
    readonly slot: string,
  ) {
    super(`${date} ${slot} is requested more than once.`);
  }
}

/** SPM-104: a venue with more than one layout needs the request to say which it assumes (#112). */
export class RoomLayoutRequiredError extends DomainError {
  readonly code = "room_layout_required";

  constructor() {
    super("This venue supports more than one layout. Choose the one the event assumes.");
  }
}

export class UnsupportedRoomLayoutError extends DomainError {
  readonly code = "unsupported_room_layout";

  constructor(readonly roomLayout: string) {
    super("That layout is not one this venue supports.");
  }
}

/**
 * SPM-104: the layout is the coordinator's to change only while the request
 * is still pending. Once Venue Staff have answered it, the answer was given
 * for the layout then on record.
 */
export class BookingRoomLayoutNotChangeableError extends DomainError {
  readonly code = "booking_room_layout_not_changeable";

  constructor(readonly status: string) {
    super("The layout can only be changed while the request is waiting for Venue Staff.");
  }
}

/** SPM-46: a hold or confirmed booking already has one of the slots -- a hard block (#35, #41). */
export class VenueSlotUnavailableError extends DomainError {
  readonly code = "venue_slot_unavailable";

  constructor(readonly slots: ReadonlyArray<{ readonly date: string; readonly slot: string }>) {
    super(
      `The venue is already booked for ${slots
        .map(({ date, slot }) => `${date} ${slot}`)
        .join(", ")}. Choose other slots or another venue.`,
    );
  }
}

/** SPM-22: no such booking, or one Venue Staff may not see. */
export class BookingNotFoundError extends DomainError {
  readonly code = "booking_not_found";

  constructor(readonly bookingId: string) {
    super("That booking request does not exist.");
  }
}

/**
 * SPM-22: only a request still waiting for Venue Staff can be decided. Takes no
 * status for the reason `EventRequestNotDecidableError` takes none: the
 * Supabase adapter raises it too, after losing a race to another decision.
 */
export class BookingNotDecidableError extends DomainError {
  readonly code = "booking_not_decidable";

  constructor() {
    super("This booking request has already been decided.");
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

export class InvalidEquipmentItemIdError extends DomainError {
  readonly code = "invalid_equipment_item_id";

  constructor(raw: string) {
    super(`"${raw}" is not a usable equipment item id.`);
  }
}

export class EquipmentItemNotFoundError extends DomainError {
  readonly code = "equipment_item_not_found";

  constructor(id: string) {
    super(`No equipment item exists with id ${id}.`);
  }
}

/** SPM-40 AC1: a catalogue record must say what the equipment is. */
export class EquipmentTypeRequiredError extends DomainError {
  readonly code = "equipment_type_required";

  constructor() {
    super("Enter the equipment type.");
  }
}

/** SPM-40 AC1: a catalogue record must say where the equipment is kept. */
export class EquipmentLocationRequiredError extends DomainError {
  readonly code = "equipment_location_required";

  constructor() {
    super("Enter where the equipment is kept.");
  }
}

/** SPM-40: the quantity available is a count -- whole, and never below zero. */
export class InvalidEquipmentQuantityError extends DomainError {
  readonly code = "invalid_equipment_quantity";

  constructor() {
    super("Quantity must be a whole number, zero or more.");
  }
}

/** SPM-17 AC2: out of service is a whole number from 0 up to the number owned. */
export class InvalidOutOfServiceCountError extends DomainError {
  readonly code = "invalid_out_of_service_count";

  constructor(readonly owned: number) {
    super(`Out of service must be a whole number from 0 up to the number owned (${owned}).`);
  }
}

/** SPM-274: the line is not one Technical Support can reserve or mark unfulfilled -- or no longer is. */
export class EquipmentLineNotAwaitingDecisionError extends DomainError {
  readonly code = "equipment_line_not_awaiting_decision";

  constructor() {
    super("This line is no longer waiting for a decision. Reload the page to see where it stands.");
  }
}

/** SPM-274 AC2: availability is judged against the event's date, so there must be one. */
export class EventDateRequiredForEquipmentError extends DomainError {
  readonly code = "event_date_required_for_equipment";

  constructor() {
    super("This event needs a date before equipment can be reserved for it.");
  }
}

/** SPM-274 AC3, AC6: a line is reserved in full or not at all. */
export class NotEnoughEquipmentAvailableError extends DomainError {
  readonly code = "not_enough_equipment_available";

  constructor(
    readonly available: number,
    readonly requested: number,
  ) {
    super(
      `Only ${Math.max(available, 0)} available, fewer than the ${requested} requested, so nothing was reserved. ` +
        "Mark the line unfulfilled instead.",
    );
  }
}

/** SPM-274 AC3: a line is marked unfulfilled only when too few units are free. */
export class EquipmentAvailableToReserveError extends DomainError {
  readonly code = "equipment_available_to_reserve";

  constructor(
    readonly available: number,
    readonly requested: number,
  ) {
    super(`${available} available, enough for the ${requested} requested. Reserve the line instead.`);
  }
}

/** SPM-274 AC3: the coordinator is told why. */
export class UnfulfilledCommentRequiredError extends DomainError {
  readonly code = "unfulfilled_comment_required";

  constructor() {
    super('Say why the line cannot be fulfilled, e.g. "only 3 available".');
  }
}

export class UnfulfilledCommentTooLongError extends DomainError {
  readonly code = "unfulfilled_comment_too_long";

  constructor(readonly max: number) {
    super(`The comment must be ${max} characters or fewer.`);
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
 * a layout with no capacity, no slot to book it in. The reason is written
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
  | "slots"
  | "capacity"
  | "bookingHorizonDays"
  | "layouts";

/**
 * SPM-44: venue search criteria that cannot be searched on -- a date without
 * a slot, a date already past, a facility that is not an option.
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
  | "slots";

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

/** SPM-41 AC3: a requirement is for at least one whole item. */
export class InvalidEquipmentRequirementQuantityError extends DomainError {
  readonly code = "invalid_equipment_requirement_quantity";

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
/** SPM-41 AC16, SPM-273: only Technical Support Staff may read their equipment lists. */
export class NotTechnicalSupportStaffError extends DomainError {
  readonly code = "not_technical_support_staff";

  constructor() {
    super("Only Technical Support Staff can see the equipment lists.");
  }
}

/** SPM-259 AC7: only a Safety Officer may read the list of events awaiting a safety check. */
export class NotSafetyOfficerError extends DomainError {
  readonly code = "not_safety_officer";

  constructor() {
    super("Only a Safety Officer can see the events awaiting a safety check.");
  }
}

/** SPM-260 AC6: an outcome is recorded only on an event awaiting a safety check. */
export class EventNotAwaitingSafetyCheckError extends DomainError {
  readonly code = "event_not_awaiting_safety_check";

  constructor() {
    super("This event is not awaiting a safety check.");
  }
}

/** SPM-260 AC3: a rejection says what must change. */
export class SafetyCheckCommentsRequiredError extends DomainError {
  readonly code = "safety_check_comments_required";

  constructor() {
    super("Say what must change before rejecting.");
  }
}

export class NotCoordinatorLeadError extends DomainError {
  readonly code = "not_coordinator_lead";

  constructor() {
    super("Only an Event Coordinator Lead can oversee every coordinator's work.");
  }
}

export class EventNotReassignableError extends DomainError {
  readonly code = "event_not_reassignable";

  constructor(readonly status: string) {
    super(`A ${status} event's coordinator cannot change.`);
  }
}

export class EquipmentRequirementConflictError extends DomainError {
  readonly code = "equipment_requirement_conflict";

  constructor() {
    super("Technical Support Staff have just reserved equipment against this line. Reload and try again.");
  }
}

/** SPM-21 AC3: a block covers at least one slot. */
export class NoUnavailabilitySlotsError extends DomainError {
  readonly code = "no_unavailability_slots";

  constructor() {
    super("Choose at least one slot to block.");
  }
}

/** SPM-21 AC4: a block's start date is on or before its end date. */
export class UnavailabilityEndsBeforeStartError extends DomainError {
  readonly code = "unavailability_ends_before_start";

  constructor(
    readonly startDate: string,
    readonly endDate: string,
  ) {
    super(`The end date ${endDate} is before the start date ${startDate}.`);
  }
}

/** SPM-21 AC5: a block that has already ended is refused; one ending today is not. */
export class UnavailabilityInThePastError extends DomainError {
  readonly code = "unavailability_in_the_past";

  constructor(readonly endDate: string) {
    super(`A block cannot end in the past (${endDate}).`);
  }
}

/** SPM-21 AC6: the reason is one of the customer's five (Week 7 C2). */
export class InvalidUnavailabilityReasonError extends DomainError {
  readonly code = "invalid_unavailability_reason";

  constructor(readonly reason: string) {
    super("Choose a reason: Maintenance, Equipment failure, Renovation, Safety or Other.");
  }
}

/** SPM-21 AC7: free text explains "Other" only. */
export class UnavailabilityNoteNotAllowedError extends DomainError {
  readonly code = "unavailability_note_not_allowed";

  constructor(readonly reason: string) {
    super(`A note is only allowed when the reason is Other, not ${reason}.`);
  }
}

/** SPM-21 AC8: a note is bounded, as technical requirements are (SPM-41 AC5). */
export class UnavailabilityNoteTooLongError extends DomainError {
  readonly code = "unavailability_note_too_long";

  constructor(readonly maxLength: number) {
    super(`The note must be at most ${maxLength} characters.`);
  }
}

/** SPM-21 AC9: only Venue Staff record or lift a block. */
export class VenueUnavailabilityNotPermittedError extends DomainError {
  readonly code = "venue_unavailability_not_permitted";

  constructor() {
    super("Only Venue Staff can mark a venue unavailable or lift a block.");
  }
}

/** SPM-21 AC15: a block to lift that does not exist. */
export class VenueUnavailabilityNotFoundError extends DomainError {
  readonly code = "venue_unavailability_not_found";

  constructor() {
    super("That block does not exist.");
  }
}

/** SPM-21 AC17: a lifted block cannot be lifted again. */
export class UnavailabilityAlreadyLiftedError extends DomainError {
  readonly code = "unavailability_already_lifted";

  constructor() {
    super("That block has already been lifted.");
  }
}

/**
 * SPM-21 AC12: a Venue Staff block covers a slot the request asks for. Unlike a
 * clash with another booking, there is no other venue slot to choose around it
 * and no override.
 */
export class VenueSlotBlockedError extends DomainError {
  readonly code = "venue_slot_blocked";

  constructor(readonly slots: ReadonlyArray<{ readonly date: string; readonly slot: string }>) {
    super(
      `The venue is unavailable for ${slots
        .map(({ date, slot }) => `${date} ${slot}`)
        .join(", ")}. Choose other slots or another venue.`,
    );
  }
}
