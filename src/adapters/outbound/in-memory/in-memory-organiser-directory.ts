import type { ClientOrganisationId } from "@/core/domain/client-organisation";
import type { OrganiserDirectory, OrganiserSummary } from "@/core/ports/outbound/organiser-directory";

interface SeedOrganiser extends OrganiserSummary {
  readonly clientOrganisationId: ClientOrganisationId;
}

export class InMemoryOrganiserDirectory implements OrganiserDirectory {
  constructor(private readonly rows: readonly SeedOrganiser[] = []) {}

  async listByClientOrganisation(
    clientOrganisationId: ClientOrganisationId,
  ): Promise<readonly OrganiserSummary[]> {
    return this.rows
      .filter((row) => row.clientOrganisationId === clientOrganisationId)
      .map(({ userAccountId, name }) => ({ userAccountId, name }));
  }
}
