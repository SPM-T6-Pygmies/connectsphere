import type {
  ViewAllEventRequests,
  ViewAllEventRequestsResult,
} from "../ports/inbound/view-all-event-requests";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";
import { toOperationsEventRequest } from "./operations-event-request";

export interface ViewAllEventRequestsDeps {
  readonly eventRequests: EventRequestRepository;
}

/**
 * The Event Operations Manager's unfiltered source list.
 *
 * Assignment/status filtering belongs to the Operations UI. This use case
 * deliberately returns Drafts, every client organisation, and both assigned
 * and unassigned requests.
 */
export class ViewAllEventRequestsUseCase implements ViewAllEventRequests {
  constructor(private readonly deps: ViewAllEventRequestsDeps) {}

  async execute(): Promise<ViewAllEventRequestsResult> {
    const requests = await this.deps.eventRequests.listAll();

    return {
      eventRequests: requests.map(toOperationsEventRequest),
    };
  }
}
