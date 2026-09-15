import { clientOrganisationId } from "../domain/client-organisation";
import { userAccountId } from "../domain/user-account";
import type {
  EventRequestRepository,
  MyEventRequestSummary,
} from "../ports/outbound/event-request-repository";

export type { MyEventRequestSummary } from "../ports/outbound/event-request-repository";

export interface ViewMyEventRequestsCommand {
  readonly userAccountId: string;
  readonly clientOrganisationId: string;
}

export interface ViewMyEventRequestsResult {
  readonly eventRequests: readonly MyEventRequestSummary[];
}

export interface ViewMyEventRequestsDeps {
  readonly eventRequests: EventRequestRepository;
}

/**
 * SPM-31: the Event Organiser's own requests -- drafts and submitted alike,
 * never a colleague's. Narrower than `ViewOrganisationEventRequestsUseCase`
 * (SPM-39), which lists the whole organisation's requests for coordination
 * purposes; this is what "My event requests" means.
 *
 * A thin read slice (ARCHITECTURE.md section 11): no domain rule decides
 * anything about this list, so the store answers with the view itself.
 */
export class ViewMyEventRequestsUseCase {
  constructor(private readonly deps: ViewMyEventRequestsDeps) {}

  async execute(command: ViewMyEventRequestsCommand): Promise<ViewMyEventRequestsResult> {
    return {
      eventRequests: await this.deps.eventRequests.listRaisedBy(
        userAccountId(command.userAccountId),
        clientOrganisationId(command.clientOrganisationId),
      ),
    };
  }
}
