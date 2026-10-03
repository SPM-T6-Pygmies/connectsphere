import type { VenueOption, VenueRepository } from "../ports/outbound/venue-repository";

export type { VenueOption } from "../ports/outbound/venue-repository";

export interface ListVenuesForBookingResult {
  readonly venues: readonly VenueOption[];
}

export interface ListVenuesForBookingDeps {
  readonly venues: VenueRepository;
}

/**
 * SPM-46: every venue a Coordinator can pick from on the booking form, with
 * each supported layout's capacity.
 *
 * A thin read slice (ARCHITECTURE.md §11): no venue search/filtering
 * (SPM-44) exists yet, so nothing in the domain decides which venues appear
 * -- the repository answers with the view itself.
 */
export class ListVenuesForBookingUseCase {
  constructor(private readonly deps: ListVenuesForBookingDeps) {}

  async execute(): Promise<ListVenuesForBookingResult> {
    return { venues: await this.deps.venues.listForBooking() };
  }
}
