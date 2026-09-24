import { EventRequestNotFoundError } from "../domain/errors";
import {
  eventRequestAccessForCoordinator,
  eventRequestId,
  withdrawEventRequest,
  type EventRequestStatus,
} from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface WithdrawEventRequestCommand {
  readonly id: string;
  /** The Event Coordinator recording the withdrawal. */
  readonly userAccountId: string;
  /** Optional -- a blank note records nothing. */
  readonly note: string;
}

export interface WithdrawEventRequestResult {
  readonly eventRequestId: string;
  readonly status: EventRequestStatus;
}

export interface WithdrawEventRequestDeps {
  readonly eventRequests: EventRequestRepository;
}

/**
 * SPM-101: the assigned Event Coordinator records a withdrawal the Organiser
 * asked for outside the system (#103).
 *
 * Its own use case rather than a third branch of `DecideEventRequestUseCase`:
 * a withdrawal is the Organiser's choice, not the Coordinator's decision, and
 * it has its own source-state rule -- which is `withdrawEventRequest`'s call,
 * not this file's. Who may withdraw is asked the same way as who may decide.
 */
export class WithdrawEventRequestUseCase {
  constructor(private readonly deps: WithdrawEventRequestDeps) {}

  /** Throws `EventRequestNotFoundError` both when there is no such request and when it isn't assigned to this caller (#91). */
  async execute(command: WithdrawEventRequestCommand): Promise<WithdrawEventRequestResult> {
    const { eventRequests } = this.deps;
    const withdrawnBy = userAccountId(command.userAccountId);

    const request = await eventRequests.findById(eventRequestId(command.id));
    if (
      request === null ||
      eventRequestAccessForCoordinator(request, { userAccountId: withdrawnBy }) === "none"
    ) {
      throw new EventRequestNotFoundError(command.id);
    }

    const withdrawn = withdrawEventRequest(request, command.note);
    await eventRequests.withdrawEventRequest(withdrawn, withdrawnBy);
    return { eventRequestId: withdrawn.id, status: withdrawn.status };
  }
}
