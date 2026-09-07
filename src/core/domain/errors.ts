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

export class InvalidClientOrganisationIdError extends DomainError {
  readonly code = "invalid_client_organisation_id";

  constructor(raw: string) {
    super(`"${raw}" is not a usable client organisation id.`);
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
