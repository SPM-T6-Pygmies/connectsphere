import type { VenueId } from "@/core/domain/booking";
import type {
  BookableVenueSummary,
  VenueCatalogue,
} from "@/core/ports/outbound/venue-catalogue";

export class InMemoryVenueCatalogue implements VenueCatalogue {
  constructor(private readonly venues: readonly BookableVenueSummary[] = []) {}

  async listBookable(): Promise<readonly BookableVenueSummary[]> {
    return this.venues;
  }

  async findBookable(id: VenueId): Promise<BookableVenueSummary | null> {
    return this.venues.find((venue) => venue.id === id) ?? null;
  }
}
