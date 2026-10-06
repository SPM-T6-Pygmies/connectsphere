import type { EventId } from "../../domain/event";
import type { RecordedSafetyCheck, SafetyCheckCandidate, SafetyCheckOutcome } from "../../domain/safety-check";
import type { UserAccountId } from "../../domain/user-account";

/** One of the event's Confirmed venue bookings, as the Safety Officer reviews it (SPM-260 AC1). */
export interface SafetyCheckVenue {
  readonly venueName: string;
  /** Null when the booking has no layout chosen. */
  readonly layoutName: string | null;
  /** The chosen layout's capacity at this venue. Null when there is no layout, or no capacity for it. */
  readonly layoutCapacity: number | null;
  /** The venue's own accessibility notes -- the nearest thing the model has to its restrictions. */
  readonly accessibility: string | null;
}

/** One equipment line, by the catalogue item it asks for (AC1). */
export interface SafetyCheckEquipment {
  readonly item: string;
  readonly quantityRequested: number;
  readonly quantityReserved: number;
}

/** An outcome already on record (AC5). */
export interface SafetyCheckEntry {
  readonly outcome: SafetyCheckOutcome;
  readonly comments: string | null;
  readonly checkedByName: string;
  /** ISO instant. */
  readonly checkedAt: string;
}

/** One event as a Safety Officer reviews it. */
export interface SafetyCheckReview {
  /** What `awaitsSafetyCheck` and `recordSafetyCheck` judge. */
  readonly candidate: SafetyCheckCandidate;
  readonly accessibilityRequirements: string | null;
  /** The event's assigned Event Coordinator, told the outcome (SPM-263). Null if it has none. */
  readonly coordinatorUserAccountId: string | null;
  /** Each Confirmed booking, by venue name. */
  readonly venues: readonly SafetyCheckVenue[];
  readonly equipment: readonly SafetyCheckEquipment[];
  /** Every outcome recorded on the event, newest first. */
  readonly checks: readonly SafetyCheckEntry[];
}

/**
 * Driven port: one event's safety check -- what the Safety Officer reviews and
 * the outcomes recorded on it (SPM-260). The list of events awaiting a check is
 * `SafetyCheckCandidateRepository`'s.
 */
export interface SafetyCheckRepository {
  /**
   * The event, or null when there is none. Takes the reader so a store can
   * re-check they are a Safety Officer, throwing `NotSafetyOfficerError` (AC7).
   */
  review(reader: UserAccountId, event: EventId): Promise<SafetyCheckReview | null>;
  /**
   * Stores an outcome, stamped with the time it is stored. The store restates
   * at its own boundary that the recorder is a Safety Officer and that the
   * event is still Planning and unchecked, so a second Officer racing the
   * first is refused with `EventNotAwaitingSafetyCheckError` (AC6).
   */
  record(check: RecordedSafetyCheck): Promise<void>;
}
