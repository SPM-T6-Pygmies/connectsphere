import type { Brand } from "./brand";
import type { EventRequestId } from "./event-request";
import {
  ClarificationReplyNotTopLevelError,
  InvalidClarificationMessageIdError,
} from "./errors";
import type { UserAccountId } from "./user-account";

export type ClarificationMessageId = Brand<string, "ClarificationMessageId">;

/**
 * One thing said on an event request's clarification thread (SPM-33 AC4).
 *
 * Deliberately not an "event comment": `event_comment` hangs off `event`, and
 * per #80 the request and the event are separate records -- a request's thread
 * exists before any event does, and a rejected request never gets one at all.
 *
 * A message carries no status of its own and moves nothing. That is SPM-33
 * decision 3: replies never resume the request, so the conversation and the
 * state machine stay independent records and a reply cannot get the state
 * machine wrong.
 */
export interface ClarificationMessage {
  readonly id: ClarificationMessageId;
  readonly eventRequestId: EventRequestId;
  /** Whoever said it -- the assigned Coordinator or the responsible Organiser. */
  readonly authorUserAccountId: UserAccountId;
  readonly body: string;
  readonly postedAt: Date;
  /**
   * The top-level message this is a reply to, or `null` for a top-level
   * message of its own.
   *
   * Threading is one level (SPM-33 decision 6, following Linear): a reply's
   * parent must itself be top-level. The type makes the shape expressible; the
   * rule is enforced in the SQL function, where it holds for real, as well as
   * in the use case.
   */
  readonly parentId: ClarificationMessageId | null;
}

/**
 * A message that has not been stored yet, so it has neither an id nor a time.
 *
 * Same reasoning as `NewEventRequest`: `comment_id` is `generated always as
 * identity` and `created_at` has a default, so the store chooses both and
 * hands them back. `postedAt` is a `created_at`, not a business timestamp --
 * no rule reads it -- which is why the core does not need a `Clock` to append
 * to a thread.
 */
export type NewClarificationMessage = Omit<ClarificationMessage, "id" | "postedAt">;

export function clarificationMessageId(raw: string): ClarificationMessageId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvalidClarificationMessageIdError(raw);
  }
  return trimmed as ClarificationMessageId;
}

/**
 * The parent a reply may hang off, given the thread as it stands (SPM-33
 * decision 6).
 *
 * Threading is one level, following Linear: a reply's parent must itself be
 * top-level, and must be a message on this same thread. `null` in, `null` out
 * -- a message with no parent is top-level itself.
 *
 * A business rule rather than a use-case check, because both sides of the
 * exchange are bound by it and neither should restate it. The store enforces
 * it too (`post_event_request_clarification_message`), where it holds against
 * a caller that never came through here.
 */
export function topLevelParentFor(
  thread: readonly ClarificationMessage[],
  parentId: ClarificationMessageId | null,
): ClarificationMessageId | null {
  if (parentId === null) {
    return null;
  }

  const parent = thread.find((message) => message.id === parentId);
  if (parent === undefined || parent.parentId !== null) {
    throw new ClarificationReplyNotTopLevelError();
  }

  return parentId;
}
