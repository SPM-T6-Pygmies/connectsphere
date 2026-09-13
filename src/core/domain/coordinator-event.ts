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
 * An event as its assigned Event Coordinator is allowed to see it (SPM-121's
 * "My events", a different, wider slice than the Attendee-facing `Event` in
 * `./event.ts` -- that type deliberately excludes coordinator assignment and
 * client organisation, so this is a distinct type rather than a widening of
 * it.
 *
 * Shares `EventId` with the Attendee's `Event`: both identify the same
 * `event` row, just different views of it, the same way `EventRequestId` is
 * shared between the Organiser's and Coordinator's reads of one
 * `EventRequest`.
 */
export interface CoordinatorEvent {
  readonly id: EventId;
  readonly name: string;
  readonly status: CoordinatorEventStatus;
  /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
  readonly preferredDate: string | null;
  readonly clientOrganisationId: ClientOrganisationId;
  readonly assignedCoordinatorUserAccountId: UserAccountId | null;
}
