import type {
  ClarificationMessage,
  NewClarificationMessage,
} from "@/core/domain/clarification-message";
import {
  ClarificationMessageRequiredError,
  ClarificationReplyNotTopLevelError,
  EventRequestNotFoundError,
} from "@/core/domain/errors";
import type { EventRequestId } from "@/core/domain/event-request";
import type { ClarificationThreadRepository } from "@/core/ports/outbound/clarification-thread-repository";

import type { SupabaseServerClient } from "./client";
import {
  toDomain,
  toPostArgs,
  type ClarificationMessageRow,
} from "./clarification-message-mapper";
import { toKey } from "./event-request-mapper";

/** SQLSTATEs `post_event_request_clarification_message` comes back with. See its migration. */
const REQUEST_NOT_FOUND = "CS010";
const BODY_REQUIRED = "CS014";
const REPLY_NOT_TOP_LEVEL = "CS016";

/**
 * The clarification thread, reached through database functions rather than
 * through the table.
 *
 * `event_request_comment` has RLS enabled with no policies, exactly like
 * `event_request`, so `anon` has no grant on it and these two functions are
 * the whole surface. See
 * supabase/migrations/20260921180000_event_request_clarification.sql.
 *
 * The *first* message of a thread does not come through here: opening a
 * clarification writes the status and the question together, so
 * `SupabaseEventRequestRepository.returnEventRequest` does both in one
 * transaction.
 */
export class SupabaseClarificationThreadRepository implements ClarificationThreadRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async messagesFor(eventRequestId: EventRequestId): Promise<readonly ClarificationMessage[]> {
    const key = toKey(eventRequestId);
    if (key === null) {
      return [];
    }

    const { data, error } = await this.client.rpc("event_request_clarification_thread", {
      p_event_request_id: key,
    });

    if (error) {
      throw new Error(`Failed to read the clarification thread: ${error.message}`, {
        cause: error,
      });
    }

    const rows = (data ?? []) as unknown as ClarificationMessageRow[];
    return rows.map(toDomain);
  }

  async append(message: NewClarificationMessage): Promise<ClarificationMessage> {
    const args = toPostArgs(message);
    if (args === null) {
      throw new Error(
        `Cannot post a clarification message with malformed ids "${message.eventRequestId}", "${message.authorUserAccountId}" and "${message.parentId}".`,
      );
    }

    const { data, error } = await this.client.rpc(
      "post_event_request_clarification_message",
      args,
    );

    if (error) {
      if (error.code === REQUEST_NOT_FOUND) {
        throw new EventRequestNotFoundError(message.eventRequestId);
      }
      if (error.code === BODY_REQUIRED) {
        throw new ClarificationMessageRequiredError();
      }
      if (error.code === REPLY_NOT_TOP_LEVEL) {
        throw new ClarificationReplyNotTopLevelError();
      }
      throw new Error(`Failed to post the clarification message: ${error.message}`, {
        cause: error,
      });
    }

    return toDomain(data as unknown as ClarificationMessageRow);
  }
}
