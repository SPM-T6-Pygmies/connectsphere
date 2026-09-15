import type {
  EventCoordinatorDetails,
  EventCoordinatorDirectory,
} from "../ports/outbound/event-coordinator-directory";

export type { EventCoordinatorDetails } from "../ports/outbound/event-coordinator-directory";

export interface ViewAllEventCoordinatorsResult {
  readonly eventCoordinators: readonly EventCoordinatorDetails[];
}

export interface ViewAllEventCoordinatorsDeps {
  readonly eventCoordinators: EventCoordinatorDirectory;
}

/**
 * The Event Operations Manager's complete coordinator list.
 *
 * A thin read slice (ARCHITECTURE.md section 11): nothing in the domain decides
 * anything about it, so the directory answers with the view itself.
 */
export class ViewAllEventCoordinatorsUseCase {
  constructor(private readonly deps: ViewAllEventCoordinatorsDeps) {}

  async execute(): Promise<ViewAllEventCoordinatorsResult> {
    return { eventCoordinators: await this.deps.eventCoordinators.listAll() };
  }
}
