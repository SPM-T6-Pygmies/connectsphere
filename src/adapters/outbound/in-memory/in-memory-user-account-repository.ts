import type { ClientOrganisationId } from "@/core/domain/client-organisation";
import type { UserAccountId } from "@/core/domain/user-account";
import type {
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

  constructor(
    seed: {
      readonly names?: ReadonlyMap<UserAccountId, string>;
      readonly organisers?: readonly SeedOrganiser[];
    } = {},
  ) {
    this.names = seed.names ?? new Map();
    this.organisers = seed.organisers ?? [];
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
}
