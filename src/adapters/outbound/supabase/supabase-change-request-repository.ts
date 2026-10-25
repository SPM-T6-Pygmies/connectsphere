import type { ChangeRequestTarget } from "@/core/domain/change-request";
import {
  ChangeRequestAlreadyOpenError,
  ChangeRequestClosedError,
  EventRequestNotFoundError,
  InvalidChangeRequestError,
} from "@/core/domain/errors";
import type { EventRequestId } from "@/core/domain/event-request";
import type { ChangeRequestRepository, NewChangeRequest } from "@/core/ports/outbound/change-request-repository";

import {
  toChangeRequestItem,
  toChangeRequestTarget,
  type ChangeRequestTargetRow,
} from "./change-request-mapper";
import type { SupabaseServerClient } from "./client";
import { toKey } from "./event-request-mapper";

const NOT_OWNED = "CS090";
const EVENT_CLOSED = "CS091";
const ALREADY_OPEN = "CS092";
const NO_FIELDS = "CS093";

/**
 * Change requests, reached through database functions: both tables have no
 * grants, so `submit_change_request` restates the core's rules under a lock
 * on the event, and its refusals come back here as the core's own errors.
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

  async submit(changeRequest: NewChangeRequest): Promise<void> {
    const requestKey = toKey(changeRequest.eventRequestId);
    const requesterKey = toKey(changeRequest.requestedBy);
    if (requestKey === null || requesterKey === null) {
      throw new EventRequestNotFoundError(changeRequest.eventRequestId);
    }

    const { error } = await this.client.rpc("submit_change_request", {
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
  }
}
