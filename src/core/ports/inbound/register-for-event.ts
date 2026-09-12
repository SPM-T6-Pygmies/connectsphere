import type { AvailableEvent } from "../../use-cases/available-event";

/** Full name and email, and nothing else (SPM-83). */
export interface RegisterForEventCommand {
  readonly eventId: string;
  readonly fullName: string;
  readonly email: string;
}

export interface RegisterForEventResult {
  readonly registrationId: string;
  readonly registeredAt: string;
  /**
   * The event as the server knows it, so the confirmation the Attendee sees
   * (SPM-82) reports what was actually recorded rather than echoing the form.
   */
  readonly event: AvailableEvent;
}

export interface RegisterForEvent {
  execute(command: RegisterForEventCommand): Promise<RegisterForEventResult>;
}
