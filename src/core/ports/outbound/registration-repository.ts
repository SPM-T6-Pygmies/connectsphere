import type { AttendeeEmail } from "../../domain/attendee";
import type { EventId } from "../../domain/event";
import type { Registration, RegistrationId } from "../../domain/registration";

/**
 * Driven port: registration persistence.
 *
 * `placesTaken` answers a question about the business and returns a fact. It
 * deliberately does not answer "is this event full?" -- that is a decision, and
 * decisions live in the domain.
 */
export interface RegistrationRepository {
  nextId(): RegistrationId;

  /** How many places are currently held for this event. */
  placesTaken(eventId: EventId): Promise<number>;

  findForAttendee(eventId: EventId, email: AttendeeEmail): Promise<Registration | null>;

  save(registration: Registration): Promise<void>;
}
