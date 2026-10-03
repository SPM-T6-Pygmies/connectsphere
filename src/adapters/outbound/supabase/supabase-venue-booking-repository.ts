import { conflictsWithConfirmed, type Booking, type BookingSlotSelection, type NewBooking } from "@/core/domain/booking";
import {
  NoBookingSlotsSelectedError,
  RoomLayoutNotSupportedByVenueError,
  RoomLayoutRequiredError,
  VenueNotFoundError,
  VenueSlotAlreadyConfirmedError,
  EventNotFoundError,
} from "@/core/domain/errors";
import type { VenueId } from "@/core/domain/venue";
import type { VenueBookingRepository } from "@/core/ports/outbound/venue-booking-repository";

import type { SupabaseServerClient } from "./client";
import {
  toBooking,
  toConfirmedSlot,
  toKey,
  toSubmitArgs,
  type BookingRow,
  type ConfirmedSlotRow,
} from "./venue-booking-mapper";

/** SQLSTATEs `coordinator_submit_venue_booking_request` comes back with. See its migration. */
const NO_SLOTS = "CS030";
const VENUE_NOT_FOUND = "CS031";
const EVENT_NOT_FOUND_OR_NOT_ASSIGNED = "CS032";
const ROOM_LAYOUT_REQUIRED = "CS033";
const ROOM_LAYOUT_NOT_SUPPORTED = "CS034";
const SLOT_ALREADY_CONFIRMED = "CS035";

/**
 * Venue bookings are reached through database functions, not the table --
 * `booking`/`booking_slot` are RLS-enabled with no policy, so `anon` has no
 * grant on either. See
 * supabase/migrations/20260922000000_coordinator_submit_venue_booking_request.sql.
 */
export class SupabaseVenueBookingRepository implements VenueBookingRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async findConfirmedSlots(
    venueId: VenueId,
    slotDates: readonly string[],
  ): Promise<readonly BookingSlotSelection[]> {
    const key = toKey(venueId);
    if (key === null || slotDates.length === 0) {
      return [];
    }

    const { data, error } = await this.client.rpc("venue_confirmed_slots", {
      p_venue_id: key,
      p_slot_dates: slotDates,
    });

    if (error) {
      throw new Error(`Failed to look up confirmed slots: ${error.message}`, { cause: error });
    }

    const rows = (data ?? []) as unknown as ConfirmedSlotRow[];
    return rows.map(toConfirmedSlot);
  }

  /**
   * Inserts the booking and its slots in one transaction (the migration's
   * `coordinator_submit_venue_booking_request`). Its SQLSTATEs come back as
   * the domain's own errors, so losing a race to a concurrent Confirmed
   * booking reads exactly like losing it a moment earlier, rather than a 500.
   */
  async create(booking: NewBooking): Promise<Booking> {
    const args = toSubmitArgs(booking);
    if (args === null) {
      throw new Error(
        `Cannot submit booking with malformed ids "${booking.venueId}", "${booking.eventId}" and "${booking.requestedByUserAccountId}".`,
      );
    }

    const { data, error } = await this.client.rpc("coordinator_submit_venue_booking_request", args);

    if (error) {
      if (error.code === NO_SLOTS) {
        throw new NoBookingSlotsSelectedError();
      }
      if (error.code === VENUE_NOT_FOUND) {
        throw new VenueNotFoundError(booking.venueId);
      }
      if (error.code === EVENT_NOT_FOUND_OR_NOT_ASSIGNED) {
        throw new EventNotFoundError(booking.eventId);
      }
      if (error.code === ROOM_LAYOUT_REQUIRED) {
        throw new RoomLayoutRequiredError(booking.venueId);
      }
      if (error.code === ROOM_LAYOUT_NOT_SUPPORTED) {
        throw new RoomLayoutNotSupportedByVenueError(booking.venueId, booking.roomLayoutId ?? "");
      }
      if (error.code === SLOT_ALREADY_CONFIRMED) {
        throw new VenueSlotAlreadyConfirmedError(...(await this.blockingSlot(booking)));
      }
      throw new Error(`Failed to submit venue booking request: ${error.message}`, { cause: error });
    }

    return toBooking(data as unknown as BookingRow, booking.slots);
  }

  /** Names what a losing race to `coordinator_submit_venue_booking_request` was blocked by -- the SQLSTATE alone cannot carry which slot. */
  private async blockingSlot(booking: NewBooking): Promise<readonly [string, string]> {
    const slotDates = [...new Set(booking.slots.map((slot) => slot.slotDate))];
    const confirmedElsewhere = await this.findConfirmedSlots(booking.venueId, slotDates);
    const conflict = conflictsWithConfirmed(booking.slots, confirmedElsewhere);
    return [conflict?.slotDate ?? "", conflict?.slot ?? ""];
  }
}
