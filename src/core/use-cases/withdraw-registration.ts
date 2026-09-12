import { allowsWithdrawal } from "../domain/event";
import {
  EventAlreadyCompletedError,
  EventNotFoundError,
  RegistrationAlreadyWithdrawnError,
  RegistrationNotFoundError,
} from "../domain/errors";
import { isLive, registrationId, withdrawRegistration } from "../domain/registration";
import type { EventCatalogue } from "../ports/outbound/event-catalogue";
import type { RegistrationRepository } from "../ports/outbound/registration-repository";

import { toAttendeeRegistration, type AttendeeRegistration } from "./attendee-registration";

/**
 * The reference is the whole command.
 *
 * It identifies the registration and, in the absence of attendee accounts, is
 * also the only thing authorising the withdrawal -- see the note on
 * `attendee_registration` in the withdrawal migration.
 */
export interface WithdrawRegistrationCommand {
  readonly reference: string;
}

export interface WithdrawRegistrationResult {
  /** The registration as it now stands, so the confirmation can name the event (SPM-86). */
  readonly registration: AttendeeRegistration;
}

export interface WithdrawRegistrationDeps {
  readonly registrations: RegistrationRepository;
  readonly events: EventCatalogue;
}

/**
 * SPM-28's write path.
 *
 * As with `RegisterForEventUseCase`, every condition here is a predicate
 * defined elsewhere -- `isLive` and `allowsWithdrawal` -- and what is left is
 * the order the questions are asked in and which error a "no" becomes.
 *
 * The terminal-state check comes before the completed-event check on purpose.
 * "You already withdrew this" is a fact about what the attendee did and stays
 * true whatever the event went on to do, so a second submit after the event
 * finished says the honest thing rather than blaming the event.
 *
 * Releasing the place (SPM-85) needs no arithmetic here: `placesTaken` counts
 * only live registrations, so the status flip *is* the release.
 */
export class WithdrawRegistrationUseCase {
  constructor(private readonly deps: WithdrawRegistrationDeps) {}

  async execute(command: WithdrawRegistrationCommand): Promise<WithdrawRegistrationResult> {
    const { registrations, events } = this.deps;

    const reference = registrationId(command.reference);

    const registration = await registrations.findByReference(reference);
    if (registration === null) {
      throw new RegistrationNotFoundError(reference);
    }

    // Loaded before the refusals below because SPM-86 needs its name either way.
    const event = await events.findEvent(registration.eventId);
    if (event === null) {
      throw new EventNotFoundError(registration.eventId);
    }

    if (!isLive(registration)) {
      throw new RegistrationAlreadyWithdrawnError();
    }

    if (!allowsWithdrawal(event)) {
      throw new EventAlreadyCompletedError();
    }

    const withdrawn = withdrawRegistration(registration);
    await registrations.recordWithdrawal(withdrawn);

    return { registration: toAttendeeRegistration(withdrawn, event) };
  }
}
