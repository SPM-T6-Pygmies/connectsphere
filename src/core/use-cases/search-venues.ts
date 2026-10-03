import {
  calendarDate,
  defineVenueSearch,
  searchVenues,
  type BookedSlot,
  type VenueSearchInput,
  type VenueSearchOutcome,
} from "../domain/venue-search";
import type { Clock } from "../ports/outbound/clock";
import type { VenueAvailability } from "../ports/outbound/venue-availability";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";

export interface SearchVenuesDeps {
  readonly venues: VenueCatalogue;
  readonly availability: VenueAvailability;
  readonly clock: Clock;
  /** IANA zone "today" is read in, e.g. `"Asia/Singapore"`. */
  readonly timeZone: string;
}

/** Candidates only -- no suitability verdict (#83) -- and why the rest were left out. */
export type SearchVenuesResult = VenueSearchOutcome;

/**
 * SPM-44: an Event Coordinator narrows the catalogue by attributes and by when
 * the event runs. Bookings are only fetched when a date and slots are given.
 *
 * Throws `InvalidVenueSearchError` for criteria that cannot be searched on.
 */
export class SearchVenuesUseCase {
  constructor(private readonly deps: SearchVenuesDeps) {}

  async execute(command: VenueSearchInput): Promise<SearchVenuesResult> {
    const { venues, availability, clock, timeZone } = this.deps;
    const today = calendarDate(clock.now(), timeZone);
    const criteria = defineVenueSearch(command, today);

    let booked: readonly BookedSlot[] = [];
    if (criteria.window !== null) {
      booked = await availability.bookedSlots(criteria.window.date);
    }

    return searchVenues(await venues.list(), criteria, booked, today);
  }
}
