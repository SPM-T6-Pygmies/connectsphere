import { clientOrganisationId } from "../domain/client-organisation";
import { userAccountId } from "../domain/user-account";
import type {
  MyEventRequestSummary,
  ViewMyEventRequests,
  ViewMyEventRequestsCommand,
  ViewMyEventRequestsResult,
} from "../ports/inbound/view-my-event-requests";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface ViewMyEventRequestsDeps {
  readonly eventRequests: EventRequestRepository;
}

/**
 * SPM-31: the Event Organiser's own requests -- drafts and submitted alike,
 * never a colleague's. Narrower than `ViewOrganisationEventRequestsUseCase`
 * (SPM-39), which lists the whole organisation's requests for coordination
 * purposes; this is what "My event requests" means.
 */
export class ViewMyEventRequestsUseCase implements ViewMyEventRequests {
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
