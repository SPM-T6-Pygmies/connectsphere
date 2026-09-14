import type { AssignedEventRequestSummary } from "./view-assigned-event-requests";

export interface ViewArchivedEventRequestsCommand {
  readonly userAccountId: string;
}

export interface ViewArchivedEventRequestsResult {
  /** The queue's row shape; `state` is always `rejected` or `withdrawn` here. */
  readonly eventRequests: readonly AssignedEventRequestSummary[];
}

/** The Coordinator's Archive: every request assigned to the caller that was decided without becoming an event. */
export interface ViewArchivedEventRequests {
  execute(command: ViewArchivedEventRequestsCommand): Promise<ViewArchivedEventRequestsResult>;
}
