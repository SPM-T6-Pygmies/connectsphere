import type { AvailableEvent } from "./available-event";

export interface ListEventsOpenForRegistrationResult {
  readonly events: readonly AvailableEvent[];
}

/**
 * Driving port: the public event programme.
 *
 * No command, because an Attendee supplies no parameters -- they see every
 * event that is open for registration and nothing else.
 */
export interface ListEventsOpenForRegistration {
  execute(): Promise<ListEventsOpenForRegistrationResult>;
}
