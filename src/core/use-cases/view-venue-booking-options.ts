import { userAccountId } from "../domain/user-account";
import type { BookingRepository, EventBookingSummary } from "../ports/outbound/booking-repository";
import type {
  CoordinatorEventDetails,
  CoordinatorEventRepository,
} from "../ports/outbound/coordinator-event-repository";
import type { Venue } from "../domain/venue";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";

export type { EventBookingSummary } from "../ports/outbound/booking-repository";
export type { CoordinatorEventDetails } from "../ports/outbound/coordinator-event-repository";
export type { Venue } from "../domain/venue";

export interface ViewVenueBookingOptionsCommand {
  /** The approved request the coordinator opened the event from. */
  readonly eventRequestId: string;
  readonly userAccountId: string;
}

export interface ViewVenueBookingOptionsResult {
  readonly event: CoordinatorEventDetails;
  readonly venues: readonly Venue[];
  readonly bookings: readonly EventBookingSummary[];
}

export interface ViewVenueBookingOptionsDeps {
  readonly events: CoordinatorEventRepository;
  readonly venues: VenueCatalogue;
  readonly bookings: BookingRepository;
}

/**
 * SPM-46: everything the coordinator's booking page shows -- the event's
 * timing and venue requirements, the venues to choose from, and the bookings
 * already raised for this event.
 *
 * Reached by the approved request's id, because that is how a coordinator
 * reaches an event today (events have no page of their own). A thin read
 * (ARCHITECTURE.md section 11): nothing here can say no except "not yours",
 * which the store's coordinator scoping answers as null (#91).
 */
export class ViewVenueBookingOptionsUseCase {
  constructor(private readonly deps: ViewVenueBookingOptionsDeps) {}

  async execute(
    command: ViewVenueBookingOptionsCommand,
  ): Promise<ViewVenueBookingOptionsResult | null> {
    const coordinatorId = userAccountId(command.userAccountId);
    const event = await this.deps.events.findAssignedByRequest(
      coordinatorId,
      command.eventRequestId,
    );
    if (event === null) {
      return null;
    }

    const [venues, bookings] = await Promise.all([
      this.deps.venues.list(),
      this.deps.bookings.listForEvent(coordinatorId, event.id),
    ]);

    return { event, venues, bookings };
  }
}
