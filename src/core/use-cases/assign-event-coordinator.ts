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
import type { EventCoordinatorDirectory } from "../ports/outbound/event-coordinator-directory";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface AssignEventCoordinatorCommand {
  readonly eventRequestId: string;
  readonly eventCoordinatorUserAccountId: string;
}

export interface AssignEventCoordinatorResult {
  readonly eventRequestId: string;
  readonly assignedCoordinatorUserAccountId: string;
  readonly status: EventRequestStatus;
}

export interface AssignEventCoordinatorDeps {
  readonly eventRequests: EventRequestRepository;
  readonly eventCoordinators: EventCoordinatorDirectory;
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

    const coordinatorExists = await this.deps.eventCoordinators.exists(coordinatorId);
    if (!coordinatorExists) {
      throw new EventCoordinatorNotFoundError(coordinatorId);
    }

    const assigned = assignEventCoordinator(request, coordinatorId);
    await this.deps.eventRequests.assignEventCoordinator(assigned);

    return {
      eventRequestId: assigned.id,
      assignedCoordinatorUserAccountId: coordinatorId,
      status: assigned.status,
    };
  }
}
