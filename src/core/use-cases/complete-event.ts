import type { CoordinatorEventStatus } from "../domain/coordinator-event";
import { completeEvent } from "../domain/event-completion";
import { CoordinatorEventNotFoundError } from "../domain/errors";
import { userAccountId } from "../domain/user-account";
import type { Clock } from "../ports/outbound/clock";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";

export interface CompleteEventCommand {
  readonly id: string;
  /** The Event Coordinator marking the event completed. */
  readonly userAccountId: string;
  /** Operational notes recorded at completion; blank keeps the ones already there. */
  readonly notes?: string;
}

export interface CompleteEventResult {
  readonly eventId: string;
  readonly status: CoordinatorEventStatus;
}

export interface CompleteEventDeps {
  readonly events: CoordinatorEventRepository;
  readonly clock: Clock;
}

/**
 * SPM-51: the assigned Event Coordinator marks a Confirmed event Completed
 * once it has ended, optionally recording operational notes.
 *
 * Anyone else's event, or one assigned to no one, is refused exactly like one
 * that does not exist (#91), as `ConfirmEventUseCase` does. Whether the event
 * can be completed yet, and which notes are stored, are the domain's
 * `completeEvent` call; the repository audits the completion against the
 * coordinator.
 */
export class CompleteEventUseCase {
  constructor(private readonly deps: CompleteEventDeps) {}

  async execute(command: CompleteEventCommand): Promise<CompleteEventResult> {
    const { events, clock } = this.deps;
    const completedBy = userAccountId(command.userAccountId);

    const event = await events.findAssigned(completedBy, command.id);
    if (event === null) {
      throw new CoordinatorEventNotFoundError(command.id);
    }

    const completion = completeEvent(event, clock.now(), command.notes);
    await events.completeEvent(completedBy, event.id, completion.operationalNotes);

    return { eventId: event.id, status: completion.status };
  }
}
