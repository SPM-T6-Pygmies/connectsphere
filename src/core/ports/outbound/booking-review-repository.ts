import type {
  BookingId,
  BookingStatus,
  DecidedBooking,
  ResolvedHold,
} from "../../domain/booking";
import type { TimeRangeOnDate } from "../../domain/event-times";
import type { UserAccountId } from "../../domain/user-account";
import type { VenueId } from "../../domain/venue";

/** The three lists Venue Staff work from, by where a booking stands. */
export type BookingReviewSection = "requests" | "decided" | "archive";

/** The event a booking is for, as Venue Staff review the request against it. */
export interface BookedEvent {
  readonly id: string;
  /** The approved request the event came from; null if it has none. */
  readonly requestId: string | null;
  /** Its assigned Event Coordinator, told of the decision (SPM-62); null if unassigned. */
  readonly coordinatorUserAccountId: string | null;
  readonly name: string;
  readonly status: string;
  readonly organisationName: string | null;
  readonly category: string | null;
  readonly preferredDate: string | null;
  /** The event's own start and end times, in date then start order. Empty until it has any. */
  readonly times: readonly TimeRangeOnDate[];
  readonly expectedAttendance: number | null;
  readonly roomLayoutPreference: string | null;
  readonly accessibilityRequirements: string | null;
  readonly venueRequirements: string | null;
  readonly equipmentRequirements: string | null;
  readonly specialArrangements: string | null;
}

/** SPM-251 AC4: the flagged booking a re-request replaces, as Venue Staff read it beside the request. */
export interface ReplacedBooking {
  readonly id: BookingId;
  readonly venueLocation: string;
  /** In date then start order. */
  readonly times: readonly TimeRangeOnDate[];
  readonly status: BookingStatus;
}

/** One booking, as Venue Staff see it in a list or on its own page. */
export interface BookingForReview {
  readonly id: BookingId;
  readonly status: BookingStatus;
  readonly venueId: VenueId;
  readonly venueLocation: string;
  /** Null when the booking predates layout capture, or its venue has no layouts. */
  readonly roomLayoutName: string | null;
  /** In date then start order: touching slots joined into one time (SPM-324). */
  readonly times: readonly TimeRangeOnDate[];
  readonly requestedByName: string;
  /** ISO instant. */
  readonly requestedAt: string;
  readonly decidedByName: string | null;
  /** SPM-218: ISO instant a Tentative Hold lapses; null for any other status. */
  readonly holdExpiresAt: string | null;
  readonly rejectionNote: string | null;
  readonly suggestedAlternativeLocation: string | null;
  /** SPM-251: the flagged booking this re-request replaces; null for an ordinary request. */
  readonly replaces: ReplacedBooking | null;
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
   *
   * SPM-251 AC6: approving a re-request replaces the booking it names, in the
   * same transaction: that booking's open flags close as replaced, it becomes
   * Released and links to the re-request. One that no longer holds its venue
   * is left as it is. A hold on a re-request is refused (AC10).
   */
  decide(decided: DecidedBooking): Promise<void>;
  /**
   * SPM-219: records a hold confirmed or released. The store restates the rule
   * at its own boundary -- still a live hold -- so a hold that expired or was
   * decided while the page was open is refused with `HoldNotLiveError`.
   */
  resolveHold(resolved: ResolvedHold): Promise<void>;
}
