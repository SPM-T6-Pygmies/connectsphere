import type { EventId } from "../../domain/event";
import type { UserAccountId } from "../../domain/user-account";

/**
 * Driven port: who to tell about an event's equipment (SPM-64, SPM-65).
 *
 * A system read, not the caller's: a coordinator may not list staff accounts,
 * and Technical Support may not read coordinator assignments, for the same
 * reason as `VenueStaffDirectory`.
 */
export interface EquipmentNoticeDirectory {
  /** Every account holding the Technical Support Staff role -- staff are not scoped to events (#66). */
  technicalSupportStaff(): Promise<readonly UserAccountId[]>;

  /** The event's assigned coordinator, or null when it has none. */
  assignedCoordinator(eventId: EventId): Promise<UserAccountId | null>;
}
