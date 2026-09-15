/**
 * Mirrors the team's `event_status_chk` (`supabase/schema.sql`), Title Case
 * like the store spells it -- distinct from the Attendee-facing `Event`'s
 * lowercase `EventStatus`, which is that type's own adapter-boundary choice,
 * not a fact about the column.
 */
export type CoordinatorEventStatus = "Planning" | "Blocked" | "Confirmed" | "Completed" | "Cancelled";
