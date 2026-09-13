import { coordinatorQueueStateFor } from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type {
  AssignedEventRequestSummary,
  ViewAssignedEventRequests,
  ViewAssignedEventRequestsCommand,
  ViewAssignedEventRequestsResult,
} from "../ports/inbound/view-assigned-event-requests";
import type { ClientOrganisationRepository } from "../ports/outbound/client-organisation-repository";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface ViewAssignedEventRequestsDeps {
  readonly eventRequests: EventRequestRepository;
  readonly clientOrganisations: ClientOrganisationRepository;
}

/**
 * SPM-121: every request assigned to the caller and still open, and no
 * others. Approved requests become Events (a separate, backlog-scoped view);
 * Rejected/Withdrawn are decided and belong to the Archive.
 *
 * Which statuses those are, and what the Coordinator calls them, is
 * `coordinatorQueueStateFor`'s decision, in the domain -- this use case
 * orchestrates and does not decide.
 */
export class ViewAssignedEventRequestsUseCase implements ViewAssignedEventRequests {
  constructor(private readonly deps: ViewAssignedEventRequestsDeps) {}

  async execute(
    command: ViewAssignedEventRequestsCommand,
  ): Promise<ViewAssignedEventRequestsResult> {
    const coordinatorId = userAccountId(command.userAccountId);

    const requests = (
      await this.deps.eventRequests.listByAssignedCoordinator(coordinatorId)
    ).flatMap((request) => {
      const state = coordinatorQueueStateFor(request.status);
      return state === null ? [] : [{ request, state }];
    });

    const organisationNames = await this.deps.clientOrganisations.findNamesByIds(
      requests.map(({ request }) => request.clientOrganisationId),
    );

    return {
      eventRequests: requests.map(
        ({ request, state }): AssignedEventRequestSummary => ({
          id: request.id,
          eventName: request.details.eventName,
          clientOrganisationName: organisationNames.get(request.clientOrganisationId) ?? "",
          preferredDate: request.details.preferredDate,
          state,
        }),
      ),
    };
  }
}
