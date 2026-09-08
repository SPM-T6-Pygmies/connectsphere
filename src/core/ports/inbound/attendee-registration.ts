import type { AvailableEvent } from "./available-event";

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
