import {
  assertCanSubmitChangeRequest,
  chooseRequestedChanges,
  type RequestedChange,
} from "../domain/change-request";
import { eventRequestId } from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { ChangeRequestRepository } from "../ports/outbound/change-request-repository";

export interface SubmitChangeRequestCommand {
  /** The approved event request whose event is to change. */
  readonly eventRequestId: string;
  /** The Event Organiser asking. */
  readonly userAccountId: string;
  readonly changes: readonly RequestedChange[];
}

export interface SubmitChangeRequestDeps {
  readonly changeRequests: ChangeRequestRepository;
}

/**
 * SPM-52: the event's owning Organiser asks for one or more significant fields
 * to change. A change request is their only route to change a submitted event
 * (#102); the Coordinator decides each field (SPM-100).
 *
 * Who may ask is checked before what is asked, so a caller who does not own the
 * event learns nothing from a validation message (#91).
 */
export class SubmitChangeRequestUseCase {
  constructor(private readonly deps: SubmitChangeRequestDeps) {}

  /** Throws `EventRequestNotFoundError` when there is no event the caller owns from this request. */
  async execute(command: SubmitChangeRequestCommand): Promise<void> {
    const id = eventRequestId(command.eventRequestId);
    const organiser = userAccountId(command.userAccountId);

    const target = await this.deps.changeRequests.findTarget(id);
    assertCanSubmitChangeRequest(target, organiser, command.eventRequestId);

    await this.deps.changeRequests.submit({
      eventRequestId: id,
      requestedBy: organiser,
      changes: chooseRequestedChanges(command.changes),
    });
  }
}
