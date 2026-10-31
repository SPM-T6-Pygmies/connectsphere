import {
  assertCanSubmitChangeRequest,
  chooseRequestedChanges,
  type RequestedChange,
} from "../domain/change-request";
import { eventRequestId } from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { ChangeRequestRepository } from "../ports/outbound/change-request-repository";
import type { Notifier } from "../ports/outbound/notifier";

export interface SubmitChangeRequestCommand {
  /** The approved event request whose event is to change. */
  readonly eventRequestId: string;
  /** The Event Organiser asking. */
  readonly userAccountId: string;
  readonly changes: readonly RequestedChange[];
}

export interface SubmitChangeRequestDeps {
  readonly changeRequests: ChangeRequestRepository;
  /** SPM-67: tells the event's assigned Coordinator what is asked. */
  readonly notifier: Pick<Notifier, "changeRequested">;
}

/**
 * SPM-52: the event's owning Organiser asks for one or more significant fields
 * to change. A change request is their only route to change a submitted event
 * (#102); the Coordinator decides each field (SPM-100).
 *
 * Who may ask is checked before what is asked, so a caller who does not own the
 * event learns nothing from a validation message (#91).
 *
 * SPM-67: then the event's assigned Coordinator is told what is asked,
 * whatever the event's status (#8). The request is stored first, so a notice
 * that fails to send cannot undo it.
 */
export class SubmitChangeRequestUseCase {
  constructor(private readonly deps: SubmitChangeRequestDeps) {}

  /** Throws `EventRequestNotFoundError` when there is no event the caller owns from this request. */
  async execute(command: SubmitChangeRequestCommand): Promise<void> {
    const id = eventRequestId(command.eventRequestId);
    const organiser = userAccountId(command.userAccountId);

    const target = await this.deps.changeRequests.findTarget(id);
    assertCanSubmitChangeRequest(target, organiser, command.eventRequestId);

    const changes = chooseRequestedChanges(command.changes);
    const changeRequestId = await this.deps.changeRequests.submit({
      eventRequestId: id,
      requestedBy: organiser,
      changes,
    });

    if (target.assignedCoordinatorUserAccountId !== null) {
      await this.deps.notifier.changeRequested({
        recipientUserAccountId: target.assignedCoordinatorUserAccountId,
        eventId: target.eventId,
        changeRequestId,
        eventName: target.eventName,
        changes,
      });
    }
  }
}
