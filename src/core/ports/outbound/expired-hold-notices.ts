import type { BookingId, SlotOnDate } from "../../domain/booking";

/** A hold that has expired and whose coordinator has not yet been told (SPM-254). */
export interface ExpiredHold {
  readonly bookingId: BookingId;
  readonly eventId: string;
  /** The approved request the event came from; null if it has none. */
  readonly eventRequestId: string | null;
  readonly eventName: string;
  /** The event's assigned Event Coordinator; null if unassigned. */
  readonly coordinatorUserAccountId: string | null;
  readonly venueLocation: string;
  /** Sorted by date, then by slot within the day. */
  readonly slots: readonly SlotOnDate[];
  /** ISO instant the hold lapsed. */
  readonly holdExpiresAt: string;
}

/**
 * Driven port: expired holds whose coordinator still needs to be told (SPM-254).
 *
 * This is a system read, not anyone's own. Claiming a hold marks it as told, so
 * no hold is returned twice, even when two claims run at the same time.
 */
export interface ExpiredHoldNotices {
  /** Expires whatever has lapsed, then claims every expired hold not yet announced. */
  claim(): Promise<readonly ExpiredHold[]>;
}
