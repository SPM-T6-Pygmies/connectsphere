import type { CoordinatorEventStatus } from "../domain/coordinator-event";
import { userAccountId } from "../domain/user-account";
import type { ClientOrganisationRepository } from "../ports/outbound/client-organisation-repository";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";

export interface ViewAssignedEventsCommand {
  readonly userAccountId: string;
}

export interface AssignedEventSummary {
  readonly id: string;
  /** The approved request the event was opened from; null if it has since been deleted. */
  readonly eventRequestId: string | null;
  readonly name: string;
  readonly clientOrganisationName: string;
  readonly preferredDate: string | null;
  readonly status: CoordinatorEventStatus;
}

export interface ViewAssignedEventsResult {
  readonly events: readonly AssignedEventSummary[];
}

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
export class ViewAssignedEventsUseCase {
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
          eventRequestId: event.eventRequestId,
          name: event.name,
          clientOrganisationName: organisationNames.get(event.clientOrganisationId) ?? "",
          preferredDate: event.preferredDate,
          status: event.status,
        }),
      ),
    };
  }
}
