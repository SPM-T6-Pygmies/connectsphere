import {
  clarificationMessageId,
  type ClarificationMessage,
  type NewClarificationMessage,
} from "@/core/domain/clarification-message";
import { eventRequestId } from "@/core/domain/event-request";
import { userAccountId } from "@/core/domain/user-account";

import { toKey } from "./event-request-mapper";

/**
 * The `event_request_comment` table's shape, named the way the database names
 * it.
 *
 * Mirrors `event_comment`'s columns because the two are the same idea against
 * different records -- see the migration for why a request's thread is not an
 * event's.
 */
export interface ClarificationMessageRow {
  comment_id: number;
  event_request_id: number;
  author_user_account_id: number;
  parent_comment_id: number | null;
  body: string;
  created_at: string;
}

export function toDomain(row: ClarificationMessageRow): ClarificationMessage {
  return {
    id: clarificationMessageId(String(row.comment_id)),
    eventRequestId: eventRequestId(String(row.event_request_id)),
    authorUserAccountId: userAccountId(String(row.author_user_account_id)),
    body: row.body,
    postedAt: new Date(row.created_at),
    parentId:
      row.parent_comment_id === null
        ? null
        : clarificationMessageId(String(row.parent_comment_id)),
  };
}

/**
 * Arguments for `post_event_request_clarification_message`.
 *
 * Returns `null` when any id is not a key this store could hold, matching
 * `toDecideArgs` and friends -- a malformed id is the caller's bug, not a
 * round trip worth making.
 */
export function toPostArgs(message: NewClarificationMessage): Record<string, unknown> | null {
  const requestKey = toKey(message.eventRequestId);
  const authorKey = toKey(message.authorUserAccountId);
  const parentKey = message.parentId === null ? null : toKey(message.parentId);

  if (requestKey === null || authorKey === null || (message.parentId !== null && parentKey === null)) {
    return null;
  }

  return {
    p_event_request_id: requestKey,
    p_author_user_account_id: authorKey,
    p_body: message.body,
    p_parent_comment_id: parentKey,
  };
}
