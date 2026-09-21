import type { CoordinatorEvent } from "@/core/domain/coordinator-event";
import {
  EventNotConfirmableError,
  EventNotFoundError,
  EventNotReadyForConfirmationError,
} from "@/core/domain/errors";
import type { ArrangementType } from "@/core/domain/event-readiness";
import type { UserAccountId } from "@/core/domain/user-account";
import type {
  AssignedEventSummary,
  CoordinatorEventRepository,
} from "@/core/ports/outbound/coordinator-event-repository";

import type { SupabaseServerClient } from "./client";
import {
  toAssignedEventSummary,
  toCoordinatorEvent,
  toKey,
  type CoordinatorEventRecordRow,
  type CoordinatorEventRow,
} from "./coordinator-event-mapper";

interface ClientOrganisationNameRow {
  client_organisation_id: number;
  name: string;
}

/** SQLSTATEs `coordinator_confirm_event` comes back with. See its migration. */
const NOT_FOUND_OR_NOT_ASSIGNED = "CS020";
const NOT_CONFIRMABLE = "CS021";
const NOT_READY = "CS022";

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

  /** Through `coordinator_event`, not the table -- same reason as `listByAssignedCoordinator` above. */
  async findById(id: CoordinatorEvent["id"]): Promise<CoordinatorEvent | null> {
    const key = toKey(id);
    if (key === null) {
      return null;
    }

    const { data, error } = await this.client.rpc("coordinator_event", { p_event_id: key });

    if (error) {
      throw new Error(`Failed to look up event: ${error.message}`, { cause: error });
    }

    const row = data as unknown as CoordinatorEventRecordRow | null;
    // Single-row (not `setof`) function: a miss comes back as one row of
    // nulls rather than SQL NULL, same quirk `organiser_event_request` has.
    return row && row.event_id !== null ? toCoordinatorEvent(row) : null;
  }

  /**
   * SPM-50: goes through `coordinator_confirm_event`, which re-checks the
   * assignment, status and readiness under a row lock, and -- in the same
   * transaction -- writes the audit record. Its SQLSTATEs come back as the
   * domain's own errors, so losing a race to a concurrent change reads
   * exactly like losing it a moment earlier, rather than a 500.
   */
  async confirmEvent(event: CoordinatorEvent, confirmedBy: UserAccountId): Promise<void> {
    const eventKey = toKey(event.id);
    const coordinatorKey = toKey(confirmedBy);
    if (eventKey === null || coordinatorKey === null) {
      throw new Error(`Cannot confirm event with malformed ids "${event.id}" and "${confirmedBy}".`);
    }

    const { error } = await this.client.rpc("coordinator_confirm_event", {
      p_event_id: eventKey,
      p_coordinator_user_account_id: coordinatorKey,
    });

    if (error) {
      if (error.code === NOT_FOUND_OR_NOT_ASSIGNED) {
        throw new EventNotFoundError(event.id);
      }
      if (error.code === NOT_CONFIRMABLE) {
        throw new EventNotConfirmableError(event.status);
      }
      if (error.code === NOT_READY) {
        throw new EventNotReadyForConfirmationError(await this.blockingArrangements(eventKey));
      }
      throw new Error(`Failed to confirm event: ${error.message}`, { cause: error });
    }
  }

  /** Names what a losing race to `coordinator_confirm_event` was blocked by -- the SQLSTATE alone cannot carry the list. */
  private async blockingArrangements(eventKey: number): Promise<readonly ArrangementType[]> {
    const { data, error } = await this.client.rpc("event_readiness", { p_event_id: eventKey });

    if (error) {
      throw new Error(`Failed to look up event readiness: ${error.message}`, { cause: error });
    }

    const rows = (data ?? []) as unknown as { arrangement_type: ArrangementType; is_complete: boolean }[];
    return rows.filter((row) => !row.is_complete).map((row) => row.arrangement_type);
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
