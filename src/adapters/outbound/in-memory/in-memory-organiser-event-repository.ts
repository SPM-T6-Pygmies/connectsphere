import type { ClientOrganisationId } from "@/core/domain/organisation";
import type { OrganiserEvent } from "@/core/domain/organiser-event";
import type { OrganiserEventRepository } from "@/core/ports/outbound/organiser-event-repository";

/** A real implementation of the port that happens to store rows in an array. */
export class InMemoryOrganiserEventRepository implements OrganiserEventRepository {
  private readonly rows: OrganiserEvent[];

  constructor(seed: readonly OrganiserEvent[] = []) {
    this.rows = [...seed];
  }

  async listByClientOrganisation(id: ClientOrganisationId): Promise<OrganiserEvent[]> {
    return this.rows.filter((event) => event.clientOrganisationId === id);
  }
}
