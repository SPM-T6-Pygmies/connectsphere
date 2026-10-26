import type { VenueChangeFlag } from "@/core/domain/venue-change-flag";
import type { ReviewedBooking } from "@/core/ports/outbound/venue-change-review";

import { toStatus } from "./booking-mapper";

/** One element of `venue_change_bookings`' array. */
export interface VenueChangeBookingRow {
  booking_id: number;
  event_id: number;
  event_name: string;
  coordinator_user_account_id: number | null;
  status: string;
  hold_expires_at: string | null;
  room_layout_name: string | null;
  slots: { date: string; slot: string }[];
  expected_attendance: number | null;
  room_layout_preference: string | null;
  accessibility_requirements: string | null;
  required_facilities: string | null;
}

export function toVenueChangeBooking(row: VenueChangeBookingRow): ReviewedBooking {
  return {
    id: String(row.booking_id),
    eventId: String(row.event_id),
    eventName: row.event_name,
    coordinatorUserAccountId:
      row.coordinator_user_account_id === null ? null : String(row.coordinator_user_account_id),
    status: toStatus(row.status),
    holdExpiresAt: row.hold_expires_at === null ? null : new Date(row.hold_expires_at),
    slots: row.slots.map(({ date, slot }) => ({ date, slot })),
    roomLayoutName: row.room_layout_name,
    needs: {
      expectedAttendance: row.expected_attendance,
      preferredLayout: row.room_layout_preference,
      accessibilityNeeds: row.accessibility_requirements,
      requiredFacilities: row.required_facilities,
    },
  };
}

/** One element of `venue_change_flag_bookings`' `p_flags`. */
export function toVenueChangeFlagArgument(flag: VenueChangeFlag) {
  return {
    booking_id: Number(flag.bookingId),
    source_ref: flag.sourceRef,
    detail: flag.detail,
    starts_failing: flag.startsFailing,
  };
}
