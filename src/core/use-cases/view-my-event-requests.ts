import { clientOrganisationId } from "../domain/client-organisation";
import { userAccountId } from "../domain/user-account";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

import type { EventRequestDetails, EventRequestStatus } from "../domain/event-request";

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

export interface ViewMyEventRequestsDeps {
  readonly eventRequests: EventRequestRepository;
}

/**
 * SPM-31: the Event Organiser's own requests -- drafts and submitted alike,
 * never a colleague's. Narrower than `ViewOrganisationEventRequestsUseCase`
 * (SPM-39), which lists the whole organisation's requests for coordination
 * purposes; this is what "My event requests" means.
 */
export class ViewMyEventRequestsUseCase {
  constructor(private readonly deps: ViewMyEventRequestsDeps) {}

  async execute(command: ViewMyEventRequestsCommand): Promise<ViewMyEventRequestsResult> {
    const caller = userAccountId(command.userAccountId);
    const organisation = clientOrganisationId(command.clientOrganisationId);

    const requests = await this.deps.eventRequests.listByClientOrganisation(organisation);

    return {
      eventRequests: requests
        .filter((request) => request.responsibleOrganiserId === caller)
        .map((request): MyEventRequestSummary => ({
          id: request.id,
          eventName: request.details.eventName,
          status: request.status,
          preferredDate: request.details.preferredDate,
          description: request.details.description,
          submittedAt: request.submittedAt,
        })),
    };
  }
}
