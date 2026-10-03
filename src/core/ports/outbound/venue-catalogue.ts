import type { Venue, VenueDetails, VenueId } from "../../domain/venue";

/**
 * Driven port: the catalogue of venues Event Coordinators evaluate and Venue
 * Staff maintain (SPM-42). Phrased as the catalogue's own conversation -- what
 * is listed, what is added, what is revised -- not as table operations.
 */
export interface VenueCatalogue {
  list(): Promise<readonly Venue[]>;

  /** Null when the venue is not in the catalogue. */
  find(id: VenueId): Promise<Venue | null>;

  /**
   * Stores a new venue with its layouts and returns it as stored -- read back,
   * so the caller sees what actually persisted.
   *
   * Throws `VenueMaintenanceNotPermittedError` if the store refuses the caller.
   */
  add(details: VenueDetails): Promise<Venue>;

  /**
   * Replaces a venue's attributes and its set of supported layouts (layouts not
   * in `details` are removed) and returns the venue as stored.
   *
   * Throws `VenueNotFoundError`, or `VenueMaintenanceNotPermittedError` if the
   * store refuses the caller.
   */
  revise(id: VenueId, details: VenueDetails): Promise<Venue>;
}
