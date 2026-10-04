import type { BookingId, BookingStatus, DecidedBooking, SlotOnDate } from "../../domain/booking";
import type { UserAccountId } from "../../domain/user-account";
import type { VenueId } from "../../domain/venue";

/** The three lists Venue Staff work from, by where a booking stands. */
export type BookingReviewSection = "requests" | "decided" | "archive";

/** The event a booking is for, as Venue Staff review the request against it. */
export interface BookedEvent {
  readonly name: string;
  readonly status: string;
  readonly organisationName: string | null;
  readonly category: string | null;
  readonly preferredDate: string | null;
  /** ISO instants, or null when the event has no times yet. */
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly expectedAttendance: number | null;
  readonly roomLayoutPreference: string | null;
  readonly accessibilityRequirements: string | null;
  readonly venueRequirements: string | null;
  readonly equipmentRequirements: string | null;
  readonly specialArrangements: string | null;
}

/** One booking, as Venue Staff see it in a list or on its own page. */
export interface BookingForReview {
  readonly id: BookingId;
  readonly status: BookingStatus;
  readonly venueId: VenueId;
  readonly venueLocation: string;
  /** Null when the booking predates layout capture, or its venue has no layouts. */
  readonly roomLayoutName: string | null;
  readonly slots: readonly SlotOnDate[];
  readonly requestedByName: string;
  /** ISO instant. */
  readonly requestedAt: string;
  readonly decidedByName: string | null;
  readonly rejectionNote: string | null;
  readonly suggestedAlternativeLocation: string | null;
  readonly event: BookedEvent;
}

/**
 * Driven port: the booking requests Venue Staff review and decide.
 *
 * Every read is scoped to the staff member asking: someone who is not Venue
 * Staff gets an empty list and no booking, which callers treat exactly like a
 * booking that does not exist (#91).
 */
export interface BookingReviewRepository {
  list(staff: UserAccountId, section: BookingReviewSection): Promise<readonly BookingForReview[]>;
  find(staff: UserAccountId, id: BookingId): Promise<BookingForReview | null>;
  /**
   * Records a decision. The store restates the rules at its own boundary --
   * still waiting, and no slot held by another booking -- so a race the use
   * case could not see is refused with the domain's own errors.
   */
  decide(decided: DecidedBooking): Promise<void>;
}
