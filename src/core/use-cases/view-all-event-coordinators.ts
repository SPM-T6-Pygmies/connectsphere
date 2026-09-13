import type {
  EventCoordinatorDetails,
  ViewAllEventCoordinators,
  ViewAllEventCoordinatorsResult,
} from "../ports/inbound/view-all-event-coordinators";
import type { EventCoordinatorDirectory } from "../ports/outbound/event-coordinator-directory";

export interface ViewAllEventCoordinatorsDeps {
  readonly eventCoordinators: EventCoordinatorDirectory;
}

/** The Event Operations Manager's complete coordinator list. */
export class ViewAllEventCoordinatorsUseCase implements ViewAllEventCoordinators {
  constructor(private readonly deps: ViewAllEventCoordinatorsDeps) {}

  async execute(): Promise<ViewAllEventCoordinatorsResult> {
    const coordinators = await this.deps.eventCoordinators.listAll();

    return {
      eventCoordinators: coordinators.map(
        (coordinator): EventCoordinatorDetails => ({
          userAccountId: coordinator.id,
          name: coordinator.name,
          contactDetails: coordinator.contactDetails,
          communicationPreferences: coordinator.communicationPreferences,
          department: coordinator.department,
          availability: coordinator.availability,
          clientOrganisationId: coordinator.clientOrganisationId,
          createdAt: coordinator.createdAt.toISOString(),
          updatedAt: coordinator.updatedAt.toISOString(),
        }),
      ),
    };
  }
}
