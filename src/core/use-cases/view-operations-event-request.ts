import { eventRequestId } from "../domain/event-request";
import type {
  ViewOperationsEventRequest,
  ViewOperationsEventRequestCommand,
  ViewOperationsEventRequestResult,
} from "../ports/inbound/view-operations-event-request";
import type { OperationsEventRequestReader } from "../ports/outbound/operations-event-request-reader";
import { toOperationsEventRequest } from "./operations-event-request";

export interface ViewOperationsEventRequestDeps {
  readonly eventRequests: OperationsEventRequestReader;
}

/** Retrieves one event request for the Event Operations Manager. */
export class ViewOperationsEventRequestUseCase implements ViewOperationsEventRequest {
  constructor(private readonly deps: ViewOperationsEventRequestDeps) {}

  async execute(
    command: ViewOperationsEventRequestCommand,
  ): Promise<ViewOperationsEventRequestResult | null> {
    const request = await this.deps.eventRequests.findById(eventRequestId(command.id));

    return request === null
      ? null
      : { eventRequest: toOperationsEventRequest(request) };
  }
}
