import type { BookingId, BookingStatus, SlotOnDate } from "../../domain/booking";
import type { SlotCodeOnDate } from "../../domain/slot-grid";
import type { UserAccountId } from "../../domain/user-account";
import type { CalendarBlock } from "../../domain/venue-calendar";
import type {
  UnavailabilityLift,
  VenueUnavailabilityBlock,
  VenueUnavailabilityEntry,
} from "../../domain/venue-unavailability";
import type { VenueId } from "../../domain/venue";

/** One booking a block sits over: which event, which day, which slot (SPM-21 AC11). */
export interface AffectedBooking {
  readonly bookingId: BookingId;
  readonly eventName: string;
  readonly status: BookingStatus;
  readonly date: string;
  readonly slot: SlotOnDate["slot"];
}

/**
 * SPM-313: a booking a block flagged, with who to tell. SPM-71 sends one notice
 * for each, so a block over three of a coordinator's bookings gives three.
 */
export interface FlaggedBooking {
  readonly bookingId: BookingId;
  readonly eventId: string;
  readonly eventName: string;
  /** Null when the event has no assigned coordinator yet. */
  readonly coordinatorUserAccountId: string | null;
  readonly venueLocation: string;
  /** The reason as the coordinator reads it. */
  readonly detail: string;
}

/**
 * Driven port: the blocks Venue Staff put on a venue (SPM-21). A block is
 * stored once per date and slot; this port speaks of whole blocks. Whether a
 * block may be recorded or lifted is the domain's call; this reads and stores
 * what it decided.
 */
export interface VenueUnavailabilityRepository {
  /**
   * Stores a block and returns it as stored, In force -- read back, so the
   * caller sees what persisted. Writes the audit row (AC18). Overlapping blocks
   * are fine (AC19).
   *
   * Throws `VenueUnavailabilityNotPermittedError` if the store refuses the
   * caller, `VenueNotFoundError` if the venue is not in the catalogue.
   */
  record(block: VenueUnavailabilityBlock, actor: UserAccountId): Promise<VenueUnavailabilityEntry>;

  /** Every block at every venue, lifted ones included. Venue Staff only. */
  list(reader: UserAccountId): Promise<readonly VenueUnavailabilityEntry[]>;

  /** Null when there is no such block. */
  find(reader: UserAccountId, id: string): Promise<VenueUnavailabilityEntry | null>;

  /**
   * Records a lift and its audit row. The store refuses a block already
   * lifted (`UnavailabilityAlreadyLiftedError`) even if two staff race.
   */
  lift(lift: UnavailabilityLift): Promise<void>;

  /**
   * The live bookings (Requested, Tentative Hold, Confirmed) at `venueId` that
   * share time with any of `slots` -- what a block would leave in place (AC10, AC11).
   * Read-only: nothing here changes a booking.
   */
  affectedBookings(
    reader: UserAccountId,
    venueId: VenueId,
    slots: readonly SlotCodeOnDate[],
  ): Promise<readonly AffectedBooking[]>;

  /**
   * SPM-313: the bookings recording this block flagged. Recording flags them in the
   * same transaction (a Confirmed booking or live hold the block overlaps, one reason
   * per block); this reads them back. Venue Staff only; anyone else gets nothing.
   */
  flaggedBookings(reader: UserAccountId, blockId: string): Promise<readonly FlaggedBooking[]>;

  /**
   * SPM-43: the slots In force blocks cover at `venueId` from `from` to `to`
   * (`YYYY-MM-DD`, both included), each with its reason category and any note
   * -- once per block, so a slot two blocks cover appears twice. Any signed-in
   * reader; who recorded it is not given.
   */
  blockedBetween(venueId: VenueId, from: string, to: string): Promise<readonly CalendarBlock[]>;
}
