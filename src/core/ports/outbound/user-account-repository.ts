import type { UserAccountId } from "../../domain/user-account";

/**
 * Driven port: resolves a user account's display name from its id.
 *
 * Batched rather than one-id-at-a-time, for the same reason as
 * `ClientOrganisationRepository`.
 */
export interface UserAccountRepository {
  findNamesByIds(ids: readonly UserAccountId[]): Promise<ReadonlyMap<UserAccountId, string>>;
}
