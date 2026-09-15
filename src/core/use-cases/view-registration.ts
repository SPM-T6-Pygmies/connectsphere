import { EventNotFoundError, RegistrationNotFoundError } from "../domain/errors";
import { registrationId } from "../domain/registration";
import type { EventCatalogue } from "../ports/outbound/event-catalogue";
import type { RegistrationRepository } from "../ports/outbound/registration-repository";

import { toAttendeeRegistration, type AttendeeRegistration } from "./attendee-registration";

export interface ViewRegistrationCommand {
  readonly reference: string;
}

export interface ViewRegistrationResult {
  readonly registration: AttendeeRegistration;
}

export interface ViewRegistrationDeps {
  readonly registrations: RegistrationRepository;
  readonly events: EventCatalogue;
}

/**
 * What the reference link resolves to (SPM-28's entry point).
 *
 * No `Clock`, unlike the event read paths: the only thing standing between an
 * attendee and withdrawal is the event's status, and a status is not a window.
 *
 * A withdrawn registration is a success here, not a refusal. Refusing it would
 * make the link the attendee just followed look broken at exactly the moment
 * they want confirmation that their place was released.
 *
 * Separate from `ViewEventForRegistrationUseCase` because it answers a different
 * question about a different object -- and because that use case refuses any
 * event not open for registration, which is most of the events a registration
 * points at by the time someone wants to withdraw.
 */
export class ViewRegistrationUseCase {
  constructor(private readonly deps: ViewRegistrationDeps) {}

  async execute(command: ViewRegistrationCommand): Promise<ViewRegistrationResult> {
    const { registrations, events } = this.deps;

    const reference = registrationId(command.reference);

    const registration = await registrations.findByReference(reference);
    if (registration === null) {
      throw new RegistrationNotFoundError(reference);
    }

    const event = await events.findEvent(registration.eventId);
    if (event === null) {
      throw new EventNotFoundError(registration.eventId);
    }

    return { registration: toAttendeeRegistration(registration, event) };
  }
}
