import type { VenueId } from "../../domain/venue";

/**
 * Driven port: whether a venue has a booking that has not yet ended (SPM-23 AC5). Setup and
 * turnaround can be defined for the first time only while it has none, because defining them
 * changes what such a booking occupies. What counts as upcoming is `isUpcomingBooking`.
 */
export interface UpcomingVenueBookings {
  hasUpcomingBooking(venue: VenueId, now: Date): Promise<boolean>;
}
