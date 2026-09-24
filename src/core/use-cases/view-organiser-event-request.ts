import { clientOrganisationId } from "../domain/client-organisation";
import {
  canDiscussEventRequest,
  eventRequestId,
  eventRequestAccessFor,
  type OrganiserContext,
} from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { ClarificationThreadRepository } from "../ports/outbound/clarification-thread-repository";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";
import type { UserAccountRepository } from "../ports/outbound/user-account-repository";

import {
  toClarificationThreadView,
  toEventRequestView,
  type ClarificationMessageView,
  type EventRequestView,
} from "./event-request-view";

export interface ViewOrganiserEventRequestCommand {
  readonly id: string;
  readonly userAccountId: string;
  readonly clientOrganisationId: string;
}

export interface ViewOrganiserEventRequestResult {
  readonly eventRequest: EventRequestView;
  /**
   * The clarification exchange so far, oldest first (SPM-33 AC4) -- the same
   * thread the Coordinator reads, since the record is retained once and read
   * by both sides.
   */
  readonly clarificationThread: readonly ClarificationMessageView[];
  /**
   * Whether the thread is still open to new messages -- see
   * `canDiscussEventRequest`. False once the request is decided.
   */
  readonly canDiscuss: boolean;
}

export interface ViewOrganiserEventRequestDeps {
  readonly eventRequests: EventRequestRepository;
  readonly clarificationThread: ClarificationThreadRepository;
  readonly userAccounts: UserAccountRepository;
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
export class ViewOrganiserEventRequestUseCase {
  constructor(private readonly deps: ViewOrganiserEventRequestDeps) {}

  /** Null when there is no such request, or the caller may not see it -- the caller should treat both the same way (not found), per `eventRequestAccessFor`. */
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

    const messages = await this.deps.clarificationThread.messagesFor(request.id);
    // One batched lookup for the whole thread rather than one per message.
    const names = await this.deps.userAccounts.findNamesByIds(
      messages.map((message) => message.authorUserAccountId),
    );

    return {
      eventRequest: toEventRequestView(request),
      clarificationThread: toClarificationThreadView(messages, names),
      canDiscuss: canDiscussEventRequest(request.status),
    };
  }
}
