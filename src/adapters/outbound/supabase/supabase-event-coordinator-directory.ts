import type { UserAccountId } from "@/core/domain/user-account";
import type {
  EventCoordinatorDetails,
  EventCoordinatorDirectory,
} from "@/core/ports/outbound/event-coordinator-directory";

import type { SupabaseServerClient } from "./client";
import {
  toEventCoordinatorDetails,
  type EventCoordinatorRow,
} from "./user-account-mapper";

/** Reads the credential-free coordinator projection exposed by the database. */
export class SupabaseEventCoordinatorDirectory implements EventCoordinatorDirectory {
  constructor(private readonly client: SupabaseServerClient) {}

  async listAll(): Promise<readonly EventCoordinatorDetails[]> {
    const { data, error } = await this.client.rpc("operations_event_coordinators");

    if (error) {
      throw new Error(`Failed to list Event Coordinators: ${error.message}`, { cause: error });
    }

    return ((data ?? []) as unknown as EventCoordinatorRow[]).map(toEventCoordinatorDetails);
  }

  async exists(id: UserAccountId): Promise<boolean> {
    const coordinators = await this.listAll();
    return coordinators.some((coordinator) => coordinator.userAccountId === id);
  }
}
