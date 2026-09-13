import { clientOrganisationId } from "@/core/domain/client-organisation";
import type { CoordinatorEvent, CoordinatorEventStatus } from "@/core/domain/coordinator-event";
import { eventId } from "@/core/domain/event";
import { userAccountId } from "@/core/domain/user-account";

/**
 * The `event` table's shape, named the way the database names it -- only the
 * columns "My events" actually reads. See `event-mapper.ts` for the
 * Attendee-facing read of the same table.
 */
export interface CoordinatorEventRow {
  event_id: number;
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

export function toDomain(row: CoordinatorEventRow): CoordinatorEvent {
  return {
    id: eventId(String(row.event_id)),
    name: row.name,
    status: toStatus(row.status),
    preferredDate: row.preferred_date,
    clientOrganisationId: clientOrganisationId(String(row.client_organisation_id)),
    assignedCoordinatorUserAccountId:
      row.assigned_coordinator_user_account_id === null
        ? null
        : userAccountId(String(row.assigned_coordinator_user_account_id)),
  };
}
