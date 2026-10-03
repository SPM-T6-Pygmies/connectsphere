import type { BookedSlot } from "../../domain/venue-search";

/**
 * Driven port: which venue slots are already taken (SPM-44). A slot is taken
 * when a live booking -- 'Tentative Hold' or 'Confirmed' -- holds it.
 */
export interface VenueAvailability {
  /** Every slot held on `date` (`YYYY-MM-DD`), across all venues. */
  bookedSlots(date: string): Promise<readonly BookedSlot[]>;
}
