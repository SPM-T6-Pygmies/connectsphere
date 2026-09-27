import type { UserAccountId } from "@/core/domain/user-account";
import type {
  AssignedEventSummary,
  CoordinatorEventDetails,
  CoordinatorEventRepository,
} from "@/core/ports/outbound/coordinator-event-repository";

import type { SupabaseServerClient } from "./client";
import {
  toAssignedEventSummary,
  toCoordinatorEventDetails,
  toKey,
  type CoordinatorEventDetailsRow,
  type CoordinatorEventRow,
} from "./coordinator-event-mapper";

interface ClientOrganisationNameRow {
  client_organisation_id: number;
  name: string;
}

/**
 * Reached through `coordinator_events`, not the table -- the table's own
 * grant/policy is scoped to the Attendee's read (see `event-mapper.ts`),
 * which neither carries the columns nor allows the rows a coordinator needs.
 */
export class SupabaseCoordinatorEventRepository implements CoordinatorEventRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async listByAssignedCoordinator(
    coordinatorId: UserAccountId,
  ): Promise<readonly AssignedEventSummary[]> {
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
    const organisationNames = await this.organisationNames(
      rows.map((row) => row.client_organisation_id),
    );
    return rows.map((row) => toAssignedEventSummary(row, organisationNames));
  }

  async findAssigned(
    coordinatorId: UserAccountId,
    eventId: string,
  ): Promise<CoordinatorEventDetails | null> {
    const row = (await this.assignedRows(coordinatorId)).find(
      (candidate) => String(candidate.event_id) === eventId,
    );
    return row === undefined ? null : toCoordinatorEventDetails(row);
  }

  async findAssignedByRequest(
    coordinatorId: UserAccountId,
    eventRequestId: string,
  ): Promise<CoordinatorEventDetails | null> {
    const row = (await this.assignedRows(coordinatorId)).find(
      (candidate) =>
        candidate.event_request_id !== null && String(candidate.event_request_id) === eventRequestId,
    );
    return row === undefined ? null : toCoordinatorEventDetails(row);
  }

  /**
   * Every event assigned to the coordinator, through the same function "My
   * events" reads -- a coordinator has few enough events that filtering here
   * costs less than a second function to keep in step with the first.
   */
  private async assignedRows(
    coordinatorId: UserAccountId,
  ): Promise<readonly CoordinatorEventDetailsRow[]> {
    const key = toKey(coordinatorId);
    if (key === null) {
      return [];
    }

    const { data, error } = await this.client.rpc("coordinator_events", {
      p_coordinator_user_account_id: key,
    });
    if (error) {
      throw new Error(`Failed to read assigned events: ${error.message}`, { cause: error });
    }
    return (data ?? []) as unknown as CoordinatorEventDetailsRow[];
  }

  /**
   * Through `client_organisation_names`, not the table: RLS is enabled on
   * `client_organisation` with no policy, and this key has no table grant.
   */
  private async organisationNames(
    keys: readonly number[],
  ): Promise<ReadonlyMap<number, string>> {
    if (keys.length === 0) {
      return new Map();
    }

    const { data, error } = await this.client.rpc("client_organisation_names", {
      p_client_organisation_ids: [...new Set(keys)],
    });

    if (error) {
      throw new Error(`Failed to look up client organisation names: ${error.message}`, {
        cause: error,
      });
    }

    const rows = (data ?? []) as unknown as ClientOrganisationNameRow[];
    return new Map(rows.map((row) => [row.client_organisation_id, row.name]));
  }
}
