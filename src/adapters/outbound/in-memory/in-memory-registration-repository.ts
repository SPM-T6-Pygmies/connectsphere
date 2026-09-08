import type { AttendeeEmail } from "@/core/domain/attendee";
import type { EventId } from "@/core/domain/event";
import {
  registrationId,
  type Registration,
  type RegistrationId,
} from "@/core/domain/registration";
import type { RegistrationRepository } from "@/core/ports/outbound/registration-repository";

export class InMemoryRegistrationRepository implements RegistrationRepository {
  private readonly rows = new Map<RegistrationId, Registration>();
  private sequence = 0;

  constructor(seed: readonly Registration[] = []) {
    for (const registration of seed) {
      this.rows.set(registration.id, registration);
    }
  }

  /**
   * Sequential and predictable, which is what makes the use-case tests able to
   * assert on the id they will get.
   *
   * It is therefore *not* a bearer token: once a reference addresses a page
   * that can withdraw (SPM-28), anyone can guess `registration-2`. Demo mode is
   * not a security boundary and must not be treated as one -- the Supabase
   * adapter mints a random UUID for exactly that reason.
   */
  nextId(): RegistrationId {
    this.sequence += 1;
    return registrationId(`registration-${this.sequence}`);
  }

  async placesTaken(eventId: EventId): Promise<number> {
    return this.live().filter((row) => row.eventId === eventId).length;
  }

  async findForAttendee(eventId: EventId, email: AttendeeEmail): Promise<Registration | null> {
    return (
      this.live().find((row) => row.eventId === eventId && row.attendeeEmail === email) ?? null
    );
  }

  /** Every row, not just the live ones -- see the port's note on why. */
  async findByReference(reference: RegistrationId): Promise<Registration | null> {
    return this.rows.get(reference) ?? null;
  }

  async save(registration: Registration): Promise<void> {
    this.rows.set(registration.id, registration);
  }

  /**
   * Same body as `save`, because a `Map` is indifferent to intent. The port is
   * not, and the Supabase twin proves it: there this is a different function
   * that refuses a reference it cannot find.
   */
  async recordWithdrawal(registration: Registration): Promise<void> {
    this.rows.set(registration.id, registration);
  }

  /** Test affordance, not part of the port. */
  all(): Registration[] {
    return [...this.rows.values()];
  }

  /** A withdrawn registration has released its place, so it counts for nothing. */
  private live(): Registration[] {
    return [...this.rows.values()].filter((row) => row.status === "registered");
  }
}
