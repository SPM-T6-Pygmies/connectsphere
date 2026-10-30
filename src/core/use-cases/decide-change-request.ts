import {
  assertCanDecideChangeRequest,
  changeRequestId,
  decideChangeRequest,
  type ChangeRequest,
  type ChangeRequestItem,
  type ItemDecision,
  type Revalidation,
} from "../domain/change-request";
import { eventId } from "../domain/event";
import { userAccountId, type UserAccountId } from "../domain/user-account";
import type { ChangeRequestRepository } from "../ports/outbound/change-request-repository";
import type { ConfirmationLapses } from "../ports/outbound/confirmation-lapses";
import type {
  CoordinatorEventDetails,
  CoordinatorEventRepository,
} from "../ports/outbound/coordinator-event-repository";
import type { EventReadinessRepository } from "../ports/outbound/event-readiness-repository";
import type { Notifier } from "../ports/outbound/notifier";
import type { AttendeeChangeAnnouncer } from "./announce-event-change-to-attendees";

export interface DecideChangeRequestCommand {
  readonly eventId: string;
  readonly changeRequestId: string;
  /** The Event Coordinator deciding. */
  readonly userAccountId: string;
  readonly decisions: readonly ItemDecision[];
}

export interface DecideChangeRequestDeps {
  readonly changeRequests: ChangeRequestRepository;
  readonly coordinatorEvents: CoordinatorEventRepository;
  /** SPM-111: whether the decision took the event out of Confirmed. */
  readonly lapses: ConfirmationLapses;
  /**
   * SPM-68: tells the event's Organiser it is rescheduled. SPM-110: tells the
   * Organiser who asked each field's outcome. SPM-111: tells the event's
   * Organiser it is no longer confirmed.
   */
  readonly notifier: Pick<Notifier, "eventRescheduled" | "changeRequestDecided" | "eventNoLongerConfirmed">;
  /** SPM-69: emails every Registered attendee of a reschedule, with the venue it now holds. */
  readonly attendees: Pick<AttendeeChangeAnnouncer, "announce">;
  readonly readiness: Pick<EventReadinessRepository, "factsFor">;
}

/**
 * What the decision did. The notices read it once it is saved: the
 * Organiser's outcome (SPM-110) always, a reschedule (SPM-68, SPM-69) when the
 * times were accepted, and a lapse (SPM-111) otherwise.
 */
export interface ChangeRequestOutcome {
  readonly items: readonly ChangeRequestItem[];
  readonly rescheduled: boolean;
  readonly revalidation: Revalidation;
  /** SPM-111: the decision took the event from Confirmed back to Planning. */
  readonly lapsed: boolean;
}

/**
 * SPM-100: the event's assigned Coordinator accepts or declines each field of
 * a change request in one save (#104). Accepted values are applied to the
 * event; declined ones change nothing.
 *
 * Who may decide is checked before what is decided, so a caller the event is
 * not assigned to learns nothing from a validation message (#91).
 *
 * SPM-110: once the decision is stored, the Organiser who asked is told every
 * field's outcome in one notice.
 *
 * SPM-68: an accepted change of times is a reschedule, so the event's
 * Organiser is told the new times once the decision is stored. SPM-69: so is
 * every Registered attendee, by email, with the venue.
 *
 * SPM-111: the store lapses a Confirmed event the decision leaves short of the
 * confirm gate, in the same transaction. Its Organiser is told, unless the
 * decision was a reschedule: that notice already says it is back in Planning
 * (AC4).
 */
export class DecideChangeRequestUseCase {
  constructor(private readonly deps: DecideChangeRequestDeps) {}

  /** Throws `ChangeRequestNotFoundError` when the caller has no such request on an event assigned to them. */
  async execute(command: DecideChangeRequestCommand): Promise<ChangeRequestOutcome> {
    const coordinator = userAccountId(command.userAccountId);
    const id = changeRequestId(command.changeRequestId);

    const event = await this.deps.coordinatorEvents.findAssigned(coordinator, command.eventId);
    const requests =
      event === null ? [] : await this.deps.changeRequests.listForEvent(coordinator, eventId(command.eventId));
    const request = requests.find((candidate) => candidate.id === id) ?? null;
    assertCanDecideChangeRequest(event, request, command.changeRequestId);

    const decision = decideChangeRequest(request, command.decisions, event?.times ?? []);
    await this.deps.changeRequests.decide(coordinator, id, decision.items);
    const [lapse] = await this.deps.lapses.causedBy(coordinator, "change-request", id);

    const outcome: ChangeRequestOutcome = {
      items: decision.items,
      rescheduled: decision.rescheduled,
      revalidation: decision.revalidation,
      lapsed: lapse !== undefined,
    };
    if (event !== null) {
      await this.announceOutcome(event, request, outcome);
    }
    if (event !== null && outcome.rescheduled) {
      await this.announceReschedule(coordinator, event, outcome);
    }
    if (lapse !== undefined && !outcome.rescheduled) {
      await this.deps.notifier.eventNoLongerConfirmed({
        recipientUserAccountId: lapse.owningOrganiserUserAccountId,
        eventId: lapse.eventId,
        eventRequestId: lapse.eventRequestId,
        eventName: lapse.eventName,
        lapsed: lapse.lapsed,
      });
    }
    return outcome;
  }

  private async announceOutcome(
    event: CoordinatorEventDetails,
    request: ChangeRequest,
    outcome: ChangeRequestOutcome,
  ): Promise<void> {
    await this.deps.notifier.changeRequestDecided({
      recipientUserAccountId: request.requestedBy,
      eventId: event.id,
      changeRequestId: request.id,
      eventRequestId: event.eventRequestId,
      eventName: event.name,
      accepted: outcome.items.flatMap((item) => (item.decision === "Accepted" ? [item.change] : [])),
      declined: outcome.items.flatMap((item) =>
        item.decision === "Declined" ? [{ change: item.change, reason: item.reason }] : [],
      ),
    });
  }

  private async announceReschedule(
    coordinator: UserAccountId,
    event: CoordinatorEventDetails,
    outcome: ChangeRequestOutcome,
  ): Promise<void> {
    const times = outcome.items.find((item) => item.decision === "Accepted" && item.change.field === "times");
    const owned = await this.deps.coordinatorEvents.findAssignedById(coordinator, eventId(event.id));
    if (times?.change.field !== "times" || owned === null) {
      return;
    }
    await this.deps.notifier.eventRescheduled({
      recipientUserAccountId: owned.owningOrganiserUserAccountId,
      eventId: event.id,
      eventRequestId: event.eventRequestId,
      eventName: event.name,
      times: times.change.value,
      backToPlanning: outcome.lapsed,
    });

    const facts = await this.deps.readiness.factsFor(coordinator, eventId(event.id));
    await this.deps.attendees.announce(eventId(event.id), event.name, {
      kind: "rescheduled",
      times: times.change.value,
      venueName: facts?.confirmedVenueLocation ?? null,
    });
  }
}
