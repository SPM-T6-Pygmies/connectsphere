import type { CoordinatorEventStatus } from "../domain/coordinator-event";
import { isActiveEvent } from "../domain/coordinator-workload";
import { eventId } from "../domain/event";
import { userAccountId } from "../domain/user-account";
import type { ClientOrganisationRepository } from "../ports/outbound/client-organisation-repository";
import type { LeadEventRepository } from "../ports/outbound/lead-event-repository";

export interface ViewLeadEventCommand {
  readonly eventId: string;
  /** The Event Coordinator Lead opening the event. */
  readonly leadUserAccountId: string;
}

export interface ViewLeadEventResult {
  readonly event: {
    readonly id: string;
    readonly name: string;
    readonly status: CoordinatorEventStatus;
    /** ISO calendar date, `YYYY-MM-DD`. */
    readonly preferredDate: string | null;
    readonly clientOrganisationName: string;
    readonly assignedCoordinatorUserAccountId: string | null;
  };
  /**
   * Whether its coordinator can change now -- `isActiveEvent`'s answer, for the
   * screen to gate the form on, not to trust in place of the reassignment's own check.
   */
  readonly canReassignCoordinator: boolean;
}

export interface ViewLeadEventDeps {
  readonly leadEvents: LeadEventRepository;
  readonly clientOrganisations: ClientOrganisationRepository;
}

/** SPM-257: one event as the Event Coordinator Lead opens it to reassign. Null if there is none. */
export class ViewLeadEventUseCase {
  constructor(private readonly deps: ViewLeadEventDeps) {}

  async execute(command: ViewLeadEventCommand): Promise<ViewLeadEventResult | null> {
    const event = await this.deps.leadEvents.findById(
      userAccountId(command.leadUserAccountId),
      eventId(command.eventId),
    );
    if (event === null) {
      return null;
    }

    const names = await this.deps.clientOrganisations.findNamesByIds([event.clientOrganisationId]);

    return {
      event: {
        id: event.id,
        name: event.name,
        status: event.status,
        preferredDate: event.preferredDate,
        clientOrganisationName: names.get(event.clientOrganisationId) ?? "",
        assignedCoordinatorUserAccountId: event.assignedCoordinatorUserAccountId,
      },
      canReassignCoordinator: isActiveEvent(event.status),
    };
  }
}
