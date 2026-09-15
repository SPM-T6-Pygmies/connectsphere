import { eventRequestId } from "../domain/event-request";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";
import { toOperationsEventRequest, type OperationsEventRequest } from "./operations-event-request";

export interface ViewOperationsEventRequestCommand {
  readonly id: string;
}

export interface ViewOperationsEventRequestResult {
  readonly eventRequest: OperationsEventRequest;
}

export interface ViewOperationsEventRequestDeps {
  readonly eventRequests: EventRequestRepository;
}

/** Retrieves one event request for the Event Operations Manager. */
export class ViewOperationsEventRequestUseCase {
  constructor(private readonly deps: ViewOperationsEventRequestDeps) {}

  /** Null when no event request has the requested id. */
  async execute(
    command: ViewOperationsEventRequestCommand,
  ): Promise<ViewOperationsEventRequestResult | null> {
    const request = await this.deps.eventRequests.findById(eventRequestId(command.id));

    return request === null
      ? null
      : { eventRequest: toOperationsEventRequest(request) };
  }
}
