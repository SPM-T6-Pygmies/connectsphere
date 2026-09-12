import type { SupabaseEventCatalogue } from "@/adapters/outbound/supabase/supabase-event-catalogue";
import type { SupabaseRegistrationRepository } from "@/adapters/outbound/supabase/supabase-registration-repository";
import type { systemClock } from "@/adapters/outbound/system/system-clock";
import { attendeeEmail, attendeeName } from "@/core/domain/attendee";
import { eventId, isFull, isOpenForRegistration } from "@/core/domain/event";
import {
  DuplicateRegistrationError,
  EventFullError,
  EventNotFoundError,
  EventNotOpenForRegistrationError,
} from "@/core/domain/errors";
import { blocksNewRegistration, registerAttendee } from "@/core/domain/registration";
import type { AvailableEvent } from "@/core/ports/inbound/available-event";
import { toAvailableEvent } from "@/core/use-cases/available-event";

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

/**
 * What this use case needs, stated as the subset of each adapter it calls.
 *
 * This is the article's "lose the ports" applied literally: no hand-written
 * interface anywhere, the concrete adapter class is the type.
 *
 * `Pick` rather than the class itself is not a stylistic choice. Naming the
 * class directly refuses every test double twice over: the double has no
 * `client` member (TS2741), and supplying one would not help either, because
 * `constructor(private readonly client)` makes the class type nominal, so even
 * a correctly shaped object is rejected (TS2322). `Pick` drops the private
 * member and the methods this slice never calls, which restores structural
 * assignability and is the only reason the test suite still runs without a
 * database.
 *
 * Note what this type actually is: the outbound port, respelled. It says the
 * same four method signatures, but as an expression coupled to a Supabase
 * class name rather than a file named after the capability.
 */
export interface RegisterForEventDeps {
  readonly events: Pick<SupabaseEventCatalogue, "findEvent">;
  readonly registrations: Pick<
    SupabaseRegistrationRepository,
    "nextId" | "findForAttendee" | "placesTaken" | "save"
  >;
  readonly clock: Pick<typeof systemClock, "now">;
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
