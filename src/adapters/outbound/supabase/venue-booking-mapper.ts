import type { Booking, BookingSlotSelection, BookingSlotValue, BookingStatus, NewBooking } from "@/core/domain/booking";
import { bookingId } from "@/core/domain/booking";
import { eventId } from "@/core/domain/event";
import { userAccountId } from "@/core/domain/user-account";
import { roomLayoutId, venueId } from "@/core/domain/venue";

/** The `booking` table's shape, named the way the database names it. */
export interface BookingRow {
  booking_id: number;
  venue_id: number;
  room_layout_id: number | null;
  event_id: number | null;
  requested_by_user_account_id: number;
  status: string;
  created_at: string;
}

/** One row of `venue_confirmed_slots()`. */
export interface ConfirmedSlotRow {
  slot_date: string;
  slot: string;
}

/** The domain's ids are opaque strings; this store numbers its rows. */
export function toKey(id: string): number | null {
  return /^\d+$/.test(id) ? Number(id) : null;
}

/** Exactly the six values `booking_status_chk` allows, and nothing else. */
const STATUSES: readonly BookingStatus[] = [
  "Requested",
  "Tentative Hold",
  "Confirmed",
  "Rejected",
  "Released",
  "Cancelled",
];

function toStatus(raw: string): BookingStatus {
  const status = STATUSES.find((candidate) => candidate === raw);
  if (status === undefined) {
    // Data crossing inward is untrusted too, even from our own database.
    throw new Error(`Unknown booking status "${raw}" in the booking table.`);
  }
  return status;
}

/** Exactly the three values `booking_slot_value_chk` allows, and nothing else. */
const SLOT_VALUES: readonly BookingSlotValue[] = ["AM", "PM", "Night"];

function toSlotValue(raw: string): BookingSlotValue {
  const slot = SLOT_VALUES.find((candidate) => candidate === raw);
  if (slot === undefined) {
    throw new Error(`Unknown booking slot "${raw}" in the booking_slot table.`);
  }
  return slot;
}

export function toConfirmedSlot(row: ConfirmedSlotRow): BookingSlotSelection {
  return { slotDate: row.slot_date, slot: toSlotValue(row.slot) };
}

/**
 * The row `coordinator_submit_venue_booking_request` returns, plus the slots
 * the caller already knows it asked for -- a successful insert stored exactly
 * those, so there is no need for the RPC to echo them back.
 */
export function toBooking(row: BookingRow, slots: readonly BookingSlotSelection[]): Booking {
  if (row.event_id === null) {
    // booking_scope_chk requires event_id or session_id; SPM-46 only ever
    // submits against an event_id.
    throw new Error(`Booking ${row.booking_id} has no event_id.`);
  }

  return {
    id: bookingId(String(row.booking_id)),
    venueId: venueId(String(row.venue_id)),
    roomLayoutId: row.room_layout_id === null ? null : roomLayoutId(String(row.room_layout_id)),
    eventId: eventId(String(row.event_id)),
    requestedByUserAccountId: userAccountId(String(row.requested_by_user_account_id)),
    status: toStatus(row.status),
    slots,
    createdAt: new Date(row.created_at),
  };
}

/** Arguments for `coordinator_submit_venue_booking_request`. `null` when any id is malformed. */
export function toSubmitArgs(booking: NewBooking): Record<string, unknown> | null {
  const venueKey = toKey(booking.venueId);
  const eventKey = toKey(booking.eventId);
  const coordinatorKey = toKey(booking.requestedByUserAccountId);
  const layoutKey = booking.roomLayoutId === null ? null : toKey(booking.roomLayoutId);

  if (venueKey === null || eventKey === null || coordinatorKey === null) {
    return null;
  }

  return {
    p_event_id: eventKey,
    p_coordinator_user_account_id: coordinatorKey,
    p_venue_id: venueKey,
    p_room_layout_id: layoutKey,
    p_slots: booking.slots.map((slot) => ({ slot_date: slot.slotDate, slot: slot.slot })),
  };
}
