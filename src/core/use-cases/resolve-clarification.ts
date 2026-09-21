import { EventRequestNotFoundError } from "../domain/errors";
import {
  eventRequestAccessForCoordinator,
  eventRequestId,
  resolveClarification,
  type EventRequestStatus,
} from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface ResolveClarificationCommand {
  readonly id: string;
  /** The Event Coordinator who is no longer waiting. */
  readonly userAccountId: string;
}

export interface ResolveClarificationResult {
  readonly eventRequestId: string;
  readonly status: EventRequestStatus;
}

export interface ResolveClarificationDeps {
  readonly eventRequests: EventRequestRepository;
}

/**
 * SPM-33 AC6: the assigned Event Coordinator marks a clarification resolved,
 * putting the request back to awaiting their own decision.
 *
 * Takes no `ClarificationThreadRepository`, and that absence is the point
 * (decision 3): resolving is a statement about the Coordinator's own waiting,
 * not a message, so it writes no message -- just as a reply moves no status.
 * It is also optional (decision 4): `assertDecidable` admits `Returned`, so
 * approving or rejecting a returned request directly never comes through here.
 *
 * Same not-found rule as every other coordinator use case (#91).
 */
export class ResolveClarificationUseCase {
  constructor(private readonly deps: ResolveClarificationDeps) {}

  /** Throws `EventRequestNotFoundError` both when there is no such request and when it isn't assigned to this caller (#91). */
  async execute(command: ResolveClarificationCommand): Promise<ResolveClarificationResult> {
    const { eventRequests } = this.deps;
    const resolvedBy = userAccountId(command.userAccountId);

    const request = await eventRequests.findById(eventRequestId(command.id));
    if (
      request === null ||
      eventRequestAccessForCoordinator(request, { userAccountId: resolvedBy }) === "none"
    ) {
      throw new EventRequestNotFoundError(command.id);
    }

    const resolved = resolveClarification(request);

    await eventRequests.resolveClarification(resolved, resolvedBy);

    return { eventRequestId: resolved.id, status: resolved.status };
  }
}
