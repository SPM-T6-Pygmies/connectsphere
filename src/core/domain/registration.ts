import type { AttendeeEmail, AttendeeName } from "./attendee";
import type { Brand } from "./brand";
import { allowsWithdrawal, type Event, type EventId } from "./event";
import { InvalidRegistrationIdError, RegistrationAlreadyWithdrawnError } from "./errors";

export type RegistrationId = Brand<string, "RegistrationId">;

/**
 * Release 1 has no waiting list and no check-in, so a registration is either
 * live or released. `waitlisted` and the attendance states stay out until the
 * tickets that need them arrive.
 */
export type RegistrationStatus = "registered" | "withdrawn";

/**
 * An Attendee's place at an event.
 *
 * The attendee is identified by the name and email they supply, not by an
 * account: the customer describes Attendees as external users and puts
 * onboarding outside the brief (#53), so there is no account to point at.
 */
export interface Registration {
  readonly id: RegistrationId;
  readonly eventId: EventId;
  readonly attendeeName: AttendeeName;
  readonly attendeeEmail: AttendeeEmail;
  readonly status: RegistrationStatus;
  readonly registeredAt: Date;
}

export function registrationId(raw: string): RegistrationId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvalidRegistrationIdError(raw);
  }
  return trimmed as RegistrationId;
}

/** The one place a `Registration` comes into existence. */
export function registerAttendee(params: {
  id: RegistrationId;
  eventId: EventId;
  attendeeName: AttendeeName;
  attendeeEmail: AttendeeEmail;
  registeredAt: Date;
}): Registration {
  return { ...params, status: "registered" };
}

/** Whether this registration still holds a place. */
export function isLive(registration: Registration): boolean {
  return registration.status === "registered";
}

/**
 * Whether an existing registration stops the same attendee registering again.
 *
 * A withdrawn registration releases the place (brief s4), so it must not block
 * a fresh one -- the same shape as `blocksNewRequest` for connections.
 */
export function blocksNewRegistration(existing: Registration): boolean {
  return isLive(existing);
}

/**
 * The single answer to "may this registration be withdrawn?" (SPM-84).
 *
 * Both halves matter and they fail differently, so the write path asks them
 * separately to raise distinct errors. This conjunction exists for the read
 * path, which only needs to know whether to offer the button at all.
 */
export function canWithdraw(registration: Registration, event: Event): boolean {
  return isLive(registration) && allowsWithdrawal(event);
}

/**
 * The one place a Registration leaves the live state.
 *
 * Withdrawn is terminal (SPM-84), and the invariant is enforced here rather
 * than only in the use case for the same reason `requestConnection` throws
 * `SelfConnectionError` from inside the constructor: a registration withdrawn
 * twice should not be constructible at all.
 */
export function withdrawRegistration(existing: Registration): Registration {
  if (!isLive(existing)) {
    throw new RegistrationAlreadyWithdrawnError();
  }
  return { ...existing, status: "withdrawn" };
}
