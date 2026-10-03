import {
  clarificationMessageId,
  isLastOpenClarificationRequest,
  resolvableClarificationRequest,
} from "../domain/clarification-message";
import { ClarificationThreadClosedError, EventRequestNotFoundError } from "../domain/errors";
import {
  canDiscussEventRequest,
  eventRequestAccessForCoordinator,
  eventRequestId,
  resolveClarification,
  type EventRequestStatus,
} from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { ClarificationThreadRepository } from "../ports/outbound/clarification-thread-repository";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface ResolveClarificationThreadCommand {
  readonly id: string;
  /** The Event Coordinator who is no longer waiting on this question. */
  readonly userAccountId: string;
  /** The question being marked answered. */
  readonly clarificationMessageId: string;
}

export interface ResolveClarificationThreadResult {
  readonly eventRequestId: string;
  readonly status: EventRequestStatus;
  /** True when this cleared the last question and the request rejoined the decision queue. */
  readonly resumed: boolean;
}

export interface ResolveClarificationThreadDeps {
  readonly eventRequests: EventRequestRepository;
  readonly clarificationThread: ClarificationThreadRepository;
}

/**
 * SPM-33 AC6: the assigned Event Coordinator marks one question answered.
 *
 * Per question rather than per request, following Linear's comment threads: a
 * Coordinator can have two outstanding at once (decision 5), and answering one
 * of them is not the same as no longer waiting. So the request only goes back
 * to awaiting the Coordinator's own decision when the last open question is
 * cleared -- and until then it keeps its waiting-on-the-Organiser label while
 * staying perfectly decidable (decision 4).
 *
 * Still nothing in the thread calls this. A reply never resolves anything
 * (decision 3); only the Coordinator saying so does. Resolving writes no
 * message of its own, which is why it takes no body.
 */
export class ResolveClarificationThreadUseCase {
  constructor(private readonly deps: ResolveClarificationThreadDeps) {}

  /** Throws `EventRequestNotFoundError` both when there is no such request and when it isn't assigned to this caller (#91). */
  async execute(
    command: ResolveClarificationThreadCommand,
  ): Promise<ResolveClarificationThreadResult> {
    const { eventRequests, clarificationThread } = this.deps;
    const resolvedBy = userAccountId(command.userAccountId);
    const id = eventRequestId(command.id);

    const request = await eventRequests.findById(id);
    if (
      request === null ||
      eventRequestAccessForCoordinator(request, { userAccountId: resolvedBy }) === "none"
    ) {
      throw new EventRequestNotFoundError(command.id);
    }

    if (!canDiscussEventRequest(request.status)) {
      throw new ClarificationThreadClosedError();
    }

    const messageId = clarificationMessageId(command.clarificationMessageId);
    const thread = await clarificationThread.messagesFor(id);

    // Refuses an ordinary comment, one already resolved, and one on another
    // request -- all before anything is written.
    resolvableClarificationRequest(thread, messageId);

    // A request can be `Returned` with two questions open, so clearing one is
    // not always the end of the wait. `resolveClarification` is only taken
    // when it is.
    const resumed =
      request.status === "Returned" && isLastOpenClarificationRequest(thread, messageId);

    await eventRequests.resolveClarificationThread(
      resumed ? resolveClarification(request) : request,
      resolvedBy,
      messageId,
    );

    return {
      eventRequestId: request.id,
      status: resumed ? "Under Review" : request.status,
      resumed,
    };
  }
}
