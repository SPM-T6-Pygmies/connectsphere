import type { UserAccountId } from "../../domain/user-account";

/**
 * Driven port: who to tell when a coordinator asks for a venue (SPM-61).
 *
 * A system read, not the coordinator's: they may not list staff accounts
 * themselves, for the same reason as `SafetyCheckWatch.safetyOfficers`.
 */
export interface VenueStaffDirectory {
  /** Every account holding the Venue Staff role -- staff are not scoped to venues (#66). */
  venueStaff(): Promise<readonly UserAccountId[]>;
}
