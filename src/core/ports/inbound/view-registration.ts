import type { AttendeeRegistration } from "./attendee-registration";

export interface ViewRegistrationCommand {
  readonly reference: string;
}

export interface ViewRegistrationResult {
  readonly registration: AttendeeRegistration;
}

/**
 * Driving port: one registration, as the Attendee holding its reference sees it.
 *
 * Separate from `ViewEventForRegistration` because it answers a different
 * question about a different object -- and because that use case refuses any
 * event not open for registration, which is most of the events a registration
 * points at by the time someone wants to withdraw.
 *
 * A withdrawn registration is returned, not refused: the page has to be able to
 * say "you withdrew this" rather than 404 on a link the attendee just used.
 */
export interface ViewRegistration {
  execute(command: ViewRegistrationCommand): Promise<ViewRegistrationResult>;
}
