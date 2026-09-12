import { clientOrganisationId } from "../domain/client-organisation";
import {
  eventRequestId,
  saveEventRequestDraft,
  type EventRequest,
  type EventRequestDetails,
} from "../domain/event-request";
import { DraftNotEditableError } from "../domain/errors";
import { userAccountId } from "../domain/user-account";
import type {
  SaveEventRequestDraft,
  SaveEventRequestDraftCommand,
  SaveEventRequestDraftResult,
} from "../ports/inbound/save-event-request-draft";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface SaveEventRequestDraftDeps {
  readonly eventRequests: EventRequestRepository;
}

function detailsOf(command: SaveEventRequestDraftCommand): EventRequestDetails {
  return {
    eventName: command.eventName,
    description: command.description,
    purpose: command.purpose,
    preferredDate: command.preferredDate,
    preferredStartTime: command.preferredStartTime,
    preferredEndTime: command.preferredEndTime,
    expectedAttendance: command.expectedAttendance,
    venueRequirements: command.venueRequirements,
    roomLayoutPreferences: command.roomLayoutPreferences,
    accessibilityNeeds: command.accessibilityNeeds,
    equipmentRequirements: command.equipmentRequirements,
    registrationRequirements: command.registrationRequirements,
    generalProgramme: command.generalProgramme,
    otherSpecialArrangements: command.otherSpecialArrangements,
  };
}

/**
 * SPM-38/SPM-93: an Event Organiser saves their progress without submitting.
 *
 * A first save has no id and becomes a new row; every save after that carries
 * the id the first one returned, so "save" always means "update my one
 * draft", never "create another one". Reused across both by
 * `saveEventRequestDraft`, which is where the actual rule -- no mandatory
 * fields, just a name -- lives.
 */
export class SaveEventRequestDraftUseCase implements SaveEventRequestDraft {
  constructor(private readonly deps: SaveEventRequestDraftDeps) {}

  async execute(command: SaveEventRequestDraftCommand): Promise<SaveEventRequestDraftResult> {
    const { eventRequests } = this.deps;
    const organiser = userAccountId(command.responsibleOrganiserId);
    const organisation = clientOrganisationId(command.clientOrganisationId);

    const draft = saveEventRequestDraft({
      details: detailsOf(command),
      clientOrganisationId: organisation,
      responsibleOrganiserId: organiser,
    });

    if (command.eventRequestId === null) {
      const stored = await eventRequests.create(draft);
      return { eventRequestId: stored.id };
    }

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

    const updated: EventRequest = { ...existing, ...draft, id };
    await eventRequests.save(updated);
    return { eventRequestId: id };
  }
}
