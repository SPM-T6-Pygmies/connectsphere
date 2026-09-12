import type { EventRequestDetails, EventRequestStatus } from "../../domain/event-request";

export interface ViewMyEventRequestsCommand {
  readonly userAccountId: string;
  readonly clientOrganisationId: string;
}

export interface MyEventRequestSummary {
  readonly id: string;
  readonly eventName: EventRequestDetails["eventName"];
  readonly status: EventRequestStatus;
  readonly preferredDate: EventRequestDetails["preferredDate"];
  readonly description: EventRequestDetails["description"];
  /** Null for a request still in Draft -- it has never been submitted. */
  readonly submittedAt: Date | null;
}

export interface ViewMyEventRequestsResult {
  readonly eventRequests: readonly MyEventRequestSummary[];
}

export interface ViewMyEventRequests {
  execute(command: ViewMyEventRequestsCommand): Promise<ViewMyEventRequestsResult>;
}
