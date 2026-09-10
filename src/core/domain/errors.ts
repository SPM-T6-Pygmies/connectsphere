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
