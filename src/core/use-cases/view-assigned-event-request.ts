import { eventRequestAccessForCoordinator, eventRequestId } from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type {
  ViewAssignedEventRequest,
  ViewAssignedEventRequestCommand,
  ViewAssignedEventRequestResult,
} from "../ports/inbound/view-assigned-event-request";
import type { ClientOrganisationRepository } from "../ports/outbound/client-organisation-repository";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";
import type { UserAccountRepository } from "../ports/outbound/user-account-repository";

export interface ViewAssignedEventRequestDeps {
  readonly eventRequests: EventRequestRepository;
  readonly clientOrganisations: ClientOrganisationRepository;
  readonly userAccounts: UserAccountRepository;
}

/**
 * SPM-32: one event request, exactly as the Organiser submitted it, to the
 * Event Coordinator it is assigned to.
 *
 * A request assigned to a different coordinator, or not yet assigned at all,
 * comes back the same as a request that does not exist --
 * `eventRequestAccessForCoordinator`'s "none" is deliberately not
 * distinguishable from not-found (#91).
 */
export class ViewAssignedEventRequestUseCase implements ViewAssignedEventRequest {
  constructor(private readonly deps: ViewAssignedEventRequestDeps) {}

  async execute(
    command: ViewAssignedEventRequestCommand,
  ): Promise<ViewAssignedEventRequestResult | null> {
    const request = await this.deps.eventRequests.findById(eventRequestId(command.id));
    if (request === null) {
      return null;
    }

    const coordinator = { userAccountId: userAccountId(command.userAccountId) };
    if (eventRequestAccessForCoordinator(request, coordinator) === "none") {
      return null;
    }

    const [organisationNames, organiserNames] = await Promise.all([
      this.deps.clientOrganisations.findNamesByIds([request.clientOrganisationId]),
      this.deps.userAccounts.findNamesByIds([request.responsibleOrganiserId]),
    ]);

    return {
      eventRequest: request,
      requestingOrganiserName: organiserNames.get(request.responsibleOrganiserId) ?? "",
      clientOrganisationName: organisationNames.get(request.clientOrganisationId) ?? "",
    };
  }
}
