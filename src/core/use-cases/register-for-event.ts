import { attendeeEmail, attendeeName } from "../domain/attendee";
import { eventId, isFull, isOpenForRegistration } from "../domain/event";
import {
  DuplicateRegistrationError,
  EventFullError,
  EventNotFoundError,
  EventNotOpenForRegistrationError,
} from "../domain/errors";
import { blocksNewRegistration, registerAttendee } from "../domain/registration";
import type { AvailableEvent } from "../ports/inbound/available-event";
import type { Clock } from "../ports/outbound/clock";
import type { EventCatalogue } from "../ports/outbound/event-catalogue";
import type { RegistrationRepository } from "../ports/outbound/registration-repository";
import { toAvailableEvent } from "./available-event";

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
export class RegisterForEventUseCase {
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
