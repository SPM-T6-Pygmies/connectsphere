import type { Brand } from "./brand";
import type { EventRequestId } from "./event-request";
import { InvalidClarificationMessageIdError } from "./errors";
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
 * A message that has not been stored yet, and so has no id.
 *
 * Same reasoning as `NewEventRequest`: `comment_id` is `generated always as
 * identity`, so the store chooses the id and hands it back.
 */
export type NewClarificationMessage = Omit<ClarificationMessage, "id">;

export function clarificationMessageId(raw: string): ClarificationMessageId {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new InvalidClarificationMessageIdError(raw);
  }
  return trimmed as ClarificationMessageId;
}
