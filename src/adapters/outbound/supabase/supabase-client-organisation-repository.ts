import { clientOrganisationId, type ClientOrganisationId } from "@/core/domain/client-organisation";
import type { ClientOrganisationRepository } from "@/core/ports/outbound/client-organisation-repository";

import type { SupabaseServerClient } from "./client";

interface ClientOrganisationNameRow {
  client_organisation_id: number;
  name: string;
}

/**
 * The domain's ids are opaque strings; this store numbers its rows. An id
 * that was never one of ours is simply not found, not an error.
 */
function toKey(id: string): number | null {
  return /^\d+$/.test(id) ? Number(id) : null;
}

/**
 * Reached through `client_organisation_names`, not the table -- same reason
 * as `SupabaseEventRequestRepository`: RLS is enabled with no policy, and
 * `anon`'s key has no table grant.
 */
export class SupabaseClientOrganisationRepository implements ClientOrganisationRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async findNamesByIds(
    ids: readonly ClientOrganisationId[],
  ): Promise<ReadonlyMap<ClientOrganisationId, string>> {
    const keys = ids.map(toKey).filter((key): key is number => key !== null);
    if (keys.length === 0) {
      return new Map();
    }

    const { data, error } = await this.client.rpc("client_organisation_names", {
      p_client_organisation_ids: keys,
    });

    if (error) {
      throw new Error(`Failed to look up client organisation names: ${error.message}`, {
        cause: error,
      });
    }

    const rows = (data ?? []) as unknown as ClientOrganisationNameRow[];
    return new Map(
      rows.map((row) => [clientOrganisationId(String(row.client_organisation_id)), row.name]),
    );
  }
}
