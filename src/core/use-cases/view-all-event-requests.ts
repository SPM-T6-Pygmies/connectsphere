import { operationsQueueFor, type OperationsQueue } from "../domain/event-request";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";
import { toOperationsEventRequest, type OperationsEventRequest } from "./operations-event-request";

/** A request in the Operations source list, with the queue it belongs in. */
export interface OperationsQueueEntry extends OperationsEventRequest {
  readonly queue: OperationsQueue;
}

export interface ViewAllEventRequestsResult {
  readonly eventRequests: readonly OperationsQueueEntry[];
}

export interface ViewAllEventRequestsDeps {
  readonly eventRequests: EventRequestRepository;
}

/**
 * The Event Operations Manager's source list: every request across every
 * client organisation, except Drafts, each with the queue it belongs in.
 *
 * Which requests Operations sees, and which queue each sits in, is
 * `operationsQueueFor`'s decision, in the domain -- the screens pick rows by
 * the answer rather than re-deriving it from status and assignment.
 */
export class ViewAllEventRequestsUseCase {
  constructor(private readonly deps: ViewAllEventRequestsDeps) {}

  async execute(): Promise<ViewAllEventRequestsResult> {
    const requests = await this.deps.eventRequests.listAll();

    return {
      eventRequests: requests.flatMap((request) => {
        const queue = operationsQueueFor(request);
        return queue === null ? [] : [{ ...toOperationsEventRequest(request), queue }];
      }),
    };
  }
}
