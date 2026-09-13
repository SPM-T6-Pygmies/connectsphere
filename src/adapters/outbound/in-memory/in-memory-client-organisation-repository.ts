import type { ClientOrganisationId } from "@/core/domain/client-organisation";
import type { ClientOrganisationRepository } from "@/core/ports/outbound/client-organisation-repository";

export class InMemoryClientOrganisationRepository implements ClientOrganisationRepository {
  private readonly names: ReadonlyMap<ClientOrganisationId, string>;

  constructor(seed: ReadonlyMap<ClientOrganisationId, string> = new Map()) {
    this.names = seed;
  }

  async findNamesByIds(
    ids: readonly ClientOrganisationId[],
  ): Promise<ReadonlyMap<ClientOrganisationId, string>> {
    const result = new Map<ClientOrganisationId, string>();
    for (const id of ids) {
      const name = this.names.get(id);
      if (name !== undefined) {
        result.set(id, name);
      }
    }
    return result;
  }
}
