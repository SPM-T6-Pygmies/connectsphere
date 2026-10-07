import { reassignEventCoordinator } from "../domain/coordinator-workload";
import { EventCoordinatorNotFoundError, EventNotFoundError } from "../domain/errors";
import { eventId } from "../domain/event";
import { userAccountId } from "../domain/user-account";
import type { ClientOrganisationRepository } from "../ports/outbound/client-organisation-repository";
import type { LeadEventRepository } from "../ports/outbound/lead-event-repository";
import type { Notifier } from "../ports/outbound/notifier";
import type { UserAccountRepository } from "../ports/outbound/user-account-repository";

export interface ReassignEventCoordinatorCommand {
  readonly eventId: string;
  readonly eventCoordinatorUserAccountId: string;
  /** The Event Coordinator Lead making the change -- recorded as who did it (AC4). */
  readonly leadUserAccountId: string;
}

export interface ReassignEventCoordinatorResult {
  readonly eventId: string;
  readonly assignedCoordinatorUserAccountId: string;
  /** False when the event already had that coordinator, so nothing was stored or sent. */
  readonly changed: boolean;
}

export interface ReassignEventCoordinatorDeps {
  readonly leadEvents: LeadEventRepository;
  readonly userAccounts: UserAccountRepository;
  readonly clientOrganisations: ClientOrganisationRepository;
  readonly notifier: Notifier;
}

/**
 * SPM-257: the Event Coordinator Lead hands an active event to another
 * coordinator. Whether it may change hands is `reassignEventCoordinator`'s
 * call; the store records who did it and moves access with the event. The new
 * coordinator and the Organiser are told (SPM-57, SPM-58); the previous
 * coordinator is not -- that is the open question Q3, not yet answered.
 */
export class ReassignEventCoordinatorUseCase {
  constructor(private readonly deps: ReassignEventCoordinatorDeps) {}

  async execute(command: ReassignEventCoordinatorCommand): Promise<ReassignEventCoordinatorResult> {
    const lead = userAccountId(command.leadUserAccountId);
    const coordinatorId = userAccountId(command.eventCoordinatorUserAccountId);

    const event = await this.deps.leadEvents.findById(lead, eventId(command.eventId));
    if (event === null) {
      throw new EventNotFoundError(command.eventId);
    }

    if (!(await this.deps.userAccounts.isEventCoordinator(coordinatorId))) {
      throw new EventCoordinatorNotFoundError(coordinatorId);
    }

    const reassigned = reassignEventCoordinator(event, coordinatorId);
    const result = { eventId: event.id, assignedCoordinatorUserAccountId: coordinatorId };

    if (event.assignedCoordinatorUserAccountId === coordinatorId) {
      return { ...result, changed: false };
    }

    await this.deps.leadEvents.reassignCoordinator(reassigned, lead);

    const [organisationNames, coordinatorNames] = await Promise.all([
      this.deps.clientOrganisations.findNamesByIds([event.clientOrganisationId]),
      this.deps.userAccounts.findNamesByIds([coordinatorId]),
    ]);
    await this.deps.notifier.eventCoordinatorAssigned({
      recipientUserAccountId: coordinatorId,
      eventRequestId: event.eventRequestId,
      eventId: event.id,
      eventName: event.name,
      clientOrganisationName: organisationNames.get(event.clientOrganisationId) ?? null,
      preferredDate: event.preferredDate,
      // An event carries its own slots once planned; the notice names only the date.
      preferredSlots: [],
    });
    await this.deps.notifier.organiserCoordinatorAssigned({
      recipientUserAccountId: event.owningOrganiserUserAccountId,
      eventRequestId: event.eventRequestId,
      eventName: event.name,
      coordinatorName: coordinatorNames.get(coordinatorId) ?? null,
    });

    return { ...result, changed: true };
  }
}
