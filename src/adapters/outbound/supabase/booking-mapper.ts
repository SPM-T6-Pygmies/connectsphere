import {
  isGridTime,
  type BookingRequest,
  type BookingStatus,
  type OccupiedSlot,
  type SlotOnDate,
} from "@/core/domain/booking";
import type { UserAccountId } from "@/core/domain/user-account";
import { venueId } from "@/core/domain/venue";
import type { EventBookingSummary } from "@/core/ports/outbound/booking-repository";

import { toKey } from "./coordinator-event-mapper";

/** A row of `venue_booked_slots()`. */
export interface BookedSlotRow {
  slot_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

/** A row of `coordinator_event_bookings()`. */
export interface EventBookingRow {
  booking_id: number;
  venue_id: number;
  venue_location: string;
  room_layout_name: string | null;
  status: string;
  created_at: string;
  slots: ReadonlyArray<{ date: string; start: string; end: string }>;
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
export function toStatus(raw: string): BookingStatus {
  const status = STATUSES.find((candidate) => candidate === raw);
  if (status === undefined) {
    throw new Error(`Unknown booking status "${raw}" in the booking table.`);
  }
  return status;
}

/** A time of day on the 15-minute grid, as `HH:MM`; `24:00` is the end of the day. */
export function toTime(raw: string): string {
  // `time` columns can arrive with seconds; the grid has none.
  const time = raw.slice(0, 5);
  if (!isGridTime(time)) {
    throw new Error(`Unknown booking time "${raw}" in the booking_slot table.`);
  }
  return time;
}

/** `date` columns arrive as `YYYY-MM-DD`; keep only that, whatever else comes with it. */
export function toDate(raw: string): string {
  return raw.slice(0, 10);
}

export function toOccupiedSlot(row: BookedSlotRow): OccupiedSlot {
  return {
    date: toDate(row.slot_date),
    start: toTime(row.start_time),
    end: toTime(row.end_time),
    status: toStatus(row.status),
  };
}

/** One stretch of time as the functions return it inside a booking's `slots`. */
export function toSlotOnDate(row: {
  date: string;
  start: string;
  end: string;
}): SlotOnDate {
  return {
    date: toDate(row.date),
    start: toTime(row.start),
    end: toTime(row.end),
  };
}

export function toEventBookingSummary(
  row: EventBookingRow,
): EventBookingSummary {
  return {
    id: String(row.booking_id),
    venueId: venueId(String(row.venue_id)),
    venueLocation: row.venue_location,
    roomLayoutName: row.room_layout_name,
    status: toStatus(row.status),
    slots: row.slots.map(toSlotOnDate),
    requestedAt: row.created_at,
  };
}

export interface SubmitBookingArgs {
  p_coordinator_user_account_id: number;
  p_event_id: number;
  p_venue_id: number;
  /** The layout's name; the function resolves it to the venue's own layout. */
  p_room_layout: string | null;
  p_slots: ReadonlyArray<{ date: string; start: string; end: string }>;
}

/** Null when an id is not one this store could have issued. */
export function toSubmitBookingArgs(
  request: BookingRequest,
): SubmitBookingArgs | null {
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
    p_slots: request.slots.map(({ date, start, end }) => ({
      date,
      start,
      end,
    })),
  };
}

export interface ChangeRoomLayoutArgs {
  p_coordinator_user_account_id: number;
  p_booking_id: number;
  /** The layout's name; the function resolves it to the venue's own layout. */
  p_room_layout: string | null;
}

/** Null when an id is not one this store could have issued. */
export function toChangeRoomLayoutArgs(
  coordinatorId: UserAccountId,
  bookingId: string,
  roomLayout: string | null,
): ChangeRoomLayoutArgs | null {
  const coordinator = toKey(coordinatorId);
  const booking = toKey(bookingId);

  if (coordinator === null || booking === null) {
    return null;
  }

  return {
    p_coordinator_user_account_id: coordinator,
    p_booking_id: booking,
    p_room_layout: roomLayout,
  };
}
