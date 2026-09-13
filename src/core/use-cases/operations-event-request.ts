import type { EventRequest } from "../domain/event-request";
import type { OperationsEventRequest } from "../ports/inbound/view-all-event-requests";

/** Maps the domain entity to the shared Event Operations read model. */
export function toOperationsEventRequest(request: EventRequest): OperationsEventRequest {
  return {
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
  };
}
