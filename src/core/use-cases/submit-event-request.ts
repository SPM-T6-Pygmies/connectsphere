import { clientOrganisationId } from "../domain/client-organisation";
import { submitEventRequest, type EventRequestDetails } from "../domain/event-request";
import { userAccountId } from "../domain/user-account";
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

    const request = submitEventRequest({
      details: detailsOf(command),
      clientOrganisationId: clientOrganisationId(command.clientOrganisationId),
      responsibleOrganiserId: userAccountId(command.responsibleOrganiserId),
      submittedAt: clock.now(),
      organiserTimeZone: command.organiserTimeZone,
    });

    const stored = await eventRequests.create(request);

    return {
      eventRequestId: stored.id,
      status: stored.status,
      submittedAt: request.submittedAt.toISOString(),
      summary: {
        eventName: stored.details.eventName,
        preferredDate: stored.details.preferredDate,
        preferredStartTime: stored.details.preferredStartTime,
        preferredEndTime: stored.details.preferredEndTime,
        expectedAttendance: stored.details.expectedAttendance,
      },
    };
  }
}
