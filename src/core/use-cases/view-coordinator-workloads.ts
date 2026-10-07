import type { CoordinatorEventStatus } from "../domain/coordinator-event";
import { coordinatorWorkloads } from "../domain/coordinator-workload";
import type { EventRequestStatus } from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { ClientOrganisationRepository } from "../ports/outbound/client-organisation-repository";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";
import type { LeadEventRepository } from "../ports/outbound/lead-event-repository";
import type { UserAccountRepository } from "../ports/outbound/user-account-repository";

export interface WorkloadRequest {
  readonly id: string;
  readonly eventName: string;
  readonly clientOrganisationName: string;
  /** ISO calendar date, `YYYY-MM-DD`. */
  readonly preferredDate: string | null;
  readonly status: EventRequestStatus;
}

export interface WorkloadEvent {
  readonly id: string;
  readonly name: string;
  readonly clientOrganisationName: string;
  /** ISO calendar date, `YYYY-MM-DD`. */
  readonly preferredDate: string | null;
  readonly status: CoordinatorEventStatus;
}

export interface CoordinatorWorkloadView {
  readonly userAccountId: string;
  readonly name: string;
  readonly requests: readonly WorkloadRequest[];
  readonly events: readonly WorkloadEvent[];
}

export interface ViewCoordinatorWorkloadsCommand {
  /** The Event Coordinator Lead reading the view. */
  readonly leadUserAccountId: string;
}

export interface ViewCoordinatorWorkloadsResult {
  readonly coordinators: readonly CoordinatorWorkloadView[];
}

export interface ViewCoordinatorWorkloadsDeps {
  readonly userAccounts: UserAccountRepository;
  readonly eventRequests: EventRequestRepository;
  readonly leadEvents: LeadEventRepository;
  readonly clientOrganisations: ClientOrganisationRepository;
}

/**
 * SPM-256: every coordinator with the requests and active events assigned to
 * them. What counts, and under whom, is `coordinatorWorkloads`' call; this
 * only gathers the rows and names them.
 */
export class ViewCoordinatorWorkloadsUseCase {
  constructor(private readonly deps: ViewCoordinatorWorkloadsDeps) {}

  async execute(command: ViewCoordinatorWorkloadsCommand): Promise<ViewCoordinatorWorkloadsResult> {
    const [events, coordinators, requests] = await Promise.all([
      this.deps.leadEvents.listAll(userAccountId(command.leadUserAccountId)),
      this.deps.userAccounts.listEventCoordinators(),
      this.deps.eventRequests.listAll(),
    ]);

    const organisationNames = await this.deps.clientOrganisations.findNamesByIds([
      ...requests.map((request) => request.clientOrganisationId),
      ...events.map((event) => event.clientOrganisationId),
    ]);

    const workloads = coordinatorWorkloads(
      coordinators.map((coordinator) => userAccountId(coordinator.userAccountId)),
      requests,
      events,
    );

    return {
      coordinators: workloads.map((workload, index) => ({
        userAccountId: workload.coordinatorId,
        name: coordinators[index].name,
        requests: workload.requests.map((request) => ({
          id: request.id,
          eventName: request.details.eventName,
          clientOrganisationName: organisationNames.get(request.clientOrganisationId) ?? "",
          preferredDate: request.details.preferredDate,
          status: request.status,
        })),
        events: workload.events.map((event) => ({
          id: event.id,
          name: event.name,
          clientOrganisationName: organisationNames.get(event.clientOrganisationId) ?? "",
          preferredDate: event.preferredDate,
          status: event.status,
        })),
      })),
    };
  }
}
