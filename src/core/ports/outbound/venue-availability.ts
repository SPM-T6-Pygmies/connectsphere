import type { BusyInterval } from "../../domain/venue-search";

/**
 * Driven port: when venues are already taken (SPM-44). A venue is busy for the
 * time of each live booking -- 'Tentative Hold' or 'Confirmed' -- on it, and
 * of each In force block, each marked as which it is (SPM-250).
 */
export interface VenueAvailability {
  /** Every busy interval that overlaps `[from, to)`, across all venues. */
  busyIntervals(from: Date, to: Date): Promise<readonly BusyInterval[]>;
}
