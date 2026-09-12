import { z } from "zod";

import { registerForEventSchema } from "@/adapters/inbound/register-for-event-schema";
import {
  demoEventCatalogue,
  demoRegistrationRepository,
} from "@/adapters/outbound/in-memory/attendee-demo-seed";
import { createSupabaseServerClient } from "@/adapters/outbound/supabase/client";
import { SupabaseEventCatalogue } from "@/adapters/outbound/supabase/supabase-event-catalogue";
import { SupabaseRegistrationRepository } from "@/adapters/outbound/supabase/supabase-registration-repository";
import { systemClock } from "@/adapters/outbound/system/system-clock";
import { DomainError } from "@/core/domain/errors";
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
export async function registerForEvent(
  deps: RegisterForEventDeps,
  command: RegisterForEventCommand,
): Promise<RegisterForEventResult> {
  const { events, registrations, clock } = deps;

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

export type RegistrationState =
  | { status: "idle" }
  | { status: "registered"; registrationId: string; event: AvailableEvent }
  | {
      status: "error";
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
      /** Echoed back so a refused attempt does not make the attendee retype. */
      values: { fullName: string; email: string };
    };

/**
 * Adapter construction, formerly `attendeeAdapters()` in the composition root.
 *
 * With no container, every slice that needs these carries its own copy of the
 * environment branch. Four other use cases still call the container's version,
 * so at this rung the same decision is written down in two places.
 */
async function adapters(): Promise<RegisterForEventDeps> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return {
      events: demoEventCatalogue,
      registrations: demoRegistrationRepository,
      clock: systemClock,
    };
  }

  const client = await createSupabaseServerClient();
  return {
    events: new SupabaseEventCatalogue(client),
    registrations: new SupabaseRegistrationRepository(client),
    clock: systemClock,
  };
}

/**
 * The controller, inlined next to the use case it drives (the article's last
 * diagram). It parses, builds its own infrastructure and translates the result.
 *
 * The seam between this and `registerForEvent` above is the whole finding of
 * rung 3. The article inlines the use case *into* the controller; here it
 * cannot go the last inch, because a Server Action's arguments come from the
 * network and a test cannot hand it in-memory repositories. So the deps-taking
 * function survives -- which is to say the use case survives, one rung after we
 * claimed to have removed it.
 */
export async function registerForEventAction(
  _previous: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const submitted = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
  };

  const parsed = registerForEventSchema.safeParse({
    eventId: formData.get("eventId"),
    ...submitted,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values: submitted,
    };
  }

  try {
    const result = await registerForEvent(await adapters(), parsed.data);

    return { status: "registered", registrationId: result.registrationId, event: result.event };
  } catch (error) {
    // A refused registration -- full, closed, already registered -- is an
    // expected outcome and becomes a message the attendee can act on. Anything
    // else is a genuine fault and is allowed to reach the error boundary.
    if (error instanceof DomainError) {
      return { status: "error", message: error.message, values: submitted };
    }
    throw error;
  }
}
