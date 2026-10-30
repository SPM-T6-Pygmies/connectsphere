import { cancelEvent } from "../domain/event-cancellation";
import { CoordinatorEventNotFoundError } from "../domain/errors";
import { eventId } from "../domain/event";
import { userAccountId } from "../domain/user-account";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";
import type { Notifier } from "../ports/outbound/notifier";

export interface CancelEventCommand {
  readonly id: string;
  /** The Event Coordinator cancelling the event. */
  readonly userAccountId: string;
}

export interface CancelEventResult {
  readonly eventId: string;
  readonly status: "Cancelled";
}

export interface CancelEventDeps {
  readonly events: CoordinatorEventRepository;
  /** SPM-68: tells the event's Organiser it is cancelled. */
  readonly notifier: Pick<Notifier, "eventCancelled">;
}

/**
 * SPM-55: the assigned Event Coordinator cancels an event at any stage before
 * it is over, so the venues it holds are free for other events.
 *
 * Anyone else's event, or one assigned to no one, is refused exactly like one
 * that does not exist (#91), as `CompleteEventUseCase` does (AC1). Whether the
 * event can still be cancelled is the domain's `cancelEvent` call (AC2); the
 * repository releases its bookings in the same transaction (AC3, AC4). Telling
 * Attendees and Venue Staff is SPM-69 and SPM-63's.
 *
 * SPM-68: then it tells the event's Organiser. The cancellation is stored
 * first, so a notice that fails to send cannot undo it.
 */
export class CancelEventUseCase {
  constructor(private readonly deps: CancelEventDeps) {}

  async execute(command: CancelEventCommand): Promise<CancelEventResult> {
    const { events, notifier } = this.deps;
    const cancelledBy = userAccountId(command.userAccountId);

    const [event, owned] = await Promise.all([
      events.findAssigned(cancelledBy, command.id),
      events.findAssignedById(cancelledBy, eventId(command.id)),
    ]);
    if (event === null || owned === null) {
      throw new CoordinatorEventNotFoundError(command.id);
    }

    const status = cancelEvent(event);
    await events.cancelEvent(cancelledBy, event.id);

    await notifier.eventCancelled({
      recipientUserAccountId: owned.owningOrganiserUserAccountId,
      eventId: event.id,
      eventRequestId: event.eventRequestId,
      eventName: event.name,
    });

    return { eventId: event.id, status };
  }
}
