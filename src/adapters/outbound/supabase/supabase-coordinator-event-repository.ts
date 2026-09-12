import type { CoordinatorEvent } from "@/core/domain/coordinator-event";
import type { UserAccountId } from "@/core/domain/user-account";
import type { CoordinatorEventRepository } from "@/core/ports/outbound/coordinator-event-repository";

import type { SupabaseServerClient } from "./client";
import { toDomain, toKey, type CoordinatorEventRow } from "./coordinator-event-mapper";

/**
 * Reached through `coordinator_events`, not the table -- the table's own
 * grant/policy is scoped to the Attendee's read (see `event-mapper.ts`),
 * which neither carries the columns nor allows the rows a coordinator needs.
 */
export class SupabaseCoordinatorEventRepository implements CoordinatorEventRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async listByAssignedCoordinator(coordinatorId: UserAccountId): Promise<readonly CoordinatorEvent[]> {
    const key = toKey(coordinatorId);
    if (key === null) {
      return [];
    }

    const { data, error } = await this.client.rpc("coordinator_events", {
      p_coordinator_user_account_id: key,
    });

    if (error) {
      throw new Error(`Failed to list assigned events: ${error.message}`, { cause: error });
    }

    const rows = (data ?? []) as unknown as CoordinatorEventRow[];
    return rows.map(toDomain);
  }
}
