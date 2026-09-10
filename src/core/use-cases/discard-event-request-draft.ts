import { clientOrganisationId } from "../domain/client-organisation";
import { eventRequestId } from "../domain/event-request";
import { DraftNotEditableError } from "../domain/errors";
import { userAccountId } from "../domain/user-account";
import type {
  DiscardEventRequestDraft,
  DiscardEventRequestDraftCommand,
} from "../ports/inbound/discard-event-request-draft";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface DiscardEventRequestDraftDeps {
  readonly eventRequests: EventRequestRepository;
}

/**
 * SPM-38: an Event Organiser abandons a draft they started.
 *
 * Same edit rule as saving one -- `eventRequestAccessFor`'s "edit": still
 * `Draft`, and owned by the organiser asking. Anything else is refused the
 * same not-found-shaped way `SaveEventRequestDraftUseCase` refuses an
 * uneditable draft, so a cross-organiser guess cannot confirm a request even
 * exists.
 */
export class DiscardEventRequestDraftUseCase implements DiscardEventRequestDraft {
  constructor(private readonly deps: DiscardEventRequestDraftDeps) {}

  async execute(command: DiscardEventRequestDraftCommand): Promise<void> {
    const { eventRequests } = this.deps;
    const organiser = userAccountId(command.responsibleOrganiserId);
    const organisation = clientOrganisationId(command.clientOrganisationId);
    const id = eventRequestId(command.eventRequestId);

    const existing = await eventRequests.findById(id);

    if (
      existing === null ||
      existing.status !== "Draft" ||
      existing.responsibleOrganiserId !== organiser ||
      existing.clientOrganisationId !== organisation
    ) {
      throw new DraftNotEditableError(command.eventRequestId);
    }

    await eventRequests.delete(existing);
  }
}
