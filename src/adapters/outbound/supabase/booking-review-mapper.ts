import type { BookingId, DecidedBooking } from "@/core/domain/booking";
import { venueId } from "@/core/domain/venue";
import type { BookingForReview } from "@/core/ports/outbound/booking-review-repository";

import { toDate, toSlotOnDate, toStatus } from "./booking-mapper";
import { toKey } from "./coordinator-event-mapper";

/** One booking in the JSON `venue_staff_bookings()` returns. */
export interface BookingReviewRow {
  booking_id: number;
  status: string;
  venue_id: number;
  venue_location: string;
  room_layout_name: string | null;
  slots: ReadonlyArray<{ date: string; start: string; end: string }>;
  requested_by_name: string;
  requested_at: string;
  decided_by_name: string | null;
  rejection_note: string | null;
  suggested_alternative_location: string | null;
  event: {
    name: string;
    status: string;
    organisation_name: string | null;
    category: string | null;
    preferred_date: string | null;
    start_time: string | null;
    end_time: string | null;
    expected_attendance: number | null;
    room_layout_preference: string | null;
    accessibility_requirements: string | null;
    venue_requirements: string | null;
    equipment_requirements: string | null;
    special_arrangements: string | null;
  };
}

export function toBookingForReview(row: BookingReviewRow): BookingForReview {
  return {
    id: String(row.booking_id) as BookingId,
    status: toStatus(row.status),
    venueId: venueId(String(row.venue_id)),
    venueLocation: row.venue_location,
    roomLayoutName: row.room_layout_name,
    slots: row.slots.map(toSlotOnDate),
    requestedByName: row.requested_by_name,
    requestedAt: row.requested_at,
    decidedByName: row.decided_by_name,
    rejectionNote: row.rejection_note,
    suggestedAlternativeLocation: row.suggested_alternative_location,
    event: {
      name: row.event.name,
      status: row.event.status,
      organisationName: row.event.organisation_name,
      category: row.event.category,
      preferredDate:
        row.event.preferred_date === null
          ? null
          : toDate(row.event.preferred_date),
      startTime: row.event.start_time,
      endTime: row.event.end_time,
      expectedAttendance: row.event.expected_attendance,
      roomLayoutPreference: row.event.room_layout_preference,
      accessibilityRequirements: row.event.accessibility_requirements,
      venueRequirements: row.event.venue_requirements,
      equipmentRequirements: row.event.equipment_requirements,
      specialArrangements: row.event.special_arrangements,
    },
  };
}

/** The arguments of `venue_staff_decide_booking`; null when an id is not one this store issued. */
export interface DecideBookingArgs {
  p_staff_user_account_id: number;
  p_booking_id: number;
  p_decision: "approve" | "reject";
  p_note: string | null;
  p_suggested_alternative_venue_id: number | null;
}

export function toDecideBookingArgs(
  decided: DecidedBooking,
): DecideBookingArgs | null {
  const staff = toKey(decided.decidedBy);
  const booking = toKey(decided.id);
  const alternative =
    decided.suggestedAlternative === null
      ? null
      : toKey(decided.suggestedAlternative);
  if (
    staff === null ||
    booking === null ||
    (decided.suggestedAlternative !== null && alternative === null)
  ) {
    return null;
  }

  return {
    p_staff_user_account_id: staff,
    p_booking_id: booking,
    p_decision: decided.status === "Confirmed" ? "approve" : "reject",
    p_note: decided.rejectionNote,
    p_suggested_alternative_venue_id: alternative,
  };
}
