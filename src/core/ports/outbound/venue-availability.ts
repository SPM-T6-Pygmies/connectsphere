import type { BusyInterval } from "../../domain/venue-search";

/**
 * Driven port: when venues are already taken (SPM-44). A venue is busy for the
 * time of each live booking -- 'Tentative Hold' or 'Confirmed' -- on it.
 */
export interface VenueAvailability {
  /** Every busy interval that overlaps `[from, to)`, across all venues. */
  busyIntervals(from: Date, to: Date): Promise<readonly BusyInterval[]>;
}
