import {
  coordinatorRequestStateFor,
  coordinatorSectionFor,
  eventRequestAccessForCoordinator,
  eventRequestId,
  type CoordinatorRequestState,
  type CoordinatorSection,
} from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { ClientOrganisationRepository } from "../ports/outbound/client-organisation-repository";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";
import type { UserAccountRepository } from "../ports/outbound/user-account-repository";

import { toEventRequestView, type EventRequestView } from "./event-request-view";

export interface ViewAssignedEventRequestCommand {
  readonly id: string;
  readonly userAccountId: string;
}

export interface ViewAssignedEventRequestResult {
  readonly eventRequest: EventRequestView;
  readonly requestingOrganiserName: string;
  readonly clientOrganisationName: string;
  /**
   * The Coordinator's reading of the request's status -- see
   * `coordinatorRequestStateFor`. Null only for a Draft, which no Coordinator
   * can be assigned to.
   */
  readonly state: CoordinatorRequestState | null;
  /** Which of the Coordinator's sections the request now lives under -- see `coordinatorSectionFor`. */
  readonly section: CoordinatorSection;
}

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
export class ViewAssignedEventRequestUseCase {
  constructor(private readonly deps: ViewAssignedEventRequestDeps) {}

  /** Null when there is no such request, or it isn't assigned to this caller -- the caller should treat both the same way (not found), per `eventRequestAccessForCoordinator` (#91). */
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
      eventRequest: toEventRequestView(request),
      requestingOrganiserName: organiserNames.get(request.responsibleOrganiserId) ?? "",
      clientOrganisationName: organisationNames.get(request.clientOrganisationId) ?? "",
      state: coordinatorRequestStateFor(request.status),
      section: coordinatorSectionFor(request.status),
    };
  }
}
