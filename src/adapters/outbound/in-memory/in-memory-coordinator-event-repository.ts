import type { CoordinatorEvent } from "@/core/domain/coordinator-event";
import type { UserAccountId } from "@/core/domain/user-account";
import type { CoordinatorEventRepository } from "@/core/ports/outbound/coordinator-event-repository";

export class InMemoryCoordinatorEventRepository implements CoordinatorEventRepository {
  constructor(private readonly rows: readonly CoordinatorEvent[] = []) {}

  async listByAssignedCoordinator(coordinatorId: UserAccountId): Promise<readonly CoordinatorEvent[]> {
    return this.rows.filter((event) => event.assignedCoordinatorUserAccountId === coordinatorId);
  }
}
