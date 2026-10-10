import { clientOrganisationId } from "@/core/domain/client-organisation";

import { toDate, toSlot } from "./booking-mapper";
import type { CoordinatorEvent, CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import { eventId } from "@/core/domain/event";
import { userAccountId } from "@/core/domain/user-account";
import type {
  AssignedEventSummary,
  CoordinatorEventDetails,
} from "@/core/ports/outbound/coordinator-event-repository";

/**
 * The `event` table's shape, named the way the database names it -- only the
 * columns "My events" actually reads. See `event-mapper.ts` for the
 * Attendee-facing read of the same table.
 */
export interface CoordinatorEventRow {
  event_id: number;
  event_request_id: number | null;
  name: string;
  status: string;
  preferred_date: string | null;
  assigned_coordinator_user_account_id: number | null;
  client_organisation_id: number;
}

/** The same row with the columns a venue booking request carries (SPM-46). */
export interface CoordinatorEventDetailsRow extends CoordinatorEventRow {
  /**
   * The `event_slots(event)` computed field, selected with `EVENT_SLOTS_SELECT`.
   * Absent when the query did not ask for it.
   */
  event_slots?: ReadonlyArray<{ date: string; slot: string }> | null;
  expected_attendance: number | null;
  venue_requirements: string | null;
  room_layout_preference: string | null;
  accessibility_requirements: string | null;
  required_facilities: string | null;
}

/** Selects every column plus the `event_slots` computed field. */
export const EVENT_SLOTS_SELECT = "*, event_slots";

/** The domain's ids are opaque strings; this store numbers its rows. */
export function toKey(id: string): number | null {
  return /^\d+$/.test(id) ? Number(id) : null;
}

/** Exactly the five values `event_status_chk` allows, and nothing else. */
const STATUSES: readonly CoordinatorEventStatus[] = [
  "Planning",
  "Blocked",
  "Confirmed",
  "Completed",
  "Cancelled",
];

function toStatus(raw: string): CoordinatorEventStatus {
  const status = STATUSES.find((candidate) => candidate === raw);
  if (status === undefined) {
    // Data crossing inward is untrusted too, even from our own database.
    throw new Error(`Unknown event status "${raw}" in the event table.`);
  }
  return status;
}

/**
 * One "My events" row, straight from the table row -- no entity in between.
 *
 * `organisationNames` is keyed by `client_organisation_id`. An organisation
 * the name lookup did not return is shown unnamed rather than failing the list.
 */
export function toAssignedEventSummary(
  row: CoordinatorEventRow,
  organisationNames: ReadonlyMap<number, string>,
): AssignedEventSummary {
  return {
    id: String(row.event_id),
    eventRequestId: row.event_request_id === null ? null : String(row.event_request_id),
    name: row.name,
    clientOrganisationName: organisationNames.get(row.client_organisation_id) ?? "",
    preferredDate: row.preferred_date,
    status: toStatus(row.status),
  };
}

/** One event as the coordinator's venue booking page reads it (SPM-46). */
export function toCoordinatorEventDetails(row: CoordinatorEventDetailsRow): CoordinatorEventDetails {
  return {
    id: String(row.event_id),
    eventRequestId: row.event_request_id === null ? null : String(row.event_request_id),
    name: row.name,
    status: toStatus(row.status),
    preferredDate: row.preferred_date,
    slots: (row.event_slots ?? []).map((slot) => ({
      date: toDate(slot.date),
      slot: toSlot(slot.slot),
    })),
    expectedAttendance: row.expected_attendance,
    venueRequirements: row.venue_requirements,
    roomLayoutPreference: row.room_layout_preference,
    accessibilityRequirements: row.accessibility_requirements,
    requiredFacilities: row.required_facilities,
  };
}

/** `coordinator_event`/`coordinator_confirm_event` return the full `event` row; only these columns matter to `CoordinatorEvent`. */
export interface CoordinatorEventRecordRow {
  event_id: number;
  name: string;
  description: string | null;
  status: string;
  preferred_date: string | null;
  expected_attendance: number | null;
  equipment_requirements: string | null;
  client_organisation_id: number;
  owning_organiser_user_account_id: number;
  assigned_coordinator_user_account_id: number | null;
}

export function toCoordinatorEvent(row: CoordinatorEventRecordRow): CoordinatorEvent {
  return {
    id: eventId(String(row.event_id)),
    name: row.name,
    description: row.description,
    status: toStatus(row.status),
    preferredDate: row.preferred_date,
    expectedAttendance: row.expected_attendance,
    statedEquipmentNeeds: row.equipment_requirements,
    clientOrganisationId: clientOrganisationId(String(row.client_organisation_id)),
    owningOrganiserUserAccountId: userAccountId(String(row.owning_organiser_user_account_id)),
    assignedCoordinatorUserAccountId:
      row.assigned_coordinator_user_account_id === null
        ? null
        : userAccountId(String(row.assigned_coordinator_user_account_id)),
  };
}
