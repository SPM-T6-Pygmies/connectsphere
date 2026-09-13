import type { ClientOrganisationId } from "../../domain/client-organisation";
import type { UserAccountId } from "../../domain/user-account";

export interface OrganiserSummary {
  readonly userAccountId: UserAccountId;
  readonly name: string;
}

/** Read-only lookup of Event Organisers belonging to one client organisation. */
export interface OrganiserDirectory {
  listByClientOrganisation(
    clientOrganisationId: ClientOrganisationId,
  ): Promise<readonly OrganiserSummary[]>;
}
