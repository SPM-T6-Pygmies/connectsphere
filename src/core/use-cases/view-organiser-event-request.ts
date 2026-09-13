import { clientOrganisationId } from "../domain/client-organisation";
import { eventRequestId, eventRequestAccessFor, type OrganiserContext } from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type {
  ViewOrganiserEventRequest,
  ViewOrganiserEventRequestCommand,
  ViewOrganiserEventRequestResult,
} from "../ports/inbound/view-organiser-event-request";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface ViewOrganiserEventRequestDeps {
  readonly eventRequests: EventRequestRepository;
}

/**
 * SPM-31: one event request, as its own Organiser (or a colleague in the same
 * client organisation, per `eventRequestAccessFor`) may see it.
 *
 * An unrelated organisation's request comes back the same as a request that
 * does not exist -- `eventRequestAccessFor`'s "none" is deliberately not
 * distinguishable from not-found, so a cross-org guess cannot confirm a
 * request even exists (#91).
 */
export class ViewOrganiserEventRequestUseCase implements ViewOrganiserEventRequest {
  constructor(private readonly deps: ViewOrganiserEventRequestDeps) {}

  async execute(
    command: ViewOrganiserEventRequestCommand,
  ): Promise<ViewOrganiserEventRequestResult | null> {
    const request = await this.deps.eventRequests.findById(eventRequestId(command.id));
    if (request === null) {
      return null;
    }

    const organiser: OrganiserContext = {
      userAccountId: userAccountId(command.userAccountId),
      clientOrganisationId: clientOrganisationId(command.clientOrganisationId),
    };

    if (eventRequestAccessFor(request, organiser) === "none") {
      return null;
    }

    return { eventRequest: request };
  }
}
