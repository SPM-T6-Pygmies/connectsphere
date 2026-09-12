import { userAccountId } from "../domain/user-account";
import type {
  AssignedEventSummary,
  ViewAssignedEvents,
  ViewAssignedEventsCommand,
  ViewAssignedEventsResult,
} from "../ports/inbound/view-assigned-events";
import type { ClientOrganisationRepository } from "../ports/outbound/client-organisation-repository";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";

export interface ViewAssignedEventsDeps {
  readonly events: CoordinatorEventRepository;
  readonly clientOrganisations: ClientOrganisationRepository;
}

/**
 * SPM-121's own scoping note: "My events" is every event the caller is
 * coordinating, whatever its status -- unlike "My requests", nothing here is
 * excluded, because a decided/completed/cancelled event doesn't move to a
 * separate archive the way a decided request does.
 */
export class ViewAssignedEventsUseCase implements ViewAssignedEvents {
  constructor(private readonly deps: ViewAssignedEventsDeps) {}

  async execute(command: ViewAssignedEventsCommand): Promise<ViewAssignedEventsResult> {
    const coordinatorId = userAccountId(command.userAccountId);

    const events = await this.deps.events.listByAssignedCoordinator(coordinatorId);

    const organisationNames = await this.deps.clientOrganisations.findNamesByIds(
      events.map((event) => event.clientOrganisationId),
    );

    return {
      events: events.map(
        (event): AssignedEventSummary => ({
          id: event.id,
          name: event.name,
          clientOrganisationName: organisationNames.get(event.clientOrganisationId) ?? "",
          preferredDate: event.preferredDate,
          status: event.status,
        }),
      ),
    };
  }
}
