import type { EventCoordinatorDetails } from "@/core/ports/outbound/user-account-repository";

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

/** A coordinator row straight to the Operations view -- no entity in between. */
export function toEventCoordinatorDetails(row: EventCoordinatorRow): EventCoordinatorDetails {
  return {
    userAccountId: String(row.user_account_id),
    name: row.name,
    contactDetails: row.contact_details,
    communicationPreferences: row.communication_preferences,
    department: row.department,
    availability: row.availability,
    clientOrganisationId:
      row.client_organisation_id === null ? null : String(row.client_organisation_id),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
