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

  async save(registration: Registration): Promise<void> {
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
