import type { EventRequestStatus } from "../../domain/event-request";

export interface ViewAssignedEventRequestsCommand {
  readonly userAccountId: string;
}

export interface AssignedEventRequestSummary {
  readonly id: string;
  readonly eventName: string;
  readonly clientOrganisationName: string;
  readonly preferredDate: string | null;
  readonly status: EventRequestStatus;
}

export interface ViewAssignedEventRequestsResult {
  readonly eventRequests: readonly AssignedEventRequestSummary[];
}

/** SPM-121: every request currently awaiting the caller's review, and no others. */
export interface ViewAssignedEventRequests {
  execute(command: ViewAssignedEventRequestsCommand): Promise<ViewAssignedEventRequestsResult>;
}
