import type { BookingId } from "@/core/domain/booking";
import type { EventId } from "@/core/domain/event";
import type { SafetyCheckCandidate } from "@/core/domain/safety-check";
import { userAccountId, type UserAccountId } from "@/core/domain/user-account";
import type { SafetyCheckWatch } from "@/core/ports/outbound/safety-check-watch";

/**
 * Seeded with events and the bookings that belong to them. `set` replaces an
 * event, so a test can stand in for the change a use case makes.
 */
export class InMemorySafetyCheckWatch implements SafetyCheckWatch {
  private readonly events = new Map<string, SafetyCheckCandidate>();
  private readonly officers: readonly UserAccountId[];

  constructor(
    seed: readonly SafetyCheckCandidate[] = [],
    officers: readonly string[] = [],
    /** Booking id to the id of the event it is for. */
    private readonly bookings: Readonly<Record<string, string>> = {},
  ) {
    seed.forEach((candidate) => this.set(candidate));
    this.officers = officers.map(userAccountId);
  }

  set(candidate: SafetyCheckCandidate): void {
    this.events.set(candidate.event.id, candidate);
  }

  async candidateForEvent(id: EventId): Promise<SafetyCheckCandidate | null> {
    return this.events.get(id) ?? null;
  }

  async candidateForBooking(id: BookingId): Promise<SafetyCheckCandidate | null> {
    const event = this.bookings[id];
    return event === undefined ? null : (this.events.get(event) ?? null);
  }

  async safetyOfficers(): Promise<readonly UserAccountId[]> {
    return this.officers;
  }
}
