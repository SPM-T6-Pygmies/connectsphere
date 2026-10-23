import type { VenueChangeBooking, VenueChangeFlag } from "../../domain/venue-change-flag";
import type { VenueId } from "../../domain/venue";

/**
 * Driven port: the bookings a venue edit is judged against, and the flags it raises
 * (SPM-105). Which bookings to flag is the domain's call; this reads and stores.
 */
export interface VenueChangeReview {
  /**
   * The Confirmed bookings and Tentative Holds at `venueId`, each with its layout, its
   * slots and its event's needs as they are now.
   *
   * Throws `VenueMaintenanceNotPermittedError` if the store refuses the caller.
   */
  bookingsAt(venueId: VenueId): Promise<readonly VenueChangeBooking[]>;

  /**
   * Stores the reasons as `venue-attributes` flags, one open row per booking and source:
   * a reason that `startsFailing` is added, or replaces the open one for the same source;
   * any other only restates an open one, and is dropped if there is none. A booking that
   * no longer holds its venue is skipped. Nothing about the booking itself changes.
   *
   * Throws `VenueMaintenanceNotPermittedError` if the store refuses the caller.
   */
  flag(venueId: VenueId, flags: readonly VenueChangeFlag[]): Promise<void>;
}
