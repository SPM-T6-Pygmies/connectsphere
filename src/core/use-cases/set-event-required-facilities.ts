import { CoordinatorEventNotFoundError, EventFacilitiesLockedError } from "../domain/errors";
import { chooseRequiredFacilities, eventFacilitiesEditable } from "../domain/event-facilities";
import { userAccountId } from "../domain/user-account";
import type { CoordinatorEventRepository } from "../ports/outbound/coordinator-event-repository";

export interface SetEventRequiredFacilitiesCommand {
  readonly eventId: string;
  /** The Event Coordinator asking. */
  readonly userAccountId: string;
  /** The facilities ticked; an empty list clears them. */
  readonly facilities: readonly string[];
}

export interface SetEventRequiredFacilitiesResult {
  /** What is now stored: the chosen facilities, or null when none is needed. */
  readonly requiredFacilities: string | null;
}

export interface SetEventRequiredFacilitiesDeps {
  readonly events: CoordinatorEventRepository;
}

/**
 * SPM-247: the assigned Event Coordinator records which facilities the event
 * needs, so SPM-45 can check a venue against them.
 *
 * Only the coordinator planning the event may do this; anyone else is told the
 * event does not exist (#91). Which values are allowed, and that a Completed
 * or Cancelled event is read-only, are the domain's calls -- this file gathers
 * what it needs to decide.
 */
export class SetEventRequiredFacilitiesUseCase {
  constructor(private readonly deps: SetEventRequiredFacilitiesDeps) {}

  async execute(command: SetEventRequiredFacilitiesCommand): Promise<SetEventRequiredFacilitiesResult> {
    const { events } = this.deps;
    const coordinatorId = userAccountId(command.userAccountId);

    const event = await events.findAssigned(coordinatorId, command.eventId);
    if (event === null) {
      throw new CoordinatorEventNotFoundError(command.eventId);
    }
    if (!eventFacilitiesEditable(event.status)) {
      throw new EventFacilitiesLockedError(event.status);
    }

    const requiredFacilities = chooseRequiredFacilities(command.facilities);
    await events.setRequiredFacilities(coordinatorId, event.id, requiredFacilities);
    return { requiredFacilities };
  }
}
