import {
  clarificationMessageId,
  topLevelParentFor,
} from "../domain/clarification-message";
import { clientOrganisationId } from "../domain/client-organisation";
import { ClarificationMessageRequiredError, EventRequestNotFoundError } from "../domain/errors";
import {
  eventRequestAccessFor,
  eventRequestId,
  type OrganiserContext,
} from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { ClarificationThreadRepository } from "../ports/outbound/clarification-thread-repository";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface PostClarificationMessageCommand {
  readonly id: string;
  /** The Event Organiser replying. */
  readonly userAccountId: string;
  readonly organisationId: string;
  readonly body: string;
  /** The top-level message being replied to, or `null` to start a new one. */
  readonly parentId: string | null;
}

export interface PostClarificationMessageResult {
  readonly clarificationMessageId: string;
}

export interface PostClarificationMessageDeps {
  readonly eventRequests: EventRequestRepository;
  readonly clarificationThread: ClarificationThreadRepository;
}

/**
 * SPM-33 AC4-AC5: the responsible Event Organiser answers on the request's
 * clarification thread.
 *
 * It appends to the thread and nothing else -- no status transition, no
 * `EventRequest` write. That is decision 3's payoff: a message cannot move a
 * request, so this use case cannot get the state machine wrong, and the
 * Coordinator decides for themselves when they have heard enough.
 *
 * It deliberately does **not** require `"edit"` access, which
 * `eventRequestAccessFor` grants only to a still-`Draft` request. Posting is
 * not editing, which is exactly what keeps #102 honoured: the Organiser may
 * not rewrite what they submitted, and answering a question about it was never
 * a rewrite. That distinction is why the exchange was built as an append.
 *
 * Nor is posting restricted by status. SPM-33's remaining open question notes
 * this is a choice rather than a source: decision 3 makes a message harmless,
 * so a status guard would buy nothing.
 *
 * Telling the Coordinator that the Organiser replied is its own card under
 * SPM-47, not this use case's.
 */
export class PostClarificationMessageUseCase {
  constructor(private readonly deps: PostClarificationMessageDeps) {}

  /** Throws `EventRequestNotFoundError` when there is no such request, when it belongs to another organisation, and when the caller is not the Organiser responsible for it (#91). */
  async execute(
    command: PostClarificationMessageCommand,
  ): Promise<PostClarificationMessageResult> {
    const { eventRequests, clarificationThread } = this.deps;
    const author = userAccountId(command.userAccountId);
    const id = eventRequestId(command.id);

    const request = await eventRequests.findById(id);
    const organiser: OrganiserContext = {
      userAccountId: author,
      clientOrganisationId: clientOrganisationId(command.organisationId),
    };

    // A colleague in the same organisation may *see* the request (#81), but
    // the exchange is between the Coordinator and the Organiser responsible
    // for it, so anyone else is refused. Not-found rather than forbidden, the
    // same answer every other refusal on this record gives (#91).
    if (
      request === null ||
      eventRequestAccessFor(request, organiser) === "none" ||
      request.responsibleOrganiserId !== author
    ) {
      throw new EventRequestNotFoundError(command.id);
    }

    const body = command.body.trim();
    if (body.length === 0) {
      throw new ClarificationMessageRequiredError();
    }

    const parentId = topLevelParentFor(
      await clarificationThread.messagesFor(id),
      command.parentId === null ? null : clarificationMessageId(command.parentId),
    );

    const stored = await clarificationThread.append({
      eventRequestId: id,
      authorUserAccountId: author,
      body,
      parentId,
    });

    return { clarificationMessageId: stored.id };
  }

}

