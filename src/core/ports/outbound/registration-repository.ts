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

  /**
   * The registration a reference names, whatever its status.
   *
   * Unlike `findForAttendee` this deliberately does *not* narrow to live rows.
   * A withdrawn registration has to come back, or "already withdrawn" is
   * indistinguishable from "no such registration" and SPM-84's terminal state
   * becomes unreachable.
   */
  findByReference(reference: RegistrationId): Promise<Registration | null>;

  save(registration: Registration): Promise<void>;

  /**
   * Release the place this registration holds.
   *
   * Takes the whole withdrawn `Registration` rather than an id: given only an
   * id, an implementation would have to work out the resulting state itself,
   * which is a business rule and does not belong in an adapter. It is a
   * separate method from `save` because the store enforces different things for
   * the two -- `save` inserts and may lose a race for the last place, this one
   * updates a row that must already exist.
   */
  recordWithdrawal(registration: Registration): Promise<void>;
}
