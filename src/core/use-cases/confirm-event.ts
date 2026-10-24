import type { CoordinatorEventStatus } from "../domain/coordinator-event";
import { EventNotFoundError } from "../domain/errors";
import { eventId } from "../domain/event";
import { assessReadiness, confirmedArrangements, confirmEvent } from "../domain/event-readiness";
import { userAccountId } from "../domain/user-account";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";
import type { EventReadinessRepository } from "../ports/outbound/event-readiness-repository";
import type { Notifier } from "../ports/outbound/notifier";
import type { SafetyCheckRepository } from "../ports/outbound/safety-check-repository";

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
  /** SPM-264: the event's safety checks, newest first. */
  readonly safetyChecks: Pick<SafetyCheckRepository, "history">;
  /** SPM-66: tells the event's Organiser it is confirmed. */
  readonly notifier: Pick<Notifier, "eventConfirmed">;
}

/**
 * SPM-50: the assigned Event Coordinator confirms an event once every
 * essential arrangement is complete.
 *
 * An event assigned to someone else, or to no one, is refused exactly like an
 * event that does not exist -- mirrors `DecideEventRequestUseCase`'s
 * not-found-shaped authorisation (#91) for the same reason: a guess cannot
 * confirm an event exists. Whether the event can still be confirmed, and what
 * blocks it -- an incomplete arrangement, or a safety check not Approved
 * (SPM-264) -- are the domain's `confirmEvent` call, not this file's.
 *
 * SPM-66: then it tells the event's Organiser, listing the essential
 * arrangements. The confirmation is stored first, so a notice that fails to
 * send cannot undo it; composition's notifier records a failure rather than
 * throwing.
 */
export class ConfirmEventUseCase {
  constructor(private readonly deps: ConfirmEventDeps) {}

  /** Throws `EventNotFoundError` both when there is no such event and when it isn't assigned to this caller (#91). */
  async execute(command: ConfirmEventCommand): Promise<ConfirmEventResult> {
    const { events, readiness, safetyChecks, notifier } = this.deps;
    const id = eventId(command.id);
    const confirmedBy = userAccountId(command.userAccountId);

    const event = await events.findAssignedById(confirmedBy, id);
    const [facts, history, details] =
      event === null
        ? [null, null, null]
        : await Promise.all([
            readiness.factsFor(confirmedBy, id),
            safetyChecks.history(confirmedBy, id),
            events.findAssigned(confirmedBy, id),
          ]);
    if (event === null || facts === null || history === null || details === null) {
      throw new EventNotFoundError(command.id);
    }

    const eventReadiness = assessReadiness(facts);
    const confirmed = confirmEvent(event, eventReadiness, history.checks[0] ?? null);

    await events.confirmEvent(confirmed, confirmedBy);

    const { venueLocation, equipment } = confirmedArrangements(facts);
    await notifier.eventConfirmed({
      recipientUserAccountId: confirmed.owningOrganiserUserAccountId,
      eventId: confirmed.id,
      eventRequestId: details.eventRequestId,
      eventName: confirmed.name,
      times: details.times,
      venueLocation,
      equipment,
    });

    return { eventId: confirmed.id, status: confirmed.status };
  }
}
