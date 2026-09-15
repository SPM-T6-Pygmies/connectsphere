import type { OperationsEventRequest } from "../../use-cases/operations-event-request";

export interface ViewAllEventRequestsResult {
  readonly eventRequests: readonly OperationsEventRequest[];
}

export interface ViewAllEventRequests {
  execute(): Promise<ViewAllEventRequestsResult>;
}
