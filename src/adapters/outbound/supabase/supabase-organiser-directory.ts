import type { ClientOrganisationId } from "@/core/domain/client-organisation";
import { userAccountId } from "@/core/domain/user-account";
import type { OrganiserDirectory, OrganiserSummary } from "@/core/ports/outbound/organiser-directory";

import type { SupabaseServerClient } from "./client";
import { toKey } from "./event-request-mapper";

interface OrganiserRow {
  user_account_id: number;
  name: string;
}

/**
 * Reached through `organisation_event_organisers`, not the table directly --
 * same reasoning as `SupabaseEventRequestRepository`: `user_account` has RLS
 * enabled with no policy, so `anon` has no grant on it at all. The function
 * can only ever return rows for the organisation the caller already named.
 */
export class SupabaseOrganiserDirectory implements OrganiserDirectory {
  constructor(private readonly client: SupabaseServerClient) {}

  async listByClientOrganisation(
    clientOrganisationId: ClientOrganisationId,
  ): Promise<readonly OrganiserSummary[]> {
    const key = toKey(clientOrganisationId);
    if (key === null) {
      return [];
    }

    const { data, error } = await this.client.rpc("organisation_event_organisers", {
      p_client_organisation_id: key,
    });

    if (error) {
      throw new Error(`Failed to list organisers: ${error.message}`, { cause: error });
    }

    const rows = (data ?? []) as unknown as OrganiserRow[];
    return rows.map((row) => ({
      userAccountId: userAccountId(String(row.user_account_id)),
      name: row.name,
    }));
  }
}
