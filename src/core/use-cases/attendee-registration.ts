import type { Event } from "../domain/event";
import { canWithdraw, type Registration } from "../domain/registration";
import type { AttendeeRegistration } from "../ports/inbound/attendee-registration";

import { toAvailableEvent } from "./available-event";

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
