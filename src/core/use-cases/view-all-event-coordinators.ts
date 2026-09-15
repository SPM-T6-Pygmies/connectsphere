import type { EventCoordinatorDirectory } from "../ports/outbound/event-coordinator-directory";

export interface EventCoordinatorDetails {
  readonly userAccountId: string;
  readonly name: string;
  readonly contactDetails: string | null;
  readonly communicationPreferences: string | null;
  readonly department: string | null;
  readonly availability: string | null;
  readonly clientOrganisationId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ViewAllEventCoordinatorsResult {
  readonly eventCoordinators: readonly EventCoordinatorDetails[];
}

export interface ViewAllEventCoordinatorsDeps {
  readonly eventCoordinators: EventCoordinatorDirectory;
}

/** The Event Operations Manager's complete coordinator list. */
export class ViewAllEventCoordinatorsUseCase {
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
