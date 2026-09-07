import { attendeeEmail, attendeeName } from "../domain/attendee";
import { eventId, isFull, isOpenForRegistration } from "../domain/event";
import {
  DuplicateRegistrationError,
  EventFullError,
  EventNotFoundError,
  EventNotOpenForRegistrationError,
} from "../domain/errors";
import { blocksNewRegistration, registerAttendee } from "../domain/registration";
import type {
  RegisterForEvent,
  RegisterForEventCommand,
  RegisterForEventResult,
} from "../ports/inbound/register-for-event";
import type { Clock } from "../ports/outbound/clock";
import type { EventCatalogue } from "../ports/outbound/event-catalogue";
import type { RegistrationRepository } from "../ports/outbound/registration-repository";
import { toAvailableEvent } from "./available-event";

export interface RegisterForEventDeps {
  readonly events: EventCatalogue;
  readonly registrations: RegistrationRepository;
  readonly clock: Clock;
}

/**
 * SPM-24's write path.
 *
 * Every condition it enforces is a predicate defined elsewhere:
 * `isOpenForRegistration` (SPM-79), `isFull` (SPM-81) and
 * `blocksNewRegistration`. What is left here is the order the questions are
 * asked in and which error a "no" becomes.
 *
 * The window is re-checked rather than trusted from the page that rendered the
 * form: a coordinator can close registration between the two requests.
 */
export class RegisterForEventUseCase implements RegisterForEvent {
  constructor(private readonly deps: RegisterForEventDeps) {}

  async execute(command: RegisterForEventCommand): Promise<RegisterForEventResult> {
    const { events, registrations, clock } = this.deps;

    // The smart constructors run before any I/O, so a blank name costs nothing.
    const id = eventId(command.eventId);
    const name = attendeeName(command.fullName);
    const email = attendeeEmail(command.email);

    const event = await events.findEvent(id);
    if (event === null) {
      throw new EventNotFoundError(id);
    }

    const now = clock.now();
    if (!isOpenForRegistration(event, now)) {
      throw new EventNotOpenForRegistrationError(event.name);
    }

    const existing = await registrations.findForAttendee(id, email);
    if (existing !== null && blocksNewRegistration(existing)) {
      throw new DuplicateRegistrationError(email);
    }

    // Release 1 has no waiting list, so a full event is simply refused.
    if (isFull(event, await registrations.placesTaken(id))) {
      throw new EventFullError();
    }

    const registration = registerAttendee({
      id: registrations.nextId(),
      eventId: id,
      attendeeName: name,
      attendeeEmail: email,
      registeredAt: now,
    });

    await registrations.save(registration);

    return {
      registrationId: registration.id,
      registeredAt: registration.registeredAt.toISOString(),
      event: toAvailableEvent(event),
    };
  }
}
