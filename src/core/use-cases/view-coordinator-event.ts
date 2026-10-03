import type { CoordinatorEvent } from "../domain/coordinator-event";
import { eventId } from "../domain/event";
import {
  blockingArrangements,
  canConfirm,
  type ArrangementType,
  type EventReadiness,
} from "../domain/event-readiness";
import { userAccountId } from "../domain/user-account";
import type { ClientOrganisationRepository } from "../ports/outbound/client-organisation-repository";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";
import type { EventReadinessRepository } from "../ports/outbound/event-readiness-repository";
import type { UserAccountRepository } from "../ports/outbound/user-account-repository";

export interface ViewCoordinatorEventCommand {
  readonly id: string;
  readonly userAccountId: string;
}

export interface ViewCoordinatorEventResult {
  readonly event: CoordinatorEvent;
  readonly clientOrganisationName: string;
  readonly owningOrganiserName: string;
  readonly readiness: EventReadiness;
  readonly canConfirm: boolean;
  /** What blocks confirmation right now -- empty when `canConfirm` is true. */
  readonly blockingArrangements: readonly ArrangementType[];
}

export interface ViewCoordinatorEventDeps {
  readonly events: CoordinatorEventRepository;
  readonly readiness: EventReadinessRepository;
  readonly clientOrganisations: ClientOrganisationRepository;
  readonly userAccounts: UserAccountRepository;
}

/**
 * SPM-50: one event, and its confirmation readiness, to the Event Coordinator
 * it is assigned to -- hosts the new single-event route's "Confirm event"
 * gate. Also resolves the event's own client organisation and requesting
 * Organiser by name, the same way `ViewAssignedEventRequestUseCase` resolves
 * a request's, so the coordinator sees what they are confirming rather than
 * a bare readiness table.
 *
 * An event assigned to a different coordinator, or not yet assigned at all,
 * comes back the same as an event that does not exist, mirroring
 * `ViewAssignedEventRequestUseCase`'s not-found-shaped scoping (#91).
 */
export class ViewCoordinatorEventUseCase {
  constructor(private readonly deps: ViewCoordinatorEventDeps) {}

  /** Null when there is no such event, or it isn't assigned to this caller (#91). */
  async execute(command: ViewCoordinatorEventCommand): Promise<ViewCoordinatorEventResult | null> {
    const id = eventId(command.id);
    const caller = userAccountId(command.userAccountId);

    const event = await this.deps.events.findById(id);
    if (event === null || event.assignedCoordinatorUserAccountId !== caller) {
      return null;
    }

    const [readiness, organisationNames, organiserNames] = await Promise.all([
      this.deps.readiness.readinessFor(id),
      this.deps.clientOrganisations.findNamesByIds([event.clientOrganisationId]),
      this.deps.userAccounts.findNamesByIds([event.owningOrganiserUserAccountId]),
    ]);

    return {
      event,
      clientOrganisationName: organisationNames.get(event.clientOrganisationId) ?? "",
      owningOrganiserName: organiserNames.get(event.owningOrganiserUserAccountId) ?? "",
      readiness,
      canConfirm: canConfirm(event, readiness),
      blockingArrangements: blockingArrangements(readiness),
    };
  }
}
