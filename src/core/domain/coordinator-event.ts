import type { ClientOrganisationId } from "./client-organisation";
import type { EventId } from "./event";
import type { UserAccountId } from "./user-account";

/**
 * Mirrors the team's `event_status_chk` (`supabase/schema.sql`), Title Case
 * like the store spells it -- distinct from the Attendee-facing `Event`'s
 * lowercase `EventStatus`, which is that type's own adapter-boundary choice,
 * not a fact about the column.
 */
export type CoordinatorEventStatus = "Planning" | "Blocked" | "Confirmed" | "Completed" | "Cancelled";

/**
 * An event as its assigned Event Coordinator is allowed to act on it (SPM-50).
 *
 * Reuses `EventId` from `event.ts`: same `event` row, same column, not a
 * second id type for the same thing.
 */
export interface CoordinatorEvent {
  readonly id: EventId;
  readonly name: string;
  readonly description: string | null;
  readonly status: CoordinatorEventStatus;
  /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
  readonly preferredDate: string | null;
  readonly expectedAttendance: number | null;
  readonly clientOrganisationId: ClientOrganisationId;
  readonly owningOrganiserUserAccountId: UserAccountId;
  readonly assignedCoordinatorUserAccountId: UserAccountId | null;
}
