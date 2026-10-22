import type { BookingId, DecidedBooking, ResolvedHold } from "@/core/domain/booking";
import { venueId } from "@/core/domain/venue";
import type { BookingForReview } from "@/core/ports/outbound/booking-review-repository";

import { toBookingTimes, toDate, toStatus } from "./booking-mapper";
import { toKey } from "./coordinator-event-mapper";
import { toEventTimes, type EventSlotTimeRow } from "./event-mapper";

/** One booking in the JSON `venue_staff_bookings()` returns. */
export interface BookingReviewRow {
  booking_id: number;
  status: string;
  venue_id: number;
  venue_location: string;
  room_layout_name: string | null;
  slots: readonly EventSlotTimeRow[];
  requested_by_name: string;
  requested_at: string;
  decided_by_name: string | null;
  hold_expires_at: string | null;
  rejection_note: string | null;
  suggested_alternative_location: string | null;
  event: {
    event_id: number;
    event_request_id: number | null;
    coordinator_user_account_id: number | null;
    name: string;
    status: string;
    organisation_name: string | null;
    category: string | null;
    preferred_date: string | null;
    slots: readonly EventSlotTimeRow[];
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
    times: toBookingTimes(row.slots),
    requestedByName: row.requested_by_name,
    requestedAt: row.requested_at,
    decidedByName: row.decided_by_name,
    holdExpiresAt: row.hold_expires_at,
    rejectionNote: row.rejection_note,
    suggestedAlternativeLocation: row.suggested_alternative_location,
    event: {
      id: String(row.event.event_id),
      requestId: row.event.event_request_id === null ? null : String(row.event.event_request_id),
      coordinatorUserAccountId:
        row.event.coordinator_user_account_id === null
          ? null
          : String(row.event.coordinator_user_account_id),
      name: row.event.name,
      status: row.event.status,
      organisationName: row.event.organisation_name,
      category: row.event.category,
      preferredDate: row.event.preferred_date === null ? null : toDate(row.event.preferred_date),
      times: toEventTimes(row.event.slots),
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
  p_decision: "approve" | "hold" | "reject";
  p_note: string | null;
  p_suggested_alternative_venue_id: number | null;
  /** Only with a hold (SPM-218): when it lapses, as an ISO instant. */
  p_hold_expires_at?: string;
}

export function toDecideBookingArgs(decided: DecidedBooking): DecideBookingArgs | null {
  const staff = toKey(decided.decidedBy);
  const booking = toKey(decided.id);
  const alternative =
    decided.suggestedAlternative === null ? null : toKey(decided.suggestedAlternative);
  if (staff === null || booking === null || (decided.suggestedAlternative !== null && alternative === null)) {
    return null;
  }
  if (decided.status === "Tentative Hold" && decided.holdExpiresAt === undefined) {
    // The core always sets one; the database would refuse a hold without it.
    throw new Error("A hold needs an expiry.");
  }

  return {
    p_staff_user_account_id: staff,
    p_booking_id: booking,
    p_decision:
      decided.status === "Confirmed" ? "approve" : decided.status === "Tentative Hold" ? "hold" : "reject",
    p_note: decided.rejectionNote,
    p_suggested_alternative_venue_id: alternative,
    ...(decided.holdExpiresAt === undefined ? {} : { p_hold_expires_at: decided.holdExpiresAt.toISOString() }),
  };
}

/** The arguments of `venue_staff_resolve_hold`; null when an id is not one this store issued (SPM-219). */
export interface ResolveHoldArgs {
  p_staff_user_account_id: number;
  p_booking_id: number;
  p_resolution: "confirm" | "release";
}

export function toResolveHoldArgs(resolved: ResolvedHold): ResolveHoldArgs | null {
  const staff = toKey(resolved.resolvedBy);
  const booking = toKey(resolved.id);
  if (staff === null || booking === null) {
    return null;
  }

  return {
    p_staff_user_account_id: staff,
    p_booking_id: booking,
    p_resolution: resolved.status === "Confirmed" ? "confirm" : "release",
  };
}
