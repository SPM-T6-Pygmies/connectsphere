import type { EventRequestStatus } from "../../domain/event-request";

export interface AssignEventCoordinatorCommand {
  readonly eventRequestId: string;
  readonly eventCoordinatorUserAccountId: string;
}

export interface AssignEventCoordinatorResult {
  readonly eventRequestId: string;
  readonly assignedCoordinatorUserAccountId: string;
  readonly status: EventRequestStatus;
}

export interface AssignEventCoordinator {
  execute(command: AssignEventCoordinatorCommand): Promise<AssignEventCoordinatorResult>;
}
