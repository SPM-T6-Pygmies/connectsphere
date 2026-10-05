import type { BookingId } from "@/core/domain/booking";
import { isUnavailabilityReason, type VenueUnavailabilityBlock, type VenueUnavailabilityEntry } from "@/core/domain/venue-unavailability";
import { venueId } from "@/core/domain/venue";
import type { AffectedBooking } from "@/core/ports/outbound/venue-unavailability-repository";

import { toDate, toSlot, toStatus } from "./booking-mapper";

/** One block in the JSON `venue_staff_unavailability()` returns. */
export interface VenueUnavailabilityRow {
  id: number;
  venue_id: number;
  venue_location: string;
  reason_category: string;
  reason_note: string | null;
  status: string;
  recorded_by_name: string;
  recorded_at: string;
  lifted_by_name: string | null;
  lifted_at: string | null;
  start_date: string;
  end_date: string;
  slots: ReadonlyArray<{ date: string; slot: string }>;
}

/** One booking in the JSON `venue_staff_unavailability_affected()` returns. */
export interface AffectedBookingRow {
  booking_id: number;
  event_name: string;
  status: string;
  date: string;
  slot: string;
}

export function toVenueUnavailabilityEntry(row: VenueUnavailabilityRow): VenueUnavailabilityEntry {
  if (!isUnavailabilityReason(row.reason_category)) {
    throw new Error(`Unknown unavailability reason "${row.reason_category}" in venue_unavailability.`);
  }
  if (row.status !== "In force" && row.status !== "Lifted") {
    throw new Error(`Unknown unavailability status "${row.status}" from venue_staff_unavailability.`);
  }
  return {
    id: String(row.id),
    venueId: venueId(String(row.venue_id)),
    venueLocation: row.venue_location,
    startDate: toDate(row.start_date),
    endDate: toDate(row.end_date),
    reason: row.reason_category,
    note: row.reason_note,
    slots: row.slots.map((slot) => ({ date: toDate(slot.date), slot: toSlot(slot.slot) })),
    status: row.status,
    recordedByName: row.recorded_by_name,
    recordedAt: row.recorded_at,
    liftedByName: row.lifted_by_name,
    liftedAt: row.lifted_at,
  };
}

export function toAffectedBooking(row: AffectedBookingRow): AffectedBooking {
  return {
    bookingId: String(row.booking_id) as BookingId,
    eventName: row.event_name,
    status: toStatus(row.status),
    date: toDate(row.date),
    slot: toSlot(row.slot),
  };
}

/** The arguments of `venue_staff_record_unavailability`; null when the venue id is not one this store issued. */
export interface RecordUnavailabilityArgs {
  p_staff_user_account_id: number;
  p_venue_id: number;
  p_reason: string;
  p_note: string | null;
  p_slots: ReadonlyArray<{ date: string; slot: string }>;
}

export function toRecordUnavailabilityArgs(
  block: VenueUnavailabilityBlock,
  staffKey: number,
  venueKey: number,
): RecordUnavailabilityArgs {
  return {
    p_staff_user_account_id: staffKey,
    p_venue_id: venueKey,
    p_reason: block.reason,
    p_note: block.note,
    p_slots: block.slots.map(({ date, slot }) => ({ date, slot })),
  };
}
