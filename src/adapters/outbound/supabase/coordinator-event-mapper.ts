import type { CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import type { AssignedEventSummary } from "@/core/ports/outbound/coordinator-event-repository";

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
