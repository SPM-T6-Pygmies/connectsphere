import type { CoordinatorEventStatus } from "../domain/coordinator-event";
import { EventNotFoundError } from "../domain/errors";
import { eventId } from "../domain/event";
import { confirmEvent } from "../domain/event-readiness";
import { userAccountId } from "../domain/user-account";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";
import type { EventReadinessRepository } from "../ports/outbound/event-readiness-repository";

export interface ConfirmEventCommand {
  readonly id: string;
  /** The Event Coordinator confirming the event. */
  readonly userAccountId: string;
}

export interface ConfirmEventResult {
  readonly eventId: string;
  readonly status: CoordinatorEventStatus;
}

export interface ConfirmEventDeps {
  readonly events: CoordinatorEventRepository;
  readonly readiness: EventReadinessRepository;
}

/**
 * SPM-50: the assigned Event Coordinator confirms an event once every
 * essential arrangement is complete.
 *
 * An event assigned to someone else, or to no one, is refused exactly like an
 * event that does not exist -- mirrors `DecideEventRequestUseCase`'s
 * not-found-shaped authorisation (#91) for the same reason: a guess cannot
 * confirm an event exists. Whether the event can still be confirmed, and what
 * blocks it, are the domain's `confirmEvent` call, not this file's.
 */
export class ConfirmEventUseCase {
  constructor(private readonly deps: ConfirmEventDeps) {}

  /** Throws `EventNotFoundError` both when there is no such event and when it isn't assigned to this caller (#91). */
  async execute(command: ConfirmEventCommand): Promise<ConfirmEventResult> {
    const { events, readiness } = this.deps;
    const id = eventId(command.id);
    const confirmedBy = userAccountId(command.userAccountId);

    const event = await events.findById(id);
    if (event === null || event.assignedCoordinatorUserAccountId !== confirmedBy) {
      throw new EventNotFoundError(command.id);
    }

    const eventReadiness = await readiness.readinessFor(id);
    const confirmed = confirmEvent(event, eventReadiness);

    await events.confirmEvent(confirmed, confirmedBy);

    return { eventId: confirmed.id, status: confirmed.status };
  }
}
