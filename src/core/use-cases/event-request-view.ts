import type { ClarificationMessage } from "../domain/clarification-message";
import type {
  EventRequest,
  EventRequestDetails,
  EventRequestStatus,
} from "../domain/event-request";
import type { UserAccountId } from "../domain/user-account";

/**
 * One event request as a detail screen shows it.
 *
 * Plain data, like `OperationsEventRequest`: a string id and an ISO timestamp
 * rather than a branded id and a `Date`, so a page renders it without knowing
 * the domain's types.
 */
export interface EventRequestView {
  readonly id: string;
  readonly status: EventRequestStatus;
  readonly details: EventRequestDetails;
  readonly decisionRecord: string | null;
  /** ISO 8601. Null for a request still in Draft -- it has never been submitted. */
  readonly submittedAt: string | null;
}

/** Domain object to the detail screens' view. */
export function toEventRequestView(request: EventRequest): EventRequestView {
  return {
    id: request.id,
    status: request.status,
    details: request.details,
    decisionRecord: request.decisionRecord,
    submittedAt: request.submittedAt?.toISOString() ?? null,
  };
}

/**
 * One message on a request's clarification thread, as a detail screen shows it
 * (SPM-33 AC4).
 *
 * Plain data like `EventRequestView`: string ids, an ISO timestamp, and the
 * author's name already resolved, so the panel renders a conversation without
 * a second round trip per message.
 */
export interface ClarificationMessageView {
  readonly id: string;
  readonly authorName: string;
  readonly body: string;
  /** ISO 8601. */
  readonly postedAt: string;
  /** The top-level message this replies to, or null. Threading is one level (decision 6). */
  readonly parentId: string | null;
}

/**
 * Domain messages to the panel's view, oldest first.
 *
 * `authorNames` is the batched lookup the calling use case already makes for
 * the request's own people -- one round trip for the whole thread rather than
 * one per message.
 */
export function toClarificationThreadView(
  messages: readonly ClarificationMessage[],
  authorNames: ReadonlyMap<UserAccountId, string>,
): readonly ClarificationMessageView[] {
  return messages.map((message) => ({
    id: message.id,
    authorName: authorNames.get(message.authorUserAccountId) ?? "",
    body: message.body,
    postedAt: message.postedAt.toISOString(),
    parentId: message.parentId,
  }));
}
