import {
  BOOKING_SLOTS,
  roomLayoutId,
  venueId,
  type BookingRequest,
  type BookingSlot,
  type BookingStatus,
  type OccupiedSlot,
} from "@/core/domain/booking";
import type { EventBookingSummary } from "@/core/ports/outbound/booking-repository";
import type { BookableVenueSummary } from "@/core/ports/outbound/venue-catalogue";

import { toKey } from "./coordinator-event-mapper";

/** A row of `bookable_venues()`. */
export interface BookableVenueRow {
  venue_id: number;
  location: string;
  capacity: number | null;
  facilities: string | null;
  accessibility: string | null;
  layouts: ReadonlyArray<{ room_layout_id: number; name: string; capacity: number | null }>;
}

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

export function toBookableVenueSummary(row: BookableVenueRow): BookableVenueSummary {
  return {
    id: venueId(String(row.venue_id)),
    location: row.location,
    capacity: row.capacity,
    facilities: row.facilities,
    accessibility: row.accessibility,
    supportedLayouts: row.layouts.map((layout) => ({
      id: roomLayoutId(String(layout.room_layout_id)),
      name: layout.name,
      capacity: layout.capacity,
    })),
  };
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
  p_room_layout_id: number | null;
  p_slots: ReadonlyArray<{ date: string; slot: BookingSlot }>;
}

/** Null when an id is not one this store could have issued. */
export function toSubmitBookingArgs(request: BookingRequest): SubmitBookingArgs | null {
  const coordinator = toKey(request.requestedBy);
  const event = toKey(request.eventId);
  const venue = toKey(request.venueId);
  const layout = request.roomLayoutId === null ? null : toKey(request.roomLayoutId);

  if (coordinator === null || event === null || venue === null) {
    return null;
  }
  if (request.roomLayoutId !== null && layout === null) {
    return null;
  }

  return {
    p_coordinator_user_account_id: coordinator,
    p_event_id: event,
    p_venue_id: venue,
    p_room_layout_id: layout,
    p_slots: request.slots.map(({ date, slot }) => ({ date, slot })),
  };
}
