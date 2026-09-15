import type { Event } from "../domain/event";
import { canWithdraw, type Registration } from "../domain/registration";

import { toAvailableEvent, type AvailableEvent } from "./available-event";

/**
 * A registration as the Attendee holding its reference may see it.
 *
 * Plain, serialisable data, like `AvailableEvent`: the status is a literal
 * union rather than the domain's `RegistrationStatus` so that nothing outside
 * the hexagon has to import a domain type to read a result.
 *
 * Shared by the view and the withdrawal because they return the same thing --
 * a withdrawal is this object with `status` flipped, which is what makes SPM-86
 * (confirm the withdrawal, naming the event) fall out of the read path rather
 * than needing a shape of its own.
 */
export interface AttendeeRegistration {
  readonly reference: string;
  readonly attendeeName: string;
  readonly attendeeEmail: string;
  readonly status: "registered" | "withdrawn";
  readonly registeredAt: string;
  readonly event: AvailableEvent;
  /** Whether a Withdraw control should be offered at all (SPM-84). */
  readonly canWithdraw: boolean;
}

/**
 * Domain objects to result DTO, the counterpart of `toAvailableEvent`.
 *
 * `canWithdraw` is computed here rather than left to the caller because it is a
 * business decision. A page that worked it out from `status` and the event
 * would be deciding, and deciding is not a driving adapter's job.
 */
export function toAttendeeRegistration(
  registration: Registration,
  event: Event,
): AttendeeRegistration {
  return {
    reference: registration.id,
    attendeeName: registration.attendeeName,
    attendeeEmail: registration.attendeeEmail,
    status: registration.status,
    registeredAt: registration.registeredAt.toISOString(),
    event: toAvailableEvent(event),
    canWithdraw: canWithdraw(registration, event),
  };
}
