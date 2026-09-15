import type { ClientOrganisationId } from "@/core/domain/client-organisation";
import type { UserAccountId } from "@/core/domain/user-account";
import type {
  EventCoordinatorDetails,
  OrganiserSummary,
  UserAccountRepository,
} from "@/core/ports/outbound/user-account-repository";

/** An Organiser as seeded: the view, plus the client organisation it belongs to. */
export interface SeedOrganiser extends OrganiserSummary {
  readonly clientOrganisationId: ClientOrganisationId;
}

export class InMemoryUserAccountRepository implements UserAccountRepository {
  private readonly names: ReadonlyMap<UserAccountId, string>;
  private readonly organisers: readonly SeedOrganiser[];
  private readonly eventCoordinators: readonly EventCoordinatorDetails[];

  constructor(
    seed: {
      readonly names?: ReadonlyMap<UserAccountId, string>;
      readonly organisers?: readonly SeedOrganiser[];
      readonly eventCoordinators?: readonly EventCoordinatorDetails[];
    } = {},
  ) {
    this.names = seed.names ?? new Map();
    this.organisers = seed.organisers ?? [];
    this.eventCoordinators = seed.eventCoordinators ?? [];
  }

  async findNamesByIds(ids: readonly UserAccountId[]): Promise<ReadonlyMap<UserAccountId, string>> {
    const result = new Map<UserAccountId, string>();
    for (const id of ids) {
      const name = this.names.get(id);
      if (name !== undefined) {
        result.set(id, name);
      }
    }
    return result;
  }

  async listOrganisers(
    clientOrganisationId: ClientOrganisationId,
  ): Promise<readonly OrganiserSummary[]> {
    return this.organisers
      .filter((row) => row.clientOrganisationId === clientOrganisationId)
      .map(({ userAccountId, name }) => ({ userAccountId, name }));
  }

  async listEventCoordinators(): Promise<readonly EventCoordinatorDetails[]> {
    return this.eventCoordinators;
  }

  async isEventCoordinator(id: UserAccountId): Promise<boolean> {
    return this.eventCoordinators.some((coordinator) => coordinator.userAccountId === id);
  }
}
