import { clientOrganisationId } from "../domain/client-organisation";
import { eventRequestId, eventRequestAccessFor, type EventRequest, type OrganiserContext } from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface ViewEventRequestCommand {
  readonly id: string;
  readonly userAccountId: string;
  readonly clientOrganisationId: string;
}

export interface ViewEventRequestResult {
  readonly eventRequest: EventRequest;
}

export interface ViewEventRequestDeps {
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
export class ViewEventRequestUseCase {
  constructor(private readonly deps: ViewEventRequestDeps) {}

  /** Null when there is no such request, or the caller may not see it -- the caller
   * should treat both the same way (not found), per `eventRequestAccessFor`. */
  async execute(command: ViewEventRequestCommand): Promise<ViewEventRequestResult | null> {
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
