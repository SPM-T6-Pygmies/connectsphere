import type { ClientOrganisationId } from "../../domain/client-organisation";

/** One Organiser a request could be reassigned to -- plain data, the view the screen needs. */
export interface OrganiserSummary {
  readonly userAccountId: string;
  readonly name: string;
}

/** Read-only lookup of Event Organisers belonging to one client organisation. */
export interface OrganiserDirectory {
  listByClientOrganisation(
    clientOrganisationId: ClientOrganisationId,
  ): Promise<readonly OrganiserSummary[]>;
}
