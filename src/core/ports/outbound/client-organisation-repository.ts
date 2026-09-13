import type { ClientOrganisationId } from "../../domain/client-organisation";

/**
 * Driven port: resolves a client organisation's display name from its id.
 *
 * Batched rather than one-id-at-a-time, so a list of many requests costs one
 * lookup instead of N.
 */
export interface ClientOrganisationRepository {
  findNamesByIds(
    ids: readonly ClientOrganisationId[],
  ): Promise<ReadonlyMap<ClientOrganisationId, string>>;
}
