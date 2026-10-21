import { cancelEvent } from "../domain/event-cancellation";
import { CoordinatorEventNotFoundError } from "../domain/errors";
import { userAccountId } from "../domain/user-account";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";

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
}

/**
 * SPM-55: the assigned Event Coordinator cancels an event at any stage before
 * it is over, so the venues it holds are free for other events.
 *
 * Anyone else's event, or one assigned to no one, is refused exactly like one
 * that does not exist (#91), as `CompleteEventUseCase` does (AC1). Whether the
 * event can still be cancelled is the domain's `cancelEvent` call (AC2); the
 * repository releases its bookings in the same transaction (AC3, AC4). Telling
 * the Organiser, Attendees and Venue Staff is SPM-68, SPM-69 and SPM-63's.
 */
export class CancelEventUseCase {
  constructor(private readonly deps: CancelEventDeps) {}

  async execute(command: CancelEventCommand): Promise<CancelEventResult> {
    const { events } = this.deps;
    const cancelledBy = userAccountId(command.userAccountId);

    const event = await events.findAssigned(cancelledBy, command.id);
    if (event === null) {
      throw new CoordinatorEventNotFoundError(command.id);
    }

    const status = cancelEvent(event);
    await events.cancelEvent(cancelledBy, event.id);

    return { eventId: event.id, status };
  }
}
