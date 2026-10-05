import type { BookingId } from "../../domain/booking";
import type { EventId } from "../../domain/event";
import type { SafetyCheckCandidate } from "../../domain/safety-check";
import type { UserAccountId } from "../../domain/user-account";

/**
 * Driven port: what a change to an event's arrangements needs to tell whether
 * it put the event on the Safety Officer's list, and who to tell (SPM-262).
 *
 * A system read, not a Safety Officer's: the change is made by Venue Staff or
 * a coordinator, who never see the list themselves. Separate from
 * `SafetyCheckCandidateRepository`, which reads the whole list as its Safety
 * Officer.
 */
export interface SafetyCheckWatch {
  /** The event, with what `awaitsSafetyCheck` judges it on. Null when there is no such event. */
  candidateForEvent(id: EventId): Promise<SafetyCheckCandidate | null>;
  /** The same, for the event a booking is for, on the event itself or one of its sessions. */
  candidateForBooking(id: BookingId): Promise<SafetyCheckCandidate | null>;
  /** Every account holding the Safety Officer role (AC4). */
  safetyOfficers(): Promise<readonly UserAccountId[]>;
}
