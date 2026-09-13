import type { CoordinatorEvent } from "../../domain/coordinator-event";
import type { UserAccountId } from "../../domain/user-account";

/** Driven port: events, scoped the way a coordinator is allowed to see them. */
export interface CoordinatorEventRepository {
  listByAssignedCoordinator(coordinatorId: UserAccountId): Promise<readonly CoordinatorEvent[]>;
}
