import type { BookingId, BookingStatus } from "../../domain/booking";
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
  /** The day and hours it is booked for, e.g. `2026-11-16 13:00 to 18:00`, whatever slot grid it is stored on. */
  readonly bookedFor: string;
  readonly reasonCode: FlagReasonCode;
  /** The reason as the coordinator reads it. */
  readonly detail: string;
  /** ISO instant. */
  readonly flaggedAt: string;
  /**
   * ISO instant the block behind this reason was lifted, or null while it is in force (or for a
   * reason that is not a block). A lift never clears the flag: this is how the page says so.
   */
  readonly sourceLiftedAt: string | null;
}

/** Driven port: the review flags on an event's venue bookings (SPM-313). */
export interface BookingFlagRepository {
  /**
   * The open flags on one of the coordinator's events, oldest first. Empty if the event
   * is not theirs, the same as an event that does not exist (#91).
   */
  openForEvent(coordinatorId: UserAccountId, eventId: string): Promise<readonly EventBookingFlag[]>;
}
