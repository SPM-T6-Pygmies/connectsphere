import type { BookingId } from "@/core/domain/booking";
import type { CalendarBlock } from "@/core/domain/venue-calendar";
import { isUnavailabilityReason, type VenueUnavailabilityBlock, type VenueUnavailabilityEntry } from "@/core/domain/venue-unavailability";
import { slotCodeRange } from "@/core/domain/slot-grid";
import { venueId } from "@/core/domain/venue";
import type { AffectedBooking } from "@/core/ports/outbound/venue-unavailability-repository";

import { toBookingTimes, toDate, toStatus } from "./booking-mapper";

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

/**
 * One booking slot in the JSON `venue_staff_unavailability_affected()`
 * returns, with its hours (SPM-324). A booking has a row per slot.
 */
export interface AffectedBookingRow {
  booking_id: number;
  event_name: string;
  status: string;
  date: string;
  start: string;
  end: string;
}

/** One slot in the JSON `venue_blocked_slots()` returns. */
export interface BlockedSlotRow {
  venue_id: number;
  date: string;
  slot: string;
  reason_category: string;
  reason_note: string | null;
}

/** A block's slot code: AM/PM/Night or a 15-minute code. A code the `slot` table cannot hold is a fault, not data. */
function toBlockSlot(raw: string): string {
  slotCodeRange(raw);
  return raw;
}

export function toCalendarBlock(row: BlockedSlotRow): CalendarBlock {
  if (!isUnavailabilityReason(row.reason_category)) {
    throw new Error(`Unknown unavailability reason "${row.reason_category}" in venue_unavailability.`);
  }
  return { date: toDate(row.date), slot: toBlockSlot(row.slot), reason: row.reason_category, note: row.reason_note };
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
    slots: row.slots.map((slot) => ({ date: toDate(slot.date), slot: toBlockSlot(slot.slot) })),
    status: row.status,
    recordedByName: row.recorded_by_name,
    recordedAt: row.recorded_at,
    liftedByName: row.lifted_by_name,
    liftedAt: row.lifted_at,
  };
}

/** Each booking's slots joined into the times the block sits over, in date then start order. */
export function toAffectedBookings(rows: readonly AffectedBookingRow[]): AffectedBooking[] {
  const byBooking = new Map<number, AffectedBookingRow[]>();
  for (const row of rows) {
    byBooking.set(row.booking_id, [...(byBooking.get(row.booking_id) ?? []), row]);
  }
  return [...byBooking.values()]
    .flatMap((booking) =>
      toBookingTimes(booking).map(({ date, start, end }) => ({
        bookingId: String(booking[0].booking_id) as BookingId,
        eventName: booking[0].event_name,
        status: toStatus(booking[0].status),
        date,
        start,
        end,
      })),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
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
