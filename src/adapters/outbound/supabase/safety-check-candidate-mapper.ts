import type { BookingStatus } from "@/core/domain/booking";
import type { CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import type { EquipmentLineState } from "@/core/domain/equipment-requirement";
import { NotSafetyOfficerError, type DomainError } from "@/core/domain/errors";
import { eventId } from "@/core/domain/event";
import type { SafetyCheckCandidate } from "@/core/domain/safety-check";

/** A row of `safety_officer_safety_check_candidates`: one Planning event with its bookings and lines. */
export interface SafetyCheckCandidateRow {
  event_id: number;
  event_name: string;
  status: CoordinatorEventStatus;
  preferred_date: string | null;
  expected_attendance: number | null;
  bookings: { status: BookingStatus; venue_location: string }[];
  equipment_lines: { line_state: EquipmentLineState; quantity_requested: number; quantity_reserved: number }[];
}

export function toSafetyCheckCandidate(row: SafetyCheckCandidateRow): SafetyCheckCandidate {
  return {
    event: {
      id: eventId(String(row.event_id)),
      name: row.event_name,
      status: row.status,
      preferredDate: row.preferred_date,
      expectedAttendance: row.expected_attendance,
    },
    // A venue is known by its location -- the catalogue has no other name for it.
    bookings: row.bookings.map((booking) => ({ status: booking.status, venueName: booking.venue_location })),
    equipmentLines: row.equipment_lines.map((line) => ({
      state: line.line_state,
      quantityRequested: line.quantity_requested,
      quantityReserved: line.quantity_reserved,
    })),
  };
}

/**
 * The domain error a `safety_officer_safety_check_candidates` SQLSTATE stands
 * for -- see its migration -- or null for anything else, which the caller
 * reports as the unexpected failure it is.
 */
export function toSafetyCheckCandidateError(error: { readonly code?: string }): DomainError | null {
  return error.code === "CS050" ? new NotSafetyOfficerError() : null;
}
