import type { UserAccountId } from "@/core/domain/user-account";
import type {
  AssignedEventSummary,
  CoordinatorEventRepository,
} from "@/core/ports/outbound/coordinator-event-repository";

/** An event as seeded: the view, plus who it is assigned to so the list can be scoped. */
export interface SeedCoordinatorEvent extends AssignedEventSummary {
  readonly assignedCoordinatorUserAccountId: string | null;
}

export class InMemoryCoordinatorEventRepository implements CoordinatorEventRepository {
  constructor(private readonly rows: readonly SeedCoordinatorEvent[] = []) {}

  async listByAssignedCoordinator(
    coordinatorId: UserAccountId,
  ): Promise<readonly AssignedEventSummary[]> {
    return this.rows
      .filter((event) => event.assignedCoordinatorUserAccountId === coordinatorId)
      .map(({ id, eventRequestId, name, clientOrganisationName, preferredDate, status }) => ({
        id,
        eventRequestId,
        name,
        clientOrganisationName,
        preferredDate,
        status,
      }));
  }
}
