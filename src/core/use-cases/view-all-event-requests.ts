import type {
  OperationsEventRequest,
  ViewAllEventRequests,
  ViewAllEventRequestsResult,
} from "../ports/inbound/view-all-event-requests";
import type { EventRequestRepository } from "../ports/outbound/event-request-repository";

export interface ViewAllEventRequestsDeps {
  readonly eventRequests: EventRequestRepository;
}

/**
 * The Event Operations Manager's unfiltered source list.
 *
 * Assignment/status filtering belongs to the Operations UI. This use case
 * deliberately returns Drafts, every client organisation, and both assigned
 * and unassigned requests.
 */
export class ViewAllEventRequestsUseCase implements ViewAllEventRequests {
  constructor(private readonly deps: ViewAllEventRequestsDeps) {}

  async execute(): Promise<ViewAllEventRequestsResult> {
    const requests = await this.deps.eventRequests.listAll();

    return {
      eventRequests: requests.map(
        (request): OperationsEventRequest => ({
          id: request.id,
          eventName: request.details.eventName,
          description: request.details.description,
          purpose: request.details.purpose,
          preferredDate: request.details.preferredDate,
          preferredStartTime: request.details.preferredStartTime,
          preferredEndTime: request.details.preferredEndTime,
          expectedAttendance: request.details.expectedAttendance,
          venueRequirements: request.details.venueRequirements,
          accessibilityNeeds: request.details.accessibilityNeeds,
          equipmentRequirements: request.details.equipmentRequirements,
          registrationRequirements: request.details.registrationRequirements,
          roomLayoutPreferences: request.details.roomLayoutPreferences,
          generalProgramme: request.details.generalProgramme,
          otherSpecialArrangements: request.details.otherSpecialArrangements,
          status: request.status,
          decisionRecord: request.decisionRecord,
          requestingUserAccountId: request.responsibleOrganiserId,
          assignedCoordinatorUserAccountId: request.assignedCoordinatorUserAccountId,
          clientOrganisationId: request.clientOrganisationId,
          createdAt: request.createdAt.toISOString(),
          updatedAt: request.updatedAt.toISOString(),
        }),
      ),
    };
  }
}
