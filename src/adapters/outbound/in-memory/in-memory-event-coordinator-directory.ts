import type { UserAccount, UserAccountId } from "@/core/domain/user-account";
import type { EventCoordinatorDirectory } from "@/core/ports/outbound/event-coordinator-directory";

export class InMemoryEventCoordinatorDirectory implements EventCoordinatorDirectory {
  constructor(private readonly coordinators: readonly UserAccount[] = []) {}

  async listAll(): Promise<readonly UserAccount[]> {
    return this.coordinators;
  }

  async exists(id: UserAccountId): Promise<boolean> {
    return this.coordinators.some((coordinator) => coordinator.id === id);
  }
}
