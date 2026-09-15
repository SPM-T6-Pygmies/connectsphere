import { coordinatorArchiveStateFor } from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { ClientOrganisationRepository } from "../ports/outbound/client-organisation-repository";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

import type { AssignedEventRequestSummary } from "./view-assigned-event-requests";

export interface ViewArchivedEventRequestsCommand {
  readonly userAccountId: string;
}

export interface ViewArchivedEventRequestsResult {
  /** The queue's row shape; `state` is always `rejected` or `withdrawn` here. */
  readonly eventRequests: readonly AssignedEventRequestSummary[];
}

export interface ViewArchivedEventRequestsDeps {
  readonly eventRequests: EventRequestRepository;
  readonly clientOrganisations: ClientOrganisationRepository;
}

/**
 * The Coordinator's Archive: every request assigned to the caller that was
 * rejected or withdrawn -- the decided half `ViewAssignedEventRequestsUseCase`
 * leaves out, minus Approved requests, which carry on as events.
 *
 * Which statuses those are is `coordinatorArchiveStateFor`'s decision, in the
 * domain -- this use case orchestrates and does not decide.
 */
export class ViewArchivedEventRequestsUseCase {
  constructor(private readonly deps: ViewArchivedEventRequestsDeps) {}

  async execute(
    command: ViewArchivedEventRequestsCommand,
  ): Promise<ViewArchivedEventRequestsResult> {
    const coordinatorId = userAccountId(command.userAccountId);

    const requests = (
      await this.deps.eventRequests.listByAssignedCoordinator(coordinatorId)
    ).flatMap((request) => {
      const state = coordinatorArchiveStateFor(request.status);
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
