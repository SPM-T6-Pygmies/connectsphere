import {
  EventCoordinatorNotFoundError,
  EventRequestNotFoundError,
} from "../domain/errors";
import {
  assignEventCoordinator,
  eventRequestId,
  type EventRequestStatus,
} from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { ClientOrganisationRepository } from "../ports/outbound/client-organisation-repository";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";
import type { Notifier } from "../ports/outbound/notifier";
import type { UserAccountRepository } from "../ports/outbound/user-account-repository";

export interface AssignEventCoordinatorCommand {
  readonly eventRequestId: string;
  readonly eventCoordinatorUserAccountId: string;
}

/** Whether a coordinator was given to a request that had none, or replaced the one it had. */
export type AssignmentOperation = "assigned" | "reassigned";

export interface AssignEventCoordinatorResult {
  readonly eventRequestId: string;
  readonly assignedCoordinatorUserAccountId: string;
  readonly status: EventRequestStatus;
  readonly operation: AssignmentOperation;
}

export interface AssignEventCoordinatorDeps {
  readonly eventRequests: EventRequestRepository;
  readonly userAccounts: UserAccountRepository;
  readonly clientOrganisations: ClientOrganisationRepository;
  readonly notifier: Notifier;
}

export class AssignEventCoordinatorUseCase {
  constructor(private readonly deps: AssignEventCoordinatorDeps) {}

  async execute(command: AssignEventCoordinatorCommand): Promise<AssignEventCoordinatorResult> {
    const requestId = eventRequestId(command.eventRequestId);
    const coordinatorId = userAccountId(command.eventCoordinatorUserAccountId);

    const request = await this.deps.eventRequests.findById(requestId);
    if (request === null) {
      throw new EventRequestNotFoundError(requestId);
    }

    const coordinatorExists = await this.deps.userAccounts.isEventCoordinator(coordinatorId);
    if (!coordinatorExists) {
      throw new EventCoordinatorNotFoundError(coordinatorId);
    }

    const assigned = assignEventCoordinator(request, coordinatorId);
    await this.deps.eventRequests.assignEventCoordinator(assigned);

    // Only the coordinator now holding the request is told (SPM-57 AC4); the
    // one it was taken from never is, and assigning the same one again is not news.
    if (request.assignedCoordinatorUserAccountId !== coordinatorId) {
      const names = await this.deps.clientOrganisations.findNamesByIds([
        assigned.clientOrganisationId,
      ]);
      await this.deps.notifier.eventCoordinatorAssigned({
        recipientUserAccountId: coordinatorId,
        eventRequestId: assigned.id,
        eventName: assigned.details.eventName,
        clientOrganisationName: names.get(assigned.clientOrganisationId) ?? null,
        preferredDate: assigned.details.preferredDate,
        preferredStartTime: assigned.details.preferredStartTime,
        preferredEndTime: assigned.details.preferredEndTime,
      });
    }

    return {
      eventRequestId: assigned.id,
      assignedCoordinatorUserAccountId: coordinatorId,
      status: assigned.status,
      // From the request as it was stored, not from anything the browser sent.
      operation: request.assignedCoordinatorUserAccountId === null ? "assigned" : "reassigned",
    };
  }
}
