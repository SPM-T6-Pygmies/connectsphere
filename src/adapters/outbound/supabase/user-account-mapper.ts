import { clientOrganisationId } from "@/core/domain/client-organisation";
import { userAccountId, type UserAccount } from "@/core/domain/user-account";

/** Credential-free row returned by `operations_event_coordinators`. */
export interface EventCoordinatorRow {
  readonly user_account_id: number;
  readonly name: string;
  readonly contact_details: string | null;
  readonly communication_preferences: string | null;
  readonly department: string | null;
  readonly availability: string | null;
  readonly client_organisation_id: number | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export function eventCoordinatorToDomain(row: EventCoordinatorRow): UserAccount {
  return {
    id: userAccountId(String(row.user_account_id)),
    name: row.name,
    contactDetails: row.contact_details,
    communicationPreferences: row.communication_preferences,
    department: row.department,
    availability: row.availability,
    clientOrganisationId:
      row.client_organisation_id === null
        ? null
        : clientOrganisationId(String(row.client_organisation_id)),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
