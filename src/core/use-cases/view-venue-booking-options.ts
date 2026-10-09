import { userAccountId } from "../domain/user-account";
import {
  checkVenueSuitability,
  suitabilityApplies,
  type EventNeeds,
  type VenueSuitability,
} from "../domain/venue-suitability";
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

/** SPM-45: how well one layout of one venue fits the event (a venue with no layouts has one entry, on no layout). */
export interface VenueLayoutSuitability {
  readonly venueId: string;
  readonly layout: string | null;
  readonly suitability: VenueSuitability;
}

export interface ViewVenueBookingOptionsResult {
  readonly event: CoordinatorEventDetails;
  readonly venues: readonly Venue[];
  readonly bookings: readonly EventBookingSummary[];
  /** SPM-45 AC3: a verdict for each venue and layout the coordinator could pick. */
  readonly venueSuitability: readonly VenueLayoutSuitability[];
  /** SPM-45 AC8: a verdict for each booking still in play, by booking id. Over bookings have none. */
  readonly bookingSuitability: Readonly<Record<string, VenueSuitability>>;
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
 *
 * SPM-45: it also works out how well each venue and layout, and each booking
 * still in play, fits the event's needs. Worked out on every read and never
 * stored, so a changed attendance or need shows the next time the page opens.
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

    const needs = eventNeeds(event);
    const venueSuitability = venues.flatMap((venue) =>
      (venue.layouts.length === 0 ? [null] : venue.layouts.map((layout) => layout.name)).map((layout) => ({
        venueId: venue.id,
        layout,
        suitability: checkVenueSuitability(venue, layout, needs),
      })),
    );

    const bookingSuitability: Record<string, VenueSuitability> = {};
    for (const booking of bookings) {
      const venue = venues.find((candidate) => candidate.id === booking.venueId);
      if (venue !== undefined && suitabilityApplies(booking.status)) {
        bookingSuitability[booking.id] = checkVenueSuitability(venue, booking.roomLayoutName, needs);
      }
    }

    return { event, venues, bookings, venueSuitability, bookingSuitability };
  }
}

function eventNeeds(event: CoordinatorEventDetails): EventNeeds {
  return {
    expectedAttendance: event.expectedAttendance,
    preferredLayout: event.roomLayoutPreference,
    accessibilityNeeds: event.accessibilityRequirements,
    requiredFacilities: event.requiredFacilities,
  };
}
