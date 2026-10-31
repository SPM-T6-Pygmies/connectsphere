import { reRequestDraft, reRequestPending, type ReRequestDraft } from "../domain/booking-review-flag";
import { userAccountId } from "../domain/user-account";
import {
  checkVenueSuitability,
  suitabilityApplies,
  type EventNeeds,
  type VenueSuitability,
} from "../domain/venue-suitability";
import type { BookingFlagRepository, EventBookingFlag } from "../ports/outbound/booking-flag-repository";
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
  readonly eventId: string;
  readonly userAccountId: string;
  /** SPM-251: the flagged booking the coordinator chose to re-request, if any. */
  readonly reRequesting?: string;
}

/** SPM-251 AC2: a re-request the form starts from, and the flagged booking it replaces. */
export interface ReRequestStart extends ReRequestDraft {
  readonly bookingId: string;
  readonly venueLocation: string;
  /** The day and hours the flagged booking holds, e.g. `2026-11-16 13:00 to 18:00`. */
  readonly bookedFor: string;
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
  /** SPM-313: each open reason a booking of this event is flagged for, oldest first. Match them to a row by `bookingId`. */
  readonly flaggedBookings: readonly EventBookingFlag[];
  /** SPM-251 AC9: the flagged bookings with a re-request waiting for Venue Staff. */
  readonly reRequestsWaiting: readonly string[];
  /**
   * SPM-251 AC1, AC2: the re-request asked for, if that booking has an open flag and none
   * waiting; null otherwise, and the form is the ordinary one.
   */
  readonly reRequest: ReRequestStart | null;
}

export interface ViewVenueBookingOptionsDeps {
  readonly events: CoordinatorEventRepository;
  readonly venues: VenueCatalogue;
  readonly bookings: BookingRepository;
  /** SPM-313: the review flags on the event's venue bookings. */
  readonly flags: BookingFlagRepository;
}

/**
 * SPM-46: everything the coordinator's booking page shows -- the event's
 * timing and venue requirements, the venues to choose from, and the bookings
 * already raised for this event.
 *
 * Reached by the event's id (SPM-459: the event page's Venue tab), so an
 * event with no source request can be booked too. A thin read
 * (ARCHITECTURE.md section 11): nothing here can say no except "not yours",
 * which the store's coordinator scoping answers as null (#91).
 *
 * SPM-45: it also works out how well each venue and layout, and each booking
 * still in play, fits the event's needs. Worked out on every read and never
 * stored, so a changed attendance or need shows the next time the page opens.
 *
 * SPM-251: and, when the coordinator asked to re-request a flagged booking,
 * what the form starts from (`reRequestDraft`).
 */
export class ViewVenueBookingOptionsUseCase {
  constructor(private readonly deps: ViewVenueBookingOptionsDeps) {}

  async execute(
    command: ViewVenueBookingOptionsCommand,
  ): Promise<ViewVenueBookingOptionsResult | null> {
    const coordinatorId = userAccountId(command.userAccountId);
    const event = await this.deps.events.findAssigned(coordinatorId, command.eventId);
    if (event === null) {
      return null;
    }

    const [venues, bookings, flaggedBookings] = await Promise.all([
      this.deps.venues.list(),
      this.deps.bookings.listForEvent(coordinatorId, event.id),
      this.deps.flags.openForEvent(coordinatorId, event.id),
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

    const flaggedIds = [...new Set(flaggedBookings.map((flag) => flag.bookingId as string))];
    const reRequestsWaiting = flaggedIds.filter((id) => reRequestPending(bookings, id));

    return {
      event,
      venues,
      bookings,
      venueSuitability,
      bookingSuitability,
      flaggedBookings,
      reRequestsWaiting,
      reRequest: this.reRequestStart(command.reRequesting, event, venues, bookings, flaggedBookings, reRequestsWaiting),
    };
  }

  private reRequestStart(
    bookingId: string | undefined,
    event: CoordinatorEventDetails,
    venues: readonly Venue[],
    bookings: readonly EventBookingSummary[],
    flags: readonly EventBookingFlag[],
    waiting: readonly string[],
  ): ReRequestStart | null {
    const flag = flags.find((candidate) => candidate.bookingId === bookingId);
    const flagged = bookings.find((booking) => booking.id === bookingId);
    if (flag === undefined || flagged === undefined || waiting.includes(flagged.id)) {
      return null;
    }
    return {
      bookingId: flagged.id,
      venueLocation: flagged.venueLocation,
      bookedFor: flag.bookedFor,
      ...reRequestDraft(event, flagged, venues.find((venue) => venue.id === flagged.venueId)),
    };
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
