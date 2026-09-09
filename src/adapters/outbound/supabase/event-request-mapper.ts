import { clientOrganisationId } from "@/core/domain/client-organisation";
import {
  eventRequestId,
  type EventRequest,
  type EventRequestStatus,
  type NewEventRequest,
} from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

/**
 * The `event_request` table's shape, named the way the database names it.
 *
 * snake_case columns, a bigint key, Title Case statuses and a calendar `date`
 * are Postgres's vocabulary. They stop here: nothing inward of this file knows
 * that `preferredDate` is spelled `preferred_date` in one particular store,
 * which is what makes replacing that store a local change.
 */
export interface EventRequestRow {
  event_request_id: number;
  event_name: string;
  description: string | null;
  purpose: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  expected_attendance: number | null;
  venue_requirements: string | null;
  room_layout_preferences: string | null;
  accessibility_needs: string | null;
  equipment_requirements: string | null;
  registration_requirements: string | null;
  general_programme: string | null;
  other_special_arrangements: string | null;
  status: string;
  requesting_user_account_id: number;
  client_organisation_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * The domain's ids are opaque strings, which is what keeps the core from
 * knowing that this store numbers its rows. Turning one back into a key is
 * this adapter's job, and an id that was never one of ours is simply not
 * found -- a hand-typed URL is a miss, not a failure.
 */
export function toKey(id: string): number | null {
  return /^\d+$/.test(id) ? Number(id) : null;
}

/** Exactly the seven values `event_request_status_chk` allows, and nothing else. */
const STATUSES: readonly EventRequestStatus[] = [
  "Draft",
  "Submitted",
  "Under Review",
  "Approved",
  "Rejected",
  "Returned",
  "Withdrawn",
];

function toStatus(raw: string): EventRequestStatus {
  const status = STATUSES.find((candidate) => candidate === raw);
  if (status === undefined) {
    // Data crossing inward is untrusted too, even from our own database.
    throw new Error(`Unknown event request status "${raw}" in the event_request table.`);
  }
  return status;
}

/**
 * `submitted_at` has no column of its own.
 *
 * The team's schema carries `created_at`/`updated_at` and the status, so for a
 * request that has left Draft the moment it was submitted is the last time it
 * was written. That is an approximation, and it is the adapter's to make --
 * the domain asked for "when was this submitted" and this store answers as
 * well as it can. A dedicated `submitted_at` column would make it exact.
 */
function submittedAtOf(row: EventRequestRow): Date | null {
  return row.status === "Draft" ? null : new Date(row.updated_at);
}

export function toDomain(row: EventRequestRow): EventRequest {
  return {
    id: eventRequestId(String(row.event_request_id)),
    status: toStatus(row.status),
    clientOrganisationId: clientOrganisationId(String(row.client_organisation_id)),
    responsibleOrganiserId: userAccountId(String(row.requesting_user_account_id)),
    submittedAt: submittedAtOf(row),
    details: {
      eventName: row.event_name,
      description: row.description,
      purpose: row.purpose,
      preferredDate: row.preferred_date,
      preferredTime: row.preferred_time,
      expectedAttendance: row.expected_attendance,
      venueRequirements: row.venue_requirements,
      roomLayoutPreferences: row.room_layout_preferences,
      accessibilityNeeds: row.accessibility_needs,
      equipmentRequirements: row.equipment_requirements,
      registrationRequirements: row.registration_requirements,
      generalProgramme: row.general_programme,
      otherSpecialArrangements: row.other_special_arrangements,
    },
  };
}

/**
 * Arguments for `organiser_submit_event_request`.
 *
 * No `event_request_id`: the column is `generated always as identity`, so the
 * store chooses it and hands it back.
 */
export function toSubmitArgs(request: NewEventRequest): Record<string, unknown> {
  return {
    p_event_name: request.details.eventName,
    p_description: request.details.description,
    p_purpose: request.details.purpose,
    p_preferred_date: request.details.preferredDate,
    p_preferred_time: request.details.preferredTime,
    p_expected_attendance: request.details.expectedAttendance,
    p_venue_requirements: request.details.venueRequirements,
    p_room_layout_preferences: request.details.roomLayoutPreferences,
    p_accessibility_needs: request.details.accessibilityNeeds,
    p_equipment_requirements: request.details.equipmentRequirements,
    p_registration_requirements: request.details.registrationRequirements,
    p_general_programme: request.details.generalProgramme,
    p_other_special_arrangements: request.details.otherSpecialArrangements,
    p_status: request.status,
    p_requesting_user_account_id: toKey(request.responsibleOrganiserId),
    p_client_organisation_id: toKey(request.clientOrganisationId),
  };
}
