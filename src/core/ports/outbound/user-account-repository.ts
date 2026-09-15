import type { ClientOrganisationId } from "../../domain/client-organisation";
import type { UserAccountId } from "../../domain/user-account";

/** One Organiser a request could be reassigned to -- plain data, the view the screen needs. */
export interface OrganiserSummary {
  readonly userAccountId: string;
  readonly name: string;
}

/**
 * One Event Coordinator as the Operations screens show them -- every
 * non-credential account column, as plain data.
 *
 * `credentials_hash` is intentionally absent: credentials are verification
 * material, not account profile data, and must never cross a read-model port.
 */
export interface EventCoordinatorDetails {
  readonly userAccountId: string;
  readonly name: string;
  readonly contactDetails: string | null;
  readonly communicationPreferences: string | null;
  readonly department: string | null;
  readonly availability: string | null;
  readonly clientOrganisationId: string | null;
  /** ISO 8601. */
  readonly createdAt: string;
  /** ISO 8601. */
  readonly updatedAt: string;
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
  /** Every account holding the Event Coordinator role. */
  listEventCoordinators(): Promise<readonly EventCoordinatorDetails[]>;
  isEventCoordinator(id: UserAccountId): Promise<boolean>;
}
