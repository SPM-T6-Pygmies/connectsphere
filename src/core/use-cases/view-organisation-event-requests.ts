import { clientOrganisationId } from "../domain/client-organisation";
import { eventRequestAccessFor, type OrganiserContext } from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface ViewOrganisationEventRequestsCommand {
  readonly userAccountId: string;
  readonly clientOrganisationId: string;
}

export interface OrganisationEventRequestSummary {
  readonly id: string;
  readonly eventName: string;
  readonly status: string;
  /** Whether the caller may edit this request right now -- for the UI to gate the edit affordance on, not to trust in place of a server-side check. */
  readonly canEdit: boolean;
}

export interface ViewOrganisationEventRequestsResult {
  readonly eventRequests: readonly OrganisationEventRequestSummary[];
}

export interface ViewOrganisationEventRequestsDeps {
  readonly eventRequests: EventRequestRepository;
}

/**
 * SPM-39 AC1/AC3/AC4: every request in the caller's own client organisation,
 * regardless of which Organiser raised it, each flagged with whether the
 * caller may edit it right now.
 */
export class ViewOrganisationEventRequestsUseCase {
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
        eventName: request.details.eventName,
        status: request.status,
        canEdit: eventRequestAccessFor(request, organiser) === "edit",
      })),
    };
  }
}
