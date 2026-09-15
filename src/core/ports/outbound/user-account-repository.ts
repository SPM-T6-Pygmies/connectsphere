import type { ClientOrganisationId } from "../../domain/client-organisation";
import type { UserAccountId } from "../../domain/user-account";

/** One Organiser a request could be reassigned to -- plain data, the view the screen needs. */
export interface OrganiserSummary {
  readonly userAccountId: string;
  readonly name: string;
}

/**
 * Driven port: the user accounts this application reads.
 *
 * One port for the one store behind them (ARCHITECTURE.md section 11, "group
 * ports by capability, not by operation"). Name lookups are batched rather
 * than one-id-at-a-time, for the same reason as `ClientOrganisationRepository`.
 */
export interface UserAccountRepository {
  findNamesByIds(ids: readonly UserAccountId[]): Promise<ReadonlyMap<UserAccountId, string>>;
  /** Event Organisers belonging to one client organisation. */
  listOrganisers(clientOrganisationId: ClientOrganisationId): Promise<readonly OrganiserSummary[]>;
}
