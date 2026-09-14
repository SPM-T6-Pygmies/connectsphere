import type { CoordinatorEventStatus } from "../../domain/coordinator-event";

export interface ViewAssignedEventsCommand {
  readonly userAccountId: string;
}

export interface AssignedEventSummary {
  readonly id: string;
  /** The approved request the event was opened from; null if it has since been deleted. */
  readonly eventRequestId: string | null;
  readonly name: string;
  readonly clientOrganisationName: string;
  readonly preferredDate: string | null;
  readonly status: CoordinatorEventStatus;
}

export interface ViewAssignedEventsResult {
  readonly events: readonly AssignedEventSummary[];
}

/** "My events" (SPM-121's own scoping note): every event the caller is coordinating, any status. */
export interface ViewAssignedEvents {
  execute(command: ViewAssignedEventsCommand): Promise<ViewAssignedEventsResult>;
}
