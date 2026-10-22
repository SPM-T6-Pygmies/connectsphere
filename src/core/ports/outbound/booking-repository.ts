import type {
  BookingId,
  BookingRequest,
  BookingStatus,
  OccupiedTime,
} from "../../domain/booking";
import type { TimeRangeOnDate } from "../../domain/event-times";
import type { UserAccountId } from "../../domain/user-account";
import type { VenueId } from "../../domain/venue";

/** One booking already raised for an event, as the coordinator's booking page lists it. */
export interface EventBookingSummary {
  readonly id: string;
  readonly venueId: VenueId;
  readonly venueLocation: string;
  /** Null when the booking predates layout capture, or its venue has no layouts. */
  readonly roomLayoutName: string | null;
  readonly status: BookingStatus;
  /** SPM-218: ISO instant a Tentative Hold lapses; null for any other status. */
  readonly holdExpiresAt: string | null;
  /** In date then start order: touching slots joined into one time (SPM-324). */
  readonly times: readonly TimeRangeOnDate[];
  /** ISO instant. */
  readonly requestedAt: string;
  /** Venue Staff's reason for a rejection (SPM-62 AC2); null otherwise. */
  readonly rejectionNote: string | null;
  /** The venue Venue Staff suggested instead -- informal, it books nothing (#45). */
  readonly suggestedAlternative: { readonly venueId: VenueId; readonly location: string } | null;
}

/**
 * Driven port: venue bookings and the times they hold.
 *
 * `submit`, `changeRoomLayout` and `cancel` are the only writes. The store restates the request's rules at its
 * own boundary, so a race the use case could not see is still refused.
 */
export interface BookingRepository {
  /**
   * Every booking at the venue touching any of these dates, whatever its
   * status: one entry per 15-minute slot, so a caller compares by overlap.
   */
  listSlotsAt(venue: VenueId, dates: readonly string[]): Promise<readonly OccupiedTime[]>;
  /** The bookings raised for one of the coordinator's events; empty if it isn't theirs. */
  listForEvent(coordinatorId: UserAccountId, eventId: string): Promise<readonly EventBookingSummary[]>;
  submit(request: BookingRequest): Promise<BookingId>;
  /**
   * SPM-104: move a request that is still pending to another layout the venue
   * supports. The store restates both rules at its own boundary. A venue with
   * no layouts on record leaves nothing to set, so `roomLayout` may be null.
   */
  changeRoomLayout(
    coordinatorId: UserAccountId,
    bookingId: string,
    roomLayout: string | null,
  ): Promise<void>;
  /**
   * SPM-20: release a booking on one of the coordinator's events, freeing its
   * slots. The store restates `cancelBooking`'s rule at its own boundary.
   */
  cancel(coordinatorId: UserAccountId, bookingId: string): Promise<void>;
}
