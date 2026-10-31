import type { VenueChangeBooking, VenueChangeFlag } from "../../domain/venue-change-flag";
import type { VenueId } from "../../domain/venue";
import type { EventConfirmationLapse } from "./confirmation-lapses";

/** A booking at the changed venue, with its event and the coordinator to tell (SPM-71). */
export interface ReviewedBooking extends VenueChangeBooking {
  readonly eventId: string;
  readonly eventName: string;
  /** Null when the event has no assigned coordinator yet. */
  readonly coordinatorUserAccountId: string | null;
}

/**
 * Driven port: the bookings a venue edit is judged against, and the flags it raises
 * (SPM-105). Which bookings to flag is the domain's call; this reads and stores.
 */
export interface VenueChangeReview {
  /**
   * The Confirmed bookings and Tentative Holds at `venueId`, each with its layout, its
   * slots, its event's needs as they are now, and the event's coordinator.
   *
   * Throws `VenueMaintenanceNotPermittedError` if the store refuses the caller.
   */
  bookingsAt(venueId: VenueId): Promise<readonly ReviewedBooking[]>;

  /**
   * Stores the reasons as `venue-attributes` flags, one open row per booking and source:
   * a reason that `startsFailing` is added, or replaces the open one for the same source;
   * any other only restates an open one, and is dropped if there is none. A booking that
   * no longer holds its venue is skipped. Nothing about the booking itself changes.
   *
   * SPM-111: a Confirmed event with a booking flagged goes back to Planning in the same
   * write. Returns those events, with who to tell.
   *
   * Throws `VenueMaintenanceNotPermittedError` if the store refuses the caller.
   */
  flag(venueId: VenueId, flags: readonly VenueChangeFlag[]): Promise<readonly EventConfirmationLapse[]>;
}
