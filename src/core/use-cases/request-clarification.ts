import { EventRequestNotFoundError } from "../domain/errors";
import {
  eventRequestAccessForCoordinator,
  eventRequestId,
  returnEventRequest,
  type EventRequestStatus,
} from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface RequestClarificationCommand {
  readonly id: string;
  /** The Event Coordinator asking. */
  readonly userAccountId: string;
  /** What needs clarifying. Blank is refused by the domain. */
  readonly message: string;
}

export interface RequestClarificationResult {
  readonly eventRequestId: string;
  readonly status: EventRequestStatus;
}

export interface RequestClarificationDeps {
  readonly eventRequests: EventRequestRepository;
}

/**
 * SPM-33 AC1-AC2: the assigned Event Coordinator returns a request to the
 * Organiser with a question ([[event-request-workflow]] Steps 4-5).
 *
 * A request assigned to someone else, or to no one, is refused exactly like a
 * request that does not exist (#91), as `DecideEventRequestUseCase` does.
 * Whether the request can still be returned, and whether the message says
 * anything, are `returnEventRequest`'s calls, not this file's.
 *
 * The transition is taken before the write, so a refused return leaves both
 * the request and the thread untouched. The write itself is one call rather
 * than a status write followed by an append: the store does both together, so
 * there is no half-done return where the request is `Returned` but the
 * question it was returned with was lost.
 *
 * Notifying the Organiser is SPM-59's, not this use case's.
 */
export class RequestClarificationUseCase {
  constructor(private readonly deps: RequestClarificationDeps) {}

  /** Throws `EventRequestNotFoundError` both when there is no such request and when it isn't assigned to this caller (#91). */
  async execute(command: RequestClarificationCommand): Promise<RequestClarificationResult> {
    const { eventRequests } = this.deps;
    const returnedBy = userAccountId(command.userAccountId);

    const request = await eventRequests.findById(eventRequestId(command.id));
    if (
      request === null ||
      eventRequestAccessForCoordinator(request, { userAccountId: returnedBy }) === "none"
    ) {
      throw new EventRequestNotFoundError(command.id);
    }

    const returned = returnEventRequest(request, command.message);

    await eventRequests.returnEventRequest(returned, returnedBy, command.message);

    return { eventRequestId: returned.id, status: returned.status };
  }
}
