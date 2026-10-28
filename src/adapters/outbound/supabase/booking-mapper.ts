import type { BookingRequest, BookingStatus, OccupiedTime } from "@/core/domain/booking";
import { joinSlots, type TimeRangeOnDate } from "@/core/domain/event-times";
import { slotCodes, toMinutes } from "@/core/domain/time-of-day";
import type { UserAccountId } from "@/core/domain/user-account";
import { venueId } from "@/core/domain/venue";
import type { EventBookingSummary } from "@/core/ports/outbound/booking-repository";

import { toKey } from "./coordinator-event-mapper";
import type { EventSlotTimeRow } from "./event-mapper";

/** A row of `venue_booked_slots()`: one booking_slot row with its hours (SPM-324). */
export interface BookedSlotRow {
  slot_date: string;
  /** `HH:MM:SS`; the last slot of a day ends `24:00:00`. */
  start_time: string;
  end_time: string;
  status: string;
  hold_expires_at: string | null;
}

/** A row of `coordinator_event_bookings()`. */
export interface EventBookingRow {
  booking_id: number;
  venue_id: number;
  venue_location: string;
  room_layout_name: string | null;
  status: string;
  hold_expires_at: string | null;
  created_at: string;
  slots: readonly EventSlotTimeRow[];
  rejection_note: string | null;
  suggested_alternative_venue_id: number | null;
  suggested_alternative_location: string | null;
}

/** Exactly the seven values `booking_status_chk` allows. */
const STATUSES: readonly BookingStatus[] = [
  "Requested",
  "Tentative Hold",
  "Confirmed",
  "Rejected",
  "Released",
  "Cancelled",
  "Expired",
];

// Data crossing inward is untrusted too, even from our own database.
export function toStatus(raw: string): BookingStatus {
  const status = STATUSES.find((candidate) => candidate === raw);
  if (status === undefined) {
    throw new Error(`Unknown booking status "${raw}" in the booking table.`);
  }
  return status;
}

/** `date` columns arrive as `YYYY-MM-DD`; keep only that, whatever else comes with it. */
export function toDate(raw: string): string {
  return raw.slice(0, 10);
}

/** A `time` column as `HH:MM`. */
function toTimeOfDay(raw: string): string {
  return raw.slice(0, 5);
}

/**
 * A booking's slot rows, `{date, start, end}` as the reads report them, joined
 * into the times people read (SPM-324). Bookings and events share the shape.
 */
export function toBookingTimes(rows: readonly EventSlotTimeRow[]): TimeRangeOnDate[] {
  return joinSlots(
    rows.map((row) => ({ date: toDate(row.date), start: toTimeOfDay(row.start), end: toTimeOfDay(row.end) })),
  );
}

export function toOccupiedTime(row: BookedSlotRow): OccupiedTime {
  return {
    date: toDate(row.slot_date),
    start: toTimeOfDay(row.start_time),
    end: toTimeOfDay(row.end_time),
    status: toStatus(row.status),
    holdExpiresAt: row.hold_expires_at === null ? null : new Date(row.hold_expires_at),
  };
}

export function toEventBookingSummary(row: EventBookingRow): EventBookingSummary {
  return {
    id: String(row.booking_id),
    venueId: venueId(String(row.venue_id)),
    venueLocation: row.venue_location,
    roomLayoutName: row.room_layout_name,
    status: toStatus(row.status),
    holdExpiresAt: row.hold_expires_at,
    times: toBookingTimes(row.slots),
    requestedAt: row.created_at,
    rejectionNote: row.rejection_note,
    suggestedAlternative:
      row.suggested_alternative_venue_id === null || row.suggested_alternative_location === null
        ? null
        : {
            venueId: venueId(String(row.suggested_alternative_venue_id)),
            location: row.suggested_alternative_location,
          },
  };
}

export interface SubmitBookingArgs {
  p_coordinator_user_account_id: number;
  p_event_id: number;
  p_venue_id: number;
  /** The layout's name; the function resolves it to the venue's own layout. */
  p_room_layout: string | null;
  /** One entry per 15-minute slot the times cover, coded '0' to '95' (SPM-324). */
  p_slots: ReadonlyArray<{ date: string; slot: string }>;
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
    p_slots: request.times.flatMap(({ date, start, end }) =>
      slotCodes({ start: toMinutes(start) ?? 0, end: toMinutes(end) ?? 0 }).map((slot) => ({ date, slot })),
    ),
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
