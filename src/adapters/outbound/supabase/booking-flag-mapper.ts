import type { BookingId } from "@/core/domain/booking";
import type { FlagReasonCode } from "@/core/domain/booking-review-flag";
import type { EventBookingFlag } from "@/core/ports/outbound/booking-flag-repository";
import type { FlaggedBooking } from "@/core/ports/outbound/venue-unavailability-repository";

import { toStatus } from "./booking-mapper";

/** One element of `coordinator_event_flags`' array. */
export interface EventBookingFlagRow {
  flag_id: number;
  booking_id: number;
  venue_location: string;
  status: string;
  hold_expires_at: string | null;
  booked_for: string | null;
  reason_code: string;
  detail: string;
  flagged_at: string;
  source_lifted_at: string | null;
}

/** One element of `venue_staff_block_flagged_bookings`' array. */
export interface FlaggedBookingRow {
  booking_id: number;
  event_id: number;
  event_name: string;
  coordinator_user_account_id: number | null;
  venue_location: string;
  detail: string;
}

const REASON_CODES: readonly FlagReasonCode[] = ["venue-unavailable", "venue-attributes", "event-change"];

// Data crossing inward is untrusted too, even from our own database.
function toReasonCode(raw: string): FlagReasonCode {
  const code = REASON_CODES.find((candidate) => candidate === raw);
  if (code === undefined) {
    throw new Error(`Unknown flag reason "${raw}" in the booking_review_flag table.`);
  }
  return code;
}

export function toEventBookingFlag(row: EventBookingFlagRow): EventBookingFlag {
  return {
    flagId: String(row.flag_id),
    bookingId: String(row.booking_id) as BookingId,
    venueLocation: row.venue_location,
    status: toStatus(row.status),
    holdExpiresAt: row.hold_expires_at,
    bookedFor: row.booked_for ?? "",
    reasonCode: toReasonCode(row.reason_code),
    detail: row.detail,
    flaggedAt: row.flagged_at,
    sourceLiftedAt: row.source_lifted_at ?? null,
  };
}

export function toFlaggedBooking(row: FlaggedBookingRow): FlaggedBooking {
  return {
    bookingId: String(row.booking_id) as BookingId,
    eventId: String(row.event_id),
    eventName: row.event_name,
    coordinatorUserAccountId:
      row.coordinator_user_account_id === null ? null : String(row.coordinator_user_account_id),
    venueLocation: row.venue_location,
    detail: row.detail,
  };
}
