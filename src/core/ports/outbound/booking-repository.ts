import type {
  BookingId,
  BookingRequest,
  BookingStatus,
  OccupiedSlot,
  SlotOnDate,
  VenueId,
} from "../../domain/booking";
import type { UserAccountId } from "../../domain/user-account";

/** One booking already raised for an event, as the coordinator's booking page lists it. */
export interface EventBookingSummary {
  readonly id: string;
  readonly venueLocation: string;
  /** Null when the booking predates layout capture, or its venue has no layouts. */
  readonly roomLayoutName: string | null;
  readonly status: BookingStatus;
  readonly slots: readonly SlotOnDate[];
  /** ISO instant. */
  readonly requestedAt: string;
}

/**
 * Driven port: venue bookings and the slots they sit on.
 *
 * `submit` is the only write. The store restates the request's rules at its
 * own boundary, so a race the use case could not see is still refused.
 */
export interface BookingRepository {
  /** Every booking at the venue touching any of these dates, whatever its status. */
  listSlotsAt(venue: VenueId, dates: readonly string[]): Promise<readonly OccupiedSlot[]>;
  /** The bookings raised for one of the coordinator's events; empty if it isn't theirs. */
  listForEvent(coordinatorId: UserAccountId, eventId: string): Promise<readonly EventBookingSummary[]>;
  submit(request: BookingRequest): Promise<BookingId>;
}
