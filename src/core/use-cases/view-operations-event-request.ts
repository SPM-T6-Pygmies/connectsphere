import { eventRequestId, operationsQueueFor } from "../domain/event-request";
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

  /**
   * Null when no event request has the requested id, or when it is not
   * Operations' to see -- a Draft, which `operationsQueueFor` keeps out of both
   * queues. The caller treats both the same way (not found), so a guessed id
   * cannot reveal an Organiser's unsubmitted draft.
   */
  async execute(
    command: ViewOperationsEventRequestCommand,
  ): Promise<ViewOperationsEventRequestResult | null> {
    const request = await this.deps.eventRequests.findById(eventRequestId(command.id));

    return request === null || operationsQueueFor(request) === null
      ? null
      : { eventRequest: toOperationsEventRequest(request) };
  }
}
