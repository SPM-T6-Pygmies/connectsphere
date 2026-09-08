import { clientOrganisationId } from "../domain/organisation";
import type {
  ViewOrganisationEvents,
  ViewOrganisationEventsCommand,
  ViewOrganisationEventsResult,
} from "../ports/inbound/view-organisation-events";
import type { OrganiserEventRepository } from "../ports/outbound/organiser-event-repository";
import { toOrganisationEvent } from "./organisation-event";

export interface ViewOrganisationEventsDeps {
  readonly organiserEvents: OrganiserEventRepository;
}

/**
 * SPM-39 AC1: an Organiser sees every event raised by a colleague in their
 * own client organisation, not only the ones they raised themselves.
 *
 * No edit-access check here -- AC2/AC3/AC4 are a later day's slice. This use
 * case only answers "what can be seen," scoped by client organisation.
 */
export class ViewOrganisationEventsUseCase implements ViewOrganisationEvents {
  constructor(private readonly deps: ViewOrganisationEventsDeps) {}

  async execute(command: ViewOrganisationEventsCommand): Promise<ViewOrganisationEventsResult> {
    const organisationId = clientOrganisationId(command.clientOrganisationId);
    const events = await this.deps.organiserEvents.listByClientOrganisation(organisationId);
    return { events: events.map(toOrganisationEvent) };
  }
}
