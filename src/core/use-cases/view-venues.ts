import { VenueNotFoundError } from "../domain/errors";
import { venueId, type Venue } from "../domain/venue";
import type { VenueCatalogue } from "../ports/outbound/venue-catalogue";

export interface ViewVenuesDeps {
  readonly venues: VenueCatalogue;
}

export interface ListVenuesResult {
  readonly venues: readonly Venue[];
}

export interface ViewVenueResult {
  readonly venue: Venue;
}

/**
 * SPM-42: the catalogue as Venue Staff, and Event Coordinators evaluating a
 * venue, read it.
 *
 * Thin read slices (ARCHITECTURE.md section 11): no rule decides what is
 * listed, so each is one port call.
 */
export class ListVenuesUseCase {
  constructor(private readonly deps: ViewVenuesDeps) {}

  async execute(): Promise<ListVenuesResult> {
    return { venues: await this.deps.venues.list() };
  }
}

export class ViewVenueUseCase {
  constructor(private readonly deps: ViewVenuesDeps) {}

  async execute(command: { readonly venueId: string }): Promise<ViewVenueResult> {
    const venue = await this.deps.venues.find(venueId(command.venueId));
    if (venue === null) {
      throw new VenueNotFoundError();
    }
    return { venue };
  }
}
