import {
  clarificationMessageId,
  topLevelParentFor,
} from "../domain/clarification-message";
import { ClarificationMessageRequiredError, EventRequestNotFoundError } from "../domain/errors";
import { eventRequestAccessForCoordinator, eventRequestId } from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { ClarificationThreadRepository } from "../ports/outbound/clarification-thread-repository";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface PostCoordinatorClarificationMessageCommand {
  readonly id: string;
  /** The assigned Event Coordinator. */
  readonly userAccountId: string;
  readonly body: string;
  /** The top-level message being replied to, or `null` to start a new one. */
  readonly parentId: string | null;
}

export interface PostCoordinatorClarificationMessageResult {
  readonly clarificationMessageId: string;
}

export interface PostCoordinatorClarificationMessageDeps {
  readonly eventRequests: EventRequestRepository;
  readonly clarificationThread: ClarificationThreadRepository;
}

/**
 * SPM-33 AC5: the assigned Event Coordinator says something more on the
 * thread, without returning the request again.
 *
 * The Coordinator's counterpart to `PostClarificationMessageUseCase`, and the
 * reason it exists separately: AC5 lets both sides exchange *any number* of
 * messages, and the Coordinator's only other way onto the thread is
 * `RequestClarification`, which moves the status. Following up on your own
 * question should not re-return a request -- and after a Resolve it would drag
 * it back out of the decision queue, which is exactly what decision 3 rules
 * out.
 *
 * Same guard as every other coordinator use case: the request must be assigned
 * to the caller, and anything else is not-found (#91). Same append-only
 * behaviour as the Organiser's: no status transition, no `EventRequest` write.
 */
export class PostCoordinatorClarificationMessageUseCase {
  constructor(private readonly deps: PostCoordinatorClarificationMessageDeps) {}

  /** Throws `EventRequestNotFoundError` both when there is no such request and when it isn't assigned to this caller (#91). */
  async execute(
    command: PostCoordinatorClarificationMessageCommand,
  ): Promise<PostCoordinatorClarificationMessageResult> {
    const { eventRequests, clarificationThread } = this.deps;
    const author = userAccountId(command.userAccountId);
    const id = eventRequestId(command.id);

    const request = await eventRequests.findById(id);
    if (
      request === null ||
      eventRequestAccessForCoordinator(request, { userAccountId: author }) === "none"
    ) {
      throw new EventRequestNotFoundError(command.id);
    }

    const body = command.body.trim();
    if (body.length === 0) {
      throw new ClarificationMessageRequiredError();
    }

    const parentId = topLevelParentFor(
      await clarificationThread.messagesFor(id),
      command.parentId === null ? null : clarificationMessageId(command.parentId),
    );

    const stored = await clarificationThread.append({
      eventRequestId: id,
      authorUserAccountId: author,
      body,
      parentId,
    });

    return { clarificationMessageId: stored.id };
  }
}
