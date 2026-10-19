import type { BookingId, BookingStatus, SlotOnDate } from "../../domain/booking";
import type { FlagReasonCode } from "../../domain/booking-review-flag";
import type { UserAccountId } from "../../domain/user-account";

/**
 * SPM-313: one open reason a booking of the coordinator's event is flagged for. A booking
 * flagged for two reasons comes back as two of these. The booking's own status is as it
 * was: a flag sits beside it and changes nothing.
 */
export interface EventBookingFlag {
  readonly flagId: string;
  readonly bookingId: BookingId;
  readonly venueLocation: string;
  readonly status: BookingStatus;
  /** ISO instant a Tentative Hold lapses; null for any other status. */
  readonly holdExpiresAt: string | null;
  readonly slots: readonly SlotOnDate[];
  readonly reasonCode: FlagReasonCode;
  /** The reason as the coordinator reads it. */
  readonly detail: string;
  /** ISO instant. */
  readonly flaggedAt: string;
}

/** Driven port: the review flags on an event's venue bookings (SPM-313). */
export interface BookingFlagRepository {
  /**
   * The open flags on one of the coordinator's events, oldest first. Empty if the event
   * is not theirs, the same as an event that does not exist (#91).
   */
  openForEvent(coordinatorId: UserAccountId, eventId: string): Promise<readonly EventBookingFlag[]>;
}
