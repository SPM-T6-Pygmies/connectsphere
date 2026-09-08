import { clientOrganisationId } from "../domain/client-organisation";
import { eventRequestAccessFor, type OrganiserContext } from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type {
  OrganisationEventRequestSummary,
  ViewOrganisationEventRequests,
  ViewOrganisationEventRequestsCommand,
  ViewOrganisationEventRequestsResult,
} from "../ports/inbound/view-organisation-event-requests";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface ViewOrganisationEventRequestsDeps {
  readonly eventRequests: EventRequestRepository;
}

/**
 * SPM-39 AC1/AC3/AC4: every request in the caller's own client organisation,
 * regardless of which Organiser raised it, each flagged with whether the
 * caller may edit it right now.
 */
export class ViewOrganisationEventRequestsUseCase implements ViewOrganisationEventRequests {
  constructor(private readonly deps: ViewOrganisationEventRequestsDeps) {}

  async execute(
    command: ViewOrganisationEventRequestsCommand,
  ): Promise<ViewOrganisationEventRequestsResult> {
    const organiser: OrganiserContext = {
      userAccountId: userAccountId(command.userAccountId),
      clientOrganisationId: clientOrganisationId(command.clientOrganisationId),
    };

    const requests = await this.deps.eventRequests.listByClientOrganisation(
      organiser.clientOrganisationId,
    );

    return {
      eventRequests: requests.map((request): OrganisationEventRequestSummary => ({
        id: request.id,
        eventName: request.eventName,
        status: request.status,
        canEdit: eventRequestAccessFor(request, organiser) === "edit",
      })),
    };
  }
}
