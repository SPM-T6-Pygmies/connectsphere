import type { ClientOrganisationId } from "../../domain/organisation";
import type { OrganiserEvent } from "../../domain/organiser-event";

/**
 * Driven port: the Organiser-facing event record, scoped by client
 * organisation.
 *
 * `listByClientOrganisation` is the read AC1 needs -- every event raised by
 * any Organiser in that organisation, not just the caller's own.
 */
export interface OrganiserEventRepository {
  listByClientOrganisation(id: ClientOrganisationId): Promise<OrganiserEvent[]>;
}
