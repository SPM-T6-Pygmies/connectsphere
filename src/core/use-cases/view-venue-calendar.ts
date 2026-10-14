import { VenueNotFoundError } from "../domain/errors";
import type { Venue } from "../domain/venue";
import { venueId } from "../domain/venue";
import {
  addDays,
  CALENDAR_WEEK_DAYS,
  calendarDays,
  deriveVenueCalendar,
  type CalendarDay,
} from "../domain/venue-calendar";
import { calendarDate } from "../domain/venue-search";
import type { BookingRepository } from "../ports/outbound/booking-repository";
import type { Clock } from "../ports/outbound/clock";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";
import type { VenueUnavailabilityRepository } from "../ports/outbound/venue-unavailability-repository";

export interface ViewVenueCalendarDeps {
  readonly venues: VenueCatalogue;
  readonly bookings: BookingRepository;
  readonly blocks: VenueUnavailabilityRepository;
  readonly clock: Clock;
  /** IANA zone the venue's days are in, e.g. `"Asia/Singapore"`. */
  readonly timeZone: string;
}

export interface ViewVenueCalendarCommand {
  readonly venueId: string;
  /** First day shown, `YYYY-MM-DD`; null for today in the venue's zone. */
  readonly from: string | null;
}

export interface VenueCalendar {
  readonly venue: Venue;
  readonly from: string;
  readonly to: string;
  readonly days: readonly CalendarDay[];
}

/**
 * SPM-43: one week of a venue's calendar, from `from`, as an Event Coordinator
 * sees it before asking for a booking. Every call reads the bookings and
 * blocks afresh, so the calendar is never a stale snapshot (AC3).
 *
 * Throws `VenueNotFoundError` for a venue not in the catalogue and
 * `InvalidCalendarRangeError` for a `from` that is not a date.
 */
export class ViewVenueCalendarUseCase {
  constructor(private readonly deps: ViewVenueCalendarDeps) {}

  async execute(command: ViewVenueCalendarCommand): Promise<VenueCalendar> {
    const { venues, bookings, blocks, clock, timeZone } = this.deps;
    const now = clock.now();
    const from = command.from ?? calendarDate(now, timeZone);
    const to = addDays(from, CALENDAR_WEEK_DAYS - 1);
    const days = calendarDays(from, to);

    const venue = await venues.find(venueId(command.venueId));
    if (venue === null) {
      throw new VenueNotFoundError();
    }

    const [occupied, blocked] = await Promise.all([
      bookings.listSlotsAt(venue.id, days),
      blocks.blockedBetween(venue.id, from, to),
    ]);

    return {
      venue,
      from,
      to,
      days: deriveVenueCalendar({ days, offeredSlots: venue.slots, occupied, blocked, now }),
    };
  }
}
