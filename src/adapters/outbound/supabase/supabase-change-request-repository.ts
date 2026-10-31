import {
  changeRequestId,
  type ChangeRequest,
  type ChangeRequestId,
  type ChangeRequestItem,
  type ChangeRequestTarget,
} from "@/core/domain/change-request";
import {
  ChangeRequestAlreadyDecidedError,
  ChangeRequestAlreadyOpenError,
  ChangeRequestClosedError,
  ChangeRequestNotFoundError,
  EventRequestNotFoundError,
  InvalidChangeRequestDecisionError,
  InvalidChangeRequestError,
} from "@/core/domain/errors";
import type { EventId } from "@/core/domain/event";
import type { EventRequestId } from "@/core/domain/event-request";
import type { UserAccountId } from "@/core/domain/user-account";
import type { ChangeRequestRepository, NewChangeRequest } from "@/core/ports/outbound/change-request-repository";

import {
  toChangeRequest,
  toChangeRequestItem,
  toChangeRequestTarget,
  toDecisionArg,
  type ChangeRequestRow,
  type ChangeRequestTargetRow,
} from "./change-request-mapper";
import type { SupabaseServerClient } from "./client";
import { toKey } from "./to-key";

const NOT_OWNED = "CS090";
const EVENT_CLOSED = "CS091";
const ALREADY_OPEN = "CS092";
const NO_FIELDS = "CS093";
const NOT_ASSIGNED = "CS095";
const DECISION_EVENT_CLOSED = "CS096";
const ALREADY_DECIDED = "CS097";
const INCOMPLETE_DECISION = "CS098";

/**
 * Change requests, reached through database functions: both tables have no
 * grants, so `submit_change_request` and `coordinator_decide_change_request`
 * restate the core's rules under a lock on the event, and their refusals come
 * back here as the core's own errors.
 */
export class SupabaseChangeRequestRepository implements ChangeRequestRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async findTarget(eventRequestId: EventRequestId): Promise<ChangeRequestTarget | null> {
    const key = toKey(eventRequestId);
    if (key === null) {
      return null;
    }

    const { data, error } = await this.client.rpc("organiser_change_request_target", {
      p_event_request_id: key,
    });

    if (error) {
      throw new Error(`Failed to read the event for a change request: ${error.message}`, { cause: error });
    }

    const [row] = (data ?? []) as unknown as ChangeRequestTargetRow[];
    return row === undefined ? null : toChangeRequestTarget(row);
  }

  async submit(changeRequest: NewChangeRequest): Promise<ChangeRequestId> {
    const requestKey = toKey(changeRequest.eventRequestId);
    const requesterKey = toKey(changeRequest.requestedBy);
    if (requestKey === null || requesterKey === null) {
      throw new EventRequestNotFoundError(changeRequest.eventRequestId);
    }

    const { data, error } = await this.client.rpc("submit_change_request", {
      p_event_request_id: requestKey,
      p_requesting_user_account_id: requesterKey,
      p_items: changeRequest.changes.map(toChangeRequestItem),
    });

    if (error) {
      if (error.code === NOT_OWNED) {
        throw new EventRequestNotFoundError(changeRequest.eventRequestId);
      }
      if (error.code === EVENT_CLOSED) {
        // The function does not say which; either way the event is past changing.
        throw new ChangeRequestClosedError("closed");
      }
      if (error.code === ALREADY_OPEN) {
        throw new ChangeRequestAlreadyOpenError();
      }
      if (error.code === NO_FIELDS) {
        throw new InvalidChangeRequestError(null, "Choose at least one thing to change.");
      }
      throw new Error(`Failed to submit the change request: ${error.message}`, { cause: error });
    }

    return changeRequestId(String(data));
  }

  async listForEvent(coordinatorId: UserAccountId, eventId: EventId): Promise<readonly ChangeRequest[]> {
    const coordinatorKey = toKey(coordinatorId);
    const eventKey = toKey(eventId);
    if (coordinatorKey === null || eventKey === null) {
      return [];
    }

    const { data, error } = await this.client.rpc("coordinator_event_change_requests", {
      p_coordinator_user_account_id: coordinatorKey,
      p_event_id: eventKey,
    });

    if (error) {
      throw new Error(`Failed to read the event's change requests: ${error.message}`, { cause: error });
    }

    return ((data ?? []) as unknown as ChangeRequestRow[]).map(toChangeRequest);
  }

  async decide(coordinatorId: UserAccountId, id: ChangeRequestId, items: readonly ChangeRequestItem[]): Promise<void> {
    const coordinatorKey = toKey(coordinatorId);
    const requestKey = toKey(id);
    if (coordinatorKey === null || requestKey === null) {
      throw new ChangeRequestNotFoundError(id);
    }

    const { error } = await this.client.rpc("coordinator_decide_change_request", {
      p_coordinator_user_account_id: coordinatorKey,
      p_change_request_id: requestKey,
      p_decisions: items.map(toDecisionArg),
    });

    if (error) {
      if (error.code === NOT_ASSIGNED) {
        throw new ChangeRequestNotFoundError(id);
      }
      if (error.code === DECISION_EVENT_CLOSED) {
        throw new ChangeRequestClosedError(error.details ?? "closed");
      }
      if (error.code === ALREADY_DECIDED) {
        throw new ChangeRequestAlreadyDecidedError();
      }
      if (error.code === INCOMPLETE_DECISION) {
        throw new InvalidChangeRequestDecisionError(null, "Accept or decline every change, with a reason for each decline.");
      }
      throw new Error(`Failed to decide the change request: ${error.message}`, { cause: error });
    }
  }
}
