import type { OperationsEventRequest } from "../../use-cases/operations-event-request";

export interface ViewOperationsEventRequestCommand {
  readonly id: string;
}

export interface ViewOperationsEventRequestResult {
  readonly eventRequest: OperationsEventRequest;
}

export interface ViewOperationsEventRequest {
  /** Null when no event request has the requested id. */
  execute(
    command: ViewOperationsEventRequestCommand,
  ): Promise<ViewOperationsEventRequestResult | null>;
}
