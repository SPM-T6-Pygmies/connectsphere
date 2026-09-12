import { clientOrganisationId, type ClientOrganisationId } from "../domain/client-organisation";
import { DraftNotEditableError } from "../domain/errors";
import {
  eventRequestId,
  submitEventRequest,
  type EventRequest,
  type EventRequestDetails,
  type SubmittedEventRequest,
} from "../domain/event-request";
import { userAccountId, type UserAccountId } from "../domain/user-account";
import type {
  SubmitEventRequest,
  SubmitEventRequestCommand,
  SubmitEventRequestResult,
} from "../ports/inbound/submit-event-request";
import type { Clock } from "../ports/outbound/clock";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface SubmitEventRequestDeps {
  readonly eventRequests: EventRequestRepository;
  readonly clock: Clock;
}

function detailsOf(command: SubmitEventRequestCommand): EventRequestDetails {
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
 * SPM-31: an Event Organiser states their requirements and submits.
 *
 * Read the body and notice there is no business rule in it. Which fields are
 * mandatory, and what a Submitted request looks like, both live in
 * `submitEventRequest`; what remains here is sequence -- build, store, report.
 *
 * Constructing the request before touching the repository is deliberate: an
 * incomplete submission is refused without a single byte crossing the network,
 * so a half-filled form can never leave a partial row behind.
 */
export class SubmitEventRequestUseCase implements SubmitEventRequest {
  constructor(private readonly deps: SubmitEventRequestDeps) {}

  async execute(command: SubmitEventRequestCommand): Promise<SubmitEventRequestResult> {
    const { eventRequests, clock } = this.deps;
    const organiser = userAccountId(command.responsibleOrganiserId);
    const organisation = clientOrganisationId(command.clientOrganisationId);

    const submitted = submitEventRequest({
      details: detailsOf(command),
      clientOrganisationId: organisation,
      responsibleOrganiserId: organiser,
      submittedAt: clock.now(),
      organiserTimeZone: command.organiserTimeZone,
    });

    const stored =
      command.eventRequestId === null
        ? await eventRequests.create(submitted)
        : await this.submitExistingDraft(command.eventRequestId, submitted, organiser, organisation);

    return {
      eventRequestId: stored.id,
      status: stored.status,
      submittedAt: submitted.submittedAt.toISOString(),
      summary: {
        eventName: stored.details.eventName,
        preferredDate: stored.details.preferredDate,
        preferredStartTime: stored.details.preferredStartTime,
        preferredEndTime: stored.details.preferredEndTime,
        expectedAttendance: stored.details.expectedAttendance,
      },
    };
  }

  /**
   * SPM-38: finishes the Organiser's own draft rather than raising a second,
   * unrelated request -- the same access rule `eventRequestAccessFor` already
   * draws (edit, hence submit, only while it is still the caller's own
   * Draft) is checked again here because the store, not just the domain, has
   * to enforce it.
   */
  private async submitExistingDraft(
    rawId: string,
    submitted: SubmittedEventRequest,
    organiser: UserAccountId,
    organisation: ClientOrganisationId,
  ): Promise<EventRequest> {
    const id = eventRequestId(rawId);
    const existing = await this.deps.eventRequests.findById(id);

    if (
      existing === null ||
      existing.status !== "Draft" ||
      existing.responsibleOrganiserId !== organiser ||
      existing.clientOrganisationId !== organisation
    ) {
      throw new DraftNotEditableError(rawId);
    }

    const updated: EventRequest = { ...submitted, id };
    await this.deps.eventRequests.save(updated);
    return updated;
  }
}
