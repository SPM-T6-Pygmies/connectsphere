import { CoordinatorEventNotFoundError, EventDetailsLockedError } from "../domain/errors";
import {
  eventDetailsEditable,
  ORDINARY_EVENT_FIELDS,
  planOrdinaryEdit,
  type OrdinaryEventDetails,
  type OrdinaryEventField,
} from "../domain/event-details-edit";
import { userAccountId } from "../domain/user-account";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";

export interface UpdateEventDetailsCommand {
  readonly eventId: string;
  /** The Event Coordinator asking. */
  readonly userAccountId: string;
  /** Every ordinary detail as the form now has it; only what differs is saved. */
  readonly details: OrdinaryEventDetails;
}

export interface UpdateEventDetailsResult {
  /** The fields that changed -- empty when the edit changed nothing. */
  readonly changed: readonly OrdinaryEventField[];
}

export interface UpdateEventDetailsDeps {
  readonly events: CoordinatorEventRepository;
}

/**
 * SPM-49: the assigned Event Coordinator updates the event's ordinary details
 * as arrangements are finalised. Date, attendance, venue and equipment are not
 * among them -- those wait for a change request (#4).
 *
 * Only the coordinator planning the event may do this; anyone else is told the
 * event does not exist (#91). What counts as ordinary, when an event stops
 * being editable and which values are allowed are the domain's calls. Each
 * change is audited against the coordinator by the repository.
 */
export class UpdateEventDetailsUseCase {
  constructor(private readonly deps: UpdateEventDetailsDeps) {}

  async execute(command: UpdateEventDetailsCommand): Promise<UpdateEventDetailsResult> {
    const { events } = this.deps;
    const coordinatorId = userAccountId(command.userAccountId);

    const event = await events.findAssigned(coordinatorId, command.eventId);
    if (event === null) {
      throw new CoordinatorEventNotFoundError(command.eventId);
    }
    if (!eventDetailsEditable(event.status)) {
      throw new EventDetailsLockedError(event.status);
    }

    const current = Object.fromEntries(
      ORDINARY_EVENT_FIELDS.map((field) => [field, event[field]]),
    ) as OrdinaryEventDetails;
    const changes = planOrdinaryEdit(current, command.details);
    const changed = Object.keys(changes) as OrdinaryEventField[];
    if (changed.length > 0) {
      await events.updateOrdinaryDetails(coordinatorId, event.id, changes);
    }
    return { changed };
  }
}
