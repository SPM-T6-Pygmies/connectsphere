import type {
  EventCoordinatorDetails,
  UserAccountRepository,
} from "../ports/outbound/user-account-repository";

export type { EventCoordinatorDetails } from "../ports/outbound/user-account-repository";

export interface ViewAllEventCoordinatorsResult {
  readonly eventCoordinators: readonly EventCoordinatorDetails[];
}

export interface ViewAllEventCoordinatorsDeps {
  readonly userAccounts: UserAccountRepository;
}

/**
 * The Event Operations Manager's complete coordinator list.
 *
 * A thin read slice (ARCHITECTURE.md section 11): nothing in the domain decides
 * anything about it, so the repository answers with the view itself.
 */
export class ViewAllEventCoordinatorsUseCase {
  constructor(private readonly deps: ViewAllEventCoordinatorsDeps) {}

  async execute(): Promise<ViewAllEventCoordinatorsResult> {
    return { eventCoordinators: await this.deps.userAccounts.listEventCoordinators() };
  }
}
