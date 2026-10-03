import {
  BOOKING_SLOTS,
  type BookingRequest,
  type BookingSlot,
  type BookingStatus,
  type OccupiedSlot,
} from "@/core/domain/booking";
import type { EventBookingSummary } from "@/core/ports/outbound/booking-repository";

import { toKey } from "./coordinator-event-mapper";

/** A row of `venue_booked_slots()`. */
export interface BookedSlotRow {
  slot_date: string;
  slot: string;
  status: string;
}

/** A row of `coordinator_event_bookings()`. */
export interface EventBookingRow {
  booking_id: number;
  venue_location: string;
  room_layout_name: string | null;
  status: string;
  created_at: string;
  slots: ReadonlyArray<{ date: string; slot: string }>;
}

/** Exactly the six values `booking_status_chk` allows. */
const STATUSES: readonly BookingStatus[] = [
  "Requested",
  "Tentative Hold",
  "Confirmed",
  "Rejected",
  "Released",
  "Cancelled",
];

// Data crossing inward is untrusted too, even from our own database.
function toStatus(raw: string): BookingStatus {
  const status = STATUSES.find((candidate) => candidate === raw);
  if (status === undefined) {
    throw new Error(`Unknown booking status "${raw}" in the booking table.`);
  }
  return status;
}

function toSlot(raw: string): BookingSlot {
  const slot = BOOKING_SLOTS.find((candidate) => candidate === raw);
  if (slot === undefined) {
    throw new Error(`Unknown booking slot "${raw}" in the booking_slot table.`);
  }
  return slot;
}

/** `date` columns arrive as `YYYY-MM-DD`; keep only that, whatever else comes with it. */
function toDate(raw: string): string {
  return raw.slice(0, 10);
}

export function toOccupiedSlot(row: BookedSlotRow): OccupiedSlot {
  return { date: toDate(row.slot_date), slot: toSlot(row.slot), status: toStatus(row.status) };
}

export function toEventBookingSummary(row: EventBookingRow): EventBookingSummary {
  return {
    id: String(row.booking_id),
    venueLocation: row.venue_location,
    roomLayoutName: row.room_layout_name,
    status: toStatus(row.status),
    slots: row.slots.map(({ date, slot }) => ({ date: toDate(date), slot: toSlot(slot) })),
    requestedAt: row.created_at,
  };
}

export interface SubmitBookingArgs {
  p_coordinator_user_account_id: number;
  p_event_id: number;
  p_venue_id: number;
  /** The layout's name; the function resolves it to the venue's own layout. */
  p_room_layout: string | null;
  p_slots: ReadonlyArray<{ date: string; slot: BookingSlot }>;
}

/** Null when an id is not one this store could have issued. */
export function toSubmitBookingArgs(request: BookingRequest): SubmitBookingArgs | null {
  const coordinator = toKey(request.requestedBy);
  const event = toKey(request.eventId);
  const venue = toKey(request.venueId);

  if (coordinator === null || event === null || venue === null) {
    return null;
  }

  return {
    p_coordinator_user_account_id: coordinator,
    p_event_id: event,
    p_venue_id: venue,
    p_room_layout: request.roomLayout,
    p_slots: request.slots.map(({ date, slot }) => ({ date, slot })),
  };
}
