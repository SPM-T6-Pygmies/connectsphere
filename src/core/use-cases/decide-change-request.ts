import {
  assertCanDecideChangeRequest,
  changeRequestId,
  decideChangeRequest,
  type ChangeRequestItem,
  type ItemDecision,
  type Revalidation,
} from "../domain/change-request";
import { eventId } from "../domain/event";
import { userAccountId } from "../domain/user-account";
import type { ChangeRequestRepository } from "../ports/outbound/change-request-repository";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";

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
  /** Always false until SPM-433 adds the lapse-confirmation step. */
  readonly lapsed: boolean;
}

/**
 * SPM-100: the event's assigned Coordinator accepts or declines each field of
 * a change request in one save (#104). Accepted values are applied to the
 * event; declined ones change nothing.
 *
 * Who may decide is checked before what is decided, so a caller the event is
 * not assigned to learns nothing from a validation message (#91).
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

    return {
      items: decision.items,
      rescheduled: decision.rescheduled,
      revalidation: decision.revalidation,
      lapsed: false,
    };
  }
}
