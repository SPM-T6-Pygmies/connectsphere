import { EventRequestNotFoundError } from "../domain/errors";
import {
  approveEventRequest,
  eventRequestAccessForCoordinator,
  eventRequestId,
  rejectEventRequest,
  type EventRequestStatus,
} from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface DecideEventRequestCommand {
  readonly id: string;
  /** The Event Coordinator making the decision. */
  readonly userAccountId: string;
  readonly decision: "approve" | "reject";
  /** The reason when rejecting (required), or an optional note when approving. */
  readonly decisionRecord: string;
}

export interface DecideEventRequestResult {
  readonly eventRequestId: string;
  readonly status: EventRequestStatus;
}

export interface DecideEventRequestDeps {
  readonly eventRequests: EventRequestRepository;
}

/**
 * SPM-34: the assigned Event Coordinator approves or rejects an event request.
 *
 * A request assigned to someone else, or to no one, is refused exactly like a
 * request that does not exist -- `eventRequestAccessForCoordinator`'s "none"
 * is deliberately not distinguishable from not-found (#91). Whether the
 * request can still be decided, and whether a rejection has its reason, are
 * the domain transitions' calls, not this file's.
 */
export class DecideEventRequestUseCase {
  constructor(private readonly deps: DecideEventRequestDeps) {}

  /** Throws `EventRequestNotFoundError` both when there is no such request and when it isn't assigned to this caller (#91). */
  async execute(command: DecideEventRequestCommand): Promise<DecideEventRequestResult> {
    const { eventRequests } = this.deps;
    const decidedBy = userAccountId(command.userAccountId);

    const request = await eventRequests.findById(eventRequestId(command.id));
    if (
      request === null ||
      eventRequestAccessForCoordinator(request, { userAccountId: decidedBy }) === "none"
    ) {
      throw new EventRequestNotFoundError(command.id);
    }

    if (command.decision === "approve") {
      const approved = approveEventRequest(request, command.decisionRecord);
      await eventRequests.approveEventRequest(approved, decidedBy);
      return { eventRequestId: approved.id, status: approved.status };
    }

    const rejected = rejectEventRequest(request, command.decisionRecord);
    await eventRequests.rejectEventRequest(rejected, decidedBy);
    return { eventRequestId: rejected.id, status: rejected.status };
  }
}
