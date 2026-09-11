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

/** Statuses that count as "awaiting review" for the assigned coordinator (SPM-121). */
const QUEUE_STATUSES = new Set(["Under Review", "Returned"]);

/**
 * SPM-121: every request assigned to the caller and still awaiting review,
 * and no others. Approved requests become Events (a separate, backlog-scoped
 * view); Rejected/Withdrawn are decided and belong to the Archive.
 */
export class ViewAssignedEventRequestsUseCase implements ViewAssignedEventRequests {
  constructor(private readonly deps: ViewAssignedEventRequestsDeps) {}

  async execute(
    command: ViewAssignedEventRequestsCommand,
  ): Promise<ViewAssignedEventRequestsResult> {
    const coordinatorId = userAccountId(command.userAccountId);

    const requests = (
      await this.deps.eventRequests.listByAssignedCoordinator(coordinatorId)
    ).filter((request) => QUEUE_STATUSES.has(request.status));

    const organisationNames = await this.deps.clientOrganisations.findNamesByIds(
      requests.map((request) => request.clientOrganisationId),
    );

    return {
      eventRequests: requests.map(
        (request): AssignedEventRequestSummary => ({
          id: request.id,
          eventName: request.details.eventName,
          clientOrganisationName: organisationNames.get(request.clientOrganisationId) ?? "",
          preferredDate: request.details.preferredDate,
          status: request.status,
        }),
      ),
    };
  }
}
