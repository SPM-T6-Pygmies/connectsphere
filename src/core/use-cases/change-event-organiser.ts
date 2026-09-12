import { EventRequestNotFoundError } from "../domain/errors";
import { eventRequestId, reassignResponsibleOrganiser } from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface ChangeEventOrganiserCommand {
  readonly eventRequestId: string;
  readonly newResponsibleOrganiserId: string;
}

export interface ChangeEventOrganiserResult {
  readonly eventRequestId: string;
  readonly responsibleOrganiserId: string;
}

export interface ChangeEventOrganiserDeps {
  readonly eventRequests: EventRequestRepository;
}

/**
 * SPM-39 AC5: reassigns responsibility for an event request, revoking the
 * outgoing Organiser's edit access and granting the incoming one's (#61,
 * #59). Who may trigger this is not settled by any source yet -- no card
 * defines the mechanism's own authority model -- so this use case does not
 * gate the caller; it delivers the reassignment's effect, which is what the
 * AC actually asserts.
 */
export class ChangeEventOrganiserUseCase {
  constructor(private readonly deps: ChangeEventOrganiserDeps) {}

  async execute(command: ChangeEventOrganiserCommand): Promise<ChangeEventOrganiserResult> {
    const id = eventRequestId(command.eventRequestId);
    const newOrganiserId = userAccountId(command.newResponsibleOrganiserId);

    const request = await this.deps.eventRequests.findById(id);
    if (request === null) {
      throw new EventRequestNotFoundError(id);
    }

    const reassigned = reassignResponsibleOrganiser(request, newOrganiserId);
    await this.deps.eventRequests.save(reassigned);

    return {
      eventRequestId: reassigned.id,
      responsibleOrganiserId: reassigned.responsibleOrganiserId,
    };
  }
}
