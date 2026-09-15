import type { ClientOrganisationId } from "@/core/domain/client-organisation";
import { userAccountId, type UserAccountId } from "@/core/domain/user-account";
import type {
  OrganiserSummary,
  UserAccountRepository,
} from "@/core/ports/outbound/user-account-repository";

import type { SupabaseServerClient } from "./client";

interface UserAccountNameRow {
  user_account_id: number;
  name: string;
}

interface OrganiserRow {
  user_account_id: number;
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
 * Reached through database functions (`user_account_names`,
 * `organisation_event_organisers`), not the table -- same reason as
 * `SupabaseEventRequestRepository`: RLS is enabled with no policy, and
 * `anon`'s key has no table grant. Each function can only return rows for the
 * ids or the organisation the caller already named.
 */
export class SupabaseUserAccountRepository implements UserAccountRepository {
  constructor(private readonly client: SupabaseServerClient) {}

  async findNamesByIds(ids: readonly UserAccountId[]): Promise<ReadonlyMap<UserAccountId, string>> {
    const keys = ids.map(toKey).filter((key): key is number => key !== null);
    if (keys.length === 0) {
      return new Map();
    }

    const { data, error } = await this.client.rpc("user_account_names", {
      p_user_account_ids: keys,
    });

    if (error) {
      throw new Error(`Failed to look up user account names: ${error.message}`, { cause: error });
    }

    const rows = (data ?? []) as unknown as UserAccountNameRow[];
    return new Map(rows.map((row) => [userAccountId(String(row.user_account_id)), row.name]));
  }

  async listOrganisers(
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
      userAccountId: String(row.user_account_id),
      name: row.name,
    }));
  }
}
