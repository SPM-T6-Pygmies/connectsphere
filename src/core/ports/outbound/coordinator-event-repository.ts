import type { SlotOnDate } from "../../domain/booking";
import type { CoordinatorEvent, CoordinatorEventStatus } from "../../domain/coordinator-event";
import type { OrdinaryEventChanges } from "../../domain/event-details-edit";
import type { UserAccountId } from "../../domain/user-account";

/**
 * One row of an Event Coordinator's "My events" (SPM-121) -- plain data, the
 * view the screen needs, with the client organisation already named.
 */
export interface AssignedEventSummary {
  readonly id: string;
  /** The approved request the event was opened from; null if it has since been deleted. */
  readonly eventRequestId: string | null;
  readonly name: string;
  readonly clientOrganisationName: string;
  /** ISO calendar date, `YYYY-MM-DD`. Null until scheduled. */
  readonly preferredDate: string | null;
  readonly status: CoordinatorEventStatus;
}

/**
 * One event as the coordinator plans its venue (SPM-46): its timing and the
 * requirements a booking request carries to Venue Staff.
 */
export interface CoordinatorEventDetails {
  readonly id: string;
  readonly eventRequestId: string | null;
  readonly name: string;
  readonly status: CoordinatorEventStatus;
  /** ISO calendar date, `YYYY-MM-DD`. */
  readonly preferredDate: string | null;
  /** The event's slots, in date then day order. Empty until it has any. */
  readonly slots: readonly SlotOnDate[];
  readonly expectedAttendance: number | null;
  readonly venueRequirements: string | null;
  readonly roomLayoutPreference: string | null;
  readonly accessibilityRequirements: string | null;
  /** SPM-247: the facilities the coordinator says the event needs, stored as a venue's are. */
  readonly requiredFacilities: string | null;
  /** SPM-49: the rest of the ordinary details the coordinator edits directly. */
  readonly description: string | null;
  readonly purpose: string | null;
  readonly categoryType: string | null;
  readonly programmeAgenda: string | null;
  readonly specialArrangements: string | null;
  readonly operationalNotes: string | null;
}

/** Driven port: events, scoped the way a coordinator is allowed to see them. */
export interface CoordinatorEventRepository {
  listByAssignedCoordinator(coordinatorId: UserAccountId): Promise<readonly AssignedEventSummary[]>;
  /** The caller's event with this id, or null if there is none assigned to them. */
  findAssigned(coordinatorId: UserAccountId, eventId: string): Promise<CoordinatorEventDetails | null>;
  /** The caller's event opened from this request, or null if there is none assigned to them. */
  findAssignedByRequest(
    coordinatorId: UserAccountId,
    eventRequestId: string,
  ): Promise<CoordinatorEventDetails | null>;

  /** The event with this id if it is assigned to this coordinator; `null` otherwise, whether it is someone else's or does not exist (#91). */
  findAssignedById(
    coordinatorId: UserAccountId,
    id: CoordinatorEvent["id"],
  ): Promise<CoordinatorEvent | null>;

  /**
   * SPM-247: stores the facilities the event needs (null clears them). The caller has already
   * validated them; this re-checks the assignment and status, and records the change.
   */
  setRequiredFacilities(coordinatorId: UserAccountId, eventId: string, facilities: string | null): Promise<void>;

  /**
   * SPM-49: stores changes to the event's ordinary details. The caller has already worked out
   * what changed; this re-checks the assignment and status, and audits each changed field
   * against the coordinator who made it.
   */
  updateOrdinaryDetails(
    coordinatorId: UserAccountId,
    eventId: string,
    changes: OrdinaryEventChanges,
  ): Promise<void>;

  /** SPM-50: persists the event's confirmation. `confirmedBy` is who confirmed it, for the audit trail. */
  confirmEvent(event: CoordinatorEvent, confirmedBy: UserAccountId): Promise<void>;

  /**
   * SPM-51: marks the event Completed and, when `notes` is not null, stores them as its
   * operational notes (null keeps the ones already there). The caller has already decided
   * the event can be completed; this re-checks the assignment, status and end, and audits
   * the completion and any notes change against the coordinator.
   */
  completeEvent(coordinatorId: UserAccountId, eventId: string, notes: string | null): Promise<void>;
}
