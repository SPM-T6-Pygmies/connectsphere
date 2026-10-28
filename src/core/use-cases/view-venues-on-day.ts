import type { Venue } from "../domain/venue";
import { calendarDays, deriveVenueCalendar, type CalendarPeriod } from "../domain/venue-calendar";
import { calendarDate } from "../domain/venue-search";
import type { BookingRepository } from "../ports/outbound/booking-repository";
import type { Clock } from "../ports/outbound/clock";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";
import type { VenueUnavailabilityRepository } from "../ports/outbound/venue-unavailability-repository";

export interface ViewVenuesOnDayDeps {
  readonly venues: VenueCatalogue;
  readonly bookings: BookingRepository;
  readonly blocks: VenueUnavailabilityRepository;
  readonly clock: Clock;
  /** IANA zone the venues' days are in, e.g. `"Asia/Singapore"`. */
  readonly timeZone: string;
}

export interface ViewVenuesOnDayCommand {
  /** The day shown, `YYYY-MM-DD`; null for today in the venues' zone. */
  readonly date: string | null;
}

export interface VenuesOnDay {
  readonly date: string;
  /** Every venue in the catalogue, in its order, with the day's periods. */
  readonly venues: readonly { readonly venue: Venue; readonly periods: readonly CalendarPeriod[] }[];
}

/**
 * SPM-323: every venue's calendar for one day, side by side, so a Coordinator
 * can compare venues for a date before opening one. Each venue's periods are
 * the same as its own calendar shows that day, read afresh (AC4).
 *
 * Throws `InvalidCalendarRangeError` for a `date` that is not a date.
 */
export class ViewVenuesOnDayUseCase {
  constructor(private readonly deps: ViewVenuesOnDayDeps) {}

  async execute(command: ViewVenuesOnDayCommand): Promise<VenuesOnDay> {
    const { venues, bookings, blocks, clock, timeZone } = this.deps;
    const now = clock.now();
    const date = command.date ?? calendarDate(now, timeZone);
    const days = calendarDays(date, date);

    const listed = await venues.list();
    return {
      date,
      venues: await Promise.all(
        listed.map(async (venue) => {
          const [occupied, blocked] = await Promise.all([
            bookings.listSlotsAt(venue.id, days),
            blocks.blockedBetween(venue.id, date, date),
          ]);
          const [day] = deriveVenueCalendar({ days, openingHours: venue.openingHours, occupied, blocked, now });
          return { venue, periods: day?.periods ?? [] };
        }),
      ),
    };
  }
}
