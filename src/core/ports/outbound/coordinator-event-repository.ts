import type { CoordinatorEvent, CoordinatorEventStatus } from "../../domain/coordinator-event";
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

/** Driven port: events, scoped the way a coordinator is allowed to see them. */
export interface CoordinatorEventRepository {
  listByAssignedCoordinator(coordinatorId: UserAccountId): Promise<readonly AssignedEventSummary[]>;

  /** A single event, or `null` if there is none with this id. Scoping to the caller is the use case's job, not this lookup's. */
  findById(id: CoordinatorEvent["id"]): Promise<CoordinatorEvent | null>;

  /** SPM-50: persists the event's confirmation. `confirmedBy` is who confirmed it, for the audit trail. */
  confirmEvent(event: CoordinatorEvent, confirmedBy: UserAccountId): Promise<void>;
}
