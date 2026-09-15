import type { UserAccountId } from "../../domain/user-account";

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

/** Read-side access to every account holding the Event Coordinator role. */
export interface EventCoordinatorDirectory {
  listAll(): Promise<readonly EventCoordinatorDetails[]>;
  exists(id: UserAccountId): Promise<boolean>;
}
