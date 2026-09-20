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
 * #59). #101 names the Event Operations Manager as the only role with
 * assign/reassign authority -- enforced at the driving adapter
 * (`reassignEventOrganiserAction`), not here: this use case delivers the
 * reassignment's effect, the same shape as every other use case in this
 * codebase that leaves authorisation to its Server Action (see
 * `AssignEventCoordinatorUseCase`/`assignEventCoordinatorAction`).
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
    await this.deps.eventRequests.reassignResponsibleOrganiser(reassigned);

    return {
      eventRequestId: reassigned.id,
      responsibleOrganiserId: reassigned.responsibleOrganiserId,
    };
  }
}
