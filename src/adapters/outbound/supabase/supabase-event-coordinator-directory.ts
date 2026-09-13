import type { UserAccount, UserAccountId } from "@/core/domain/user-account";
import type { EventCoordinatorDirectory } from "@/core/ports/outbound/event-coordinator-directory";

import type { SupabaseServerClient } from "./client";
import {
  eventCoordinatorToDomain,
  type EventCoordinatorRow,
} from "./user-account-mapper";

/** Reads the credential-free coordinator projection exposed by the database. */
export class SupabaseEventCoordinatorDirectory implements EventCoordinatorDirectory {
  constructor(private readonly client: SupabaseServerClient) {}

  async listAll(): Promise<readonly UserAccount[]> {
    const { data, error } = await this.client.rpc("operations_event_coordinators");

    if (error) {
      throw new Error(`Failed to list Event Coordinators: ${error.message}`, { cause: error });
    }

    return ((data ?? []) as unknown as EventCoordinatorRow[]).map(eventCoordinatorToDomain);
  }

  async exists(id: UserAccountId): Promise<boolean> {
    const coordinators = await this.listAll();
    return coordinators.some((coordinator) => coordinator.id === id);
  }
}
