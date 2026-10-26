import { VenueNotFoundError } from "@/core/domain/errors";
import { venueId, venueNameKey, venueNameTaken, type Venue, type VenueDetails, type VenueId } from "@/core/domain/venue";
import type { VenueCatalogue } from "@/core/ports/outbound/venue-catalogue";

/** A `Map`-backed catalogue that obeys the same contract as the Supabase one. */
export class InMemoryVenueCatalogue implements VenueCatalogue {
  private readonly rows = new Map<VenueId, Venue>();
  private sequence = 0;

  constructor(seed: readonly Venue[] = []) {
    for (const venue of seed) {
      this.rows.set(venue.id, venue);
    }
  }

  async list(): Promise<readonly Venue[]> {
    return [...this.rows.values()].sort((a, b) => a.location.localeCompare(b.location));
  }

  async find(id: VenueId): Promise<Venue | null> {
    return this.rows.get(id) ?? null;
  }

  async add(details: VenueDetails): Promise<Venue> {
    this.refuseTakenLocation(details.location);
    this.sequence += 1;
    const venue: Venue = { id: venueId(`venue-${this.sequence}`), ...details };
    this.rows.set(venue.id, venue);
    return venue;
  }

  async revise(id: VenueId, details: VenueDetails): Promise<Venue> {
    if (!this.rows.has(id)) {
      throw new VenueNotFoundError();
    }
    this.refuseTakenLocation(details.location, id);
    const venue: Venue = { id, ...details };
    this.rows.set(id, venue);
    return venue;
  }

  /** A location another venue already has, compared as the database's unique index does. */
  private refuseTakenLocation(location: string, except?: VenueId): void {
    for (const venue of this.rows.values()) {
      if (venue.id !== except && venueNameKey(venue.location) === venueNameKey(location)) {
        throw venueNameTaken();
      }
    }
  }
}
