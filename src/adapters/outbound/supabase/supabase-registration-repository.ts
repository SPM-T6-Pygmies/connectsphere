import type { AttendeeEmail } from "@/core/domain/attendee";
import { DuplicateRegistrationError, EventFullError } from "@/core/domain/errors";
import type { EventId } from "@/core/domain/event";
import { registrationId, type Registration, type RegistrationId } from "@/core/domain/registration";
import type { RegistrationRepository } from "@/core/ports/outbound/registration-repository";

import type { SupabaseServerClient } from "./client";
import { toKey } from "./event-mapper";
import { toDomain, toRegisterArgs, type RegistrationRow } from "./registration-mapper";

/**
 * Registrations are reached through database functions, not through the table.
 *
 * `registration` holds attendee names and emails, which brief s8b classes as
 * protected information, and the key this client holds is publishable. So
 * `anon` has no grant on that table at all: these three functions are the whole
 * surface, and none of them can return a row the caller did not already
 * identify. There is no request an attendee can make that yields the attendee
 * list.
 *
 * That the port is unchanged is the point -- the core still asks for a place at
 * an event and knows nothing about how the store defends itself.
 */
/** SQLSTATEs `attendee_register` can come back with. See its migration. */
const UNIQUE_VIOLATION = "23505";
const EVENT_FULL = "CS001";

export class SupabaseRegistrationRepository implements RegistrationRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  nextId(): RegistrationId {
    // Lands in registration_reference. The team's bigint primary key is
    // `generated always as identity` and cannot carry a value we chose, so the
    // reference is what the domain's id actually is.
    return registrationId(crypto.randomUUID());
  }

  async placesTaken(eventId: EventId): Promise<number> {
    const key = toKey(eventId);
    if (key === null) {
      return 0;
    }

    // A withdrawn registration has released its place, so only live rows count.
    // The function does that counting; it returns a number and never a row.
    const { data, error } = await this.client.rpc("attendee_places_taken", {
      p_event_id: key,
    });

    if (error) {
      throw new Error(`Failed to count registrations: ${error.message}`, { cause: error });
    }

    return (data as number | null) ?? 0;
  }

  async findForAttendee(eventId: EventId, email: AttendeeEmail): Promise<Registration | null> {
    const key = toKey(eventId);
    if (key === null) {
      return null;
    }

    // `attendeeEmail` already lower-cased the value, which is what the
    // registration_one_live_per_attendee_email_uidx index is built on.
    const { data, error } = await this.client.rpc("attendee_live_registration", {
      p_event_id: key,
      p_email: email,
    });

    if (error) {
      throw new Error(`Failed to look up registration: ${error.message}`, { cause: error });
    }

    const rows = (data ?? []) as unknown as RegistrationRow[];
    return rows.length > 0 ? toDomain(rows[0]) : null;
  }

  async save(registration: Registration): Promise<void> {
    const key = toKey(registration.eventId);
    if (key === null) {
      throw new Error(`Cannot save a registration for unknown event "${registration.eventId}".`);
    }

    const { error } = await this.client.rpc("attendee_register", toRegisterArgs(registration, key));

    if (error) {
      // The use case already asked both questions and was told yes, so a
      // refusal here means the answer changed between the read and the write:
      // the last place went, or the same email registered. Translating them
      // back into the domain's own errors is what makes a lost race look to
      // the attendee exactly like losing it a second earlier -- "this event is
      // full", not a 500.
      if (error.code === EVENT_FULL) {
        throw new EventFullError();
      }
      if (error.code === UNIQUE_VIOLATION) {
        throw new DuplicateRegistrationError(registration.attendeeEmail);
      }
      throw new Error(`Failed to save registration: ${error.message}`, { cause: error });
    }
  }
}
