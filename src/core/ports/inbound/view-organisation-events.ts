import type { OrganisationEvent } from "./organisation-event";

export interface ViewOrganisationEventsCommand {
  readonly clientOrganisationId: string;
}

export interface ViewOrganisationEventsResult {
  readonly events: readonly OrganisationEvent[];
}

/**
 * Driving port: SPM-39 AC1 -- every event raised by a colleague in the
 * caller's own client organisation, regardless of which Organiser raised it.
 */
export interface ViewOrganisationEvents {
  execute(command: ViewOrganisationEventsCommand): Promise<ViewOrganisationEventsResult>;
}
