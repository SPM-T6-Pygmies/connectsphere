import type { BookableVenue, VenueId } from "../../domain/booking";

/** A venue as a coordinator weighs it up when asking to book it. */
export interface BookableVenueSummary extends BookableVenue {
  readonly location: string;
  /** The venue-wide figure; per-layout capacity is on each layout (#112, SPM-106). */
  readonly capacity: number | null;
  readonly facilities: string | null;
  readonly accessibility: string | null;
}

/**
 * Driven port: the venue catalogue, read-only, as booking needs it.
 *
 * Maintaining the catalogue is SPM-42's; this is only the read a booking
 * request depends on.
 */
export interface VenueCatalogue {
  listBookable(): Promise<readonly BookableVenueSummary[]>;
  findBookable(id: VenueId): Promise<BookableVenueSummary | null>;
}
