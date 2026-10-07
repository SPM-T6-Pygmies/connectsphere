import type { CoordinatorEvent } from "@/core/domain/coordinator-event";
import type { LeadEvent } from "@/core/domain/coordinator-workload";
import { NotCoordinatorLeadError } from "@/core/domain/errors";
import type { EventId } from "@/core/domain/event";
import type { UserAccountId } from "@/core/domain/user-account";
import type { LeadEventRepository } from "@/core/ports/outbound/lead-event-repository";

import type { SupabaseServerClient } from "./client";
import { toCoordinatorEvent, toKey, type CoordinatorEventRecordRow } from "./coordinator-event-mapper";
import { toLeadEvent, toLeadEventError, type LeadEventRow } from "./lead-event-mapper";

/**
 * SPM-256 and SPM-257, through the `lead_*` functions, not the table -- the
 * table's own grant and policy are scoped to the Attendee's read. Each
 * function re-checks that the caller is an Event Coordinator Lead and answers
 * CS060 if not, which comes back as the domain's own error, as do the
 * reassignment's CS061-CS063.
 */
export class SupabaseLeadEventRepository implements LeadEventRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async listAll(reader: UserAccountId): Promise<readonly CoordinatorEvent[]> {
    const key = leadKey(reader);

    const { data, error } = await this.client.rpc("lead_events", { p_user_account_id: key });

    if (error) {
      throw (
        toLeadEventError(error) ??
        new Error(`Failed to read every event: ${error.message}`, { cause: error })
      );
    }

    return ((data ?? []) as unknown as CoordinatorEventRecordRow[]).map(toCoordinatorEvent);
  }

  async findById(reader: UserAccountId, id: EventId): Promise<LeadEvent | null> {
    const readerKey = leadKey(reader);
    const key = toKey(id);
    if (key === null) {
      return null;
    }

    const { data, error } = await this.client.rpc("lead_event", {
      p_event_id: key,
      p_user_account_id: readerKey,
    });

    if (error) {
      throw (
        toLeadEventError(error) ??
        new Error(`Failed to look up event: ${error.message}`, { cause: error })
      );
    }

    const row = data as unknown as LeadEventRow | null;
    // Single-row (not `setof`) function: a miss comes back as one row of nulls.
    return row && row.event_id !== null ? toLeadEvent(row) : null;
  }

  async reassignCoordinator(event: LeadEvent, reassignedBy: UserAccountId): Promise<void> {
    const leadKeyValue = leadKey(reassignedBy);
    const key = toKey(event.id);
    const coordinatorKey =
      event.assignedCoordinatorUserAccountId === null ? null : toKey(event.assignedCoordinatorUserAccountId);
    if (key === null || coordinatorKey === null) {
      throw new Error(
        `Cannot reassign event with malformed ids "${event.id}" and "${event.assignedCoordinatorUserAccountId}".`,
      );
    }

    const { error } = await this.client.rpc("lead_reassign_event_coordinator", {
      p_event_id: key,
      p_event_coordinator_user_account_id: coordinatorKey,
      p_lead_user_account_id: leadKeyValue,
    });

    if (error) {
      throw (
        toLeadEventError(error, {
          eventId: event.id,
          coordinatorId: event.assignedCoordinatorUserAccountId ?? "",
        }) ?? new Error(`Failed to reassign the event's coordinator: ${error.message}`, { cause: error })
      );
    }
  }
}

/** An id this store could never have issued is not a Lead. */
function leadKey(id: UserAccountId): number {
  const key = toKey(id);
  if (key === null) {
    throw new NotCoordinatorLeadError();
  }
  return key;
}
