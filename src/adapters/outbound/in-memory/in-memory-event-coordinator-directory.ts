import type { UserAccountId } from "@/core/domain/user-account";
import type {
  EventCoordinatorDetails,
  EventCoordinatorDirectory,
} from "@/core/ports/outbound/event-coordinator-directory";

export class InMemoryEventCoordinatorDirectory implements EventCoordinatorDirectory {
  constructor(private readonly coordinators: readonly EventCoordinatorDetails[] = []) {}

  async listAll(): Promise<readonly EventCoordinatorDetails[]> {
    return this.coordinators;
  }

  async exists(id: UserAccountId): Promise<boolean> {
    return this.coordinators.some((coordinator) => coordinator.userAccountId === id);
  }
}
